-- ============================================================
-- 不足テーブルの作成SQL（既存テーブルを壊さずに実行）
-- ============================================================
-- 
-- 前提：
-- 001_initial_schema.sqlで定義されている13テーブルのうち、
-- 既存の10テーブルと名前が異なる可能性があるため、
-- まず既存テーブルの構造を確認してから実行すること
--
-- 実行前に以下を確認：
-- 1. 003_check_existing_tables.sql を実行して既存テーブル構造を確認
-- 2. 既存テーブル名と001_initial_schema.sqlのテーブル名の対応関係を把握
-- 3. 既存テーブルが要件を満たしているか確認
--
-- ============================================================

-- ============================================================
-- 1. 既存テーブル名の確認（実行前に必ず確認）
-- ============================================================
-- 以下のSQLで既存テーブルを確認してください：
/*
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
ORDER BY table_name;
*/

-- ============================================================
-- 2. 不足テーブルの作成（IF NOT EXISTSで安全に実行）
-- ============================================================

-- 2.1 order_deadlines（日別締切時刻）
-- 依存: order_days（既存テーブル名がorder_calendarの場合は要修正）
CREATE TABLE IF NOT EXISTS order_deadlines (
    date DATE PRIMARY KEY,
    cutoff_time TIME NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 外部キー制約の追加（order_daysが存在する場合）
-- 注意: 既存テーブル名がorder_calendarの場合は、以下のコメントを外して実行
/*
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_days') THEN
        ALTER TABLE order_deadlines 
        ADD CONSTRAINT order_deadlines_date_fkey 
        FOREIGN KEY (date) REFERENCES order_days(date) ON DELETE CASCADE;
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_calendar') THEN
        -- order_calendarが既存テーブルの場合
        ALTER TABLE order_deadlines 
        ADD CONSTRAINT order_deadlines_date_fkey 
        FOREIGN KEY (date) REFERENCES order_calendar(date) ON DELETE CASCADE;
    END IF;
END $$;
*/

-- 2.2 auto_order_templates（自動注文テンプレート）
-- 依存: users_profile（既存テーブル名がprofilesの場合は要修正）、menus（既存テーブル名がmenu_itemsの場合は要修正）
CREATE TABLE IF NOT EXISTS auto_order_templates (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    menu_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    day_of_week INTEGER, -- 0=日曜, 1=月曜, ..., 6=土曜。NULLの場合は毎日
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT valid_day_of_week CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6))
);

-- 外部キー制約の追加（既存テーブル名に応じて修正）
DO $$
BEGIN
    -- users_profileまたはprofilesの確認
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users_profile') THEN
        ALTER TABLE auto_order_templates 
        ADD CONSTRAINT auto_order_templates_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users_profile(id) ON DELETE CASCADE;
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        ALTER TABLE auto_order_templates 
        ADD CONSTRAINT auto_order_templates_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;

    -- menusまたはmenu_itemsの確認
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menus') THEN
        ALTER TABLE auto_order_templates 
        ADD CONSTRAINT auto_order_templates_menu_id_fkey 
        FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE;
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_items') THEN
        ALTER TABLE auto_order_templates 
        ADD CONSTRAINT auto_order_templates_menu_id_fkey 
        FOREIGN KEY (menu_id) REFERENCES menu_items(id) ON DELETE CASCADE;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        -- 制約が既に存在する場合はスキップ
        NULL;
END $$;

-- 2.3 auto_order_run_items（自動注文実行アイテム）
-- 依存: auto_order_runs（既存）、users_profile（既存テーブル名がprofilesの場合は要修正）
CREATE TABLE IF NOT EXISTS auto_order_run_items (
    id SERIAL PRIMARY KEY,
    run_id INTEGER NOT NULL,
    user_id UUID NOT NULL,
    target_date DATE NOT NULL,
    result VARCHAR(50) NOT NULL, -- 'created', 'skipped', 'error'
    detail TEXT, -- エラーメッセージやスキップ理由
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(run_id, user_id)
);

-- 外部キー制約の追加
DO $$
BEGIN
    -- auto_order_runsへの参照
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'auto_order_runs') THEN
        ALTER TABLE auto_order_run_items 
        ADD CONSTRAINT auto_order_run_items_run_id_fkey 
        FOREIGN KEY (run_id) REFERENCES auto_order_runs(id) ON DELETE CASCADE;
    END IF;

    -- users_profileまたはprofilesへの参照
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users_profile') THEN
        ALTER TABLE auto_order_run_items 
        ADD CONSTRAINT auto_order_run_items_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users_profile(id) ON DELETE RESTRICT;
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        ALTER TABLE auto_order_run_items 
        ADD CONSTRAINT auto_order_run_items_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE RESTRICT;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        -- 制約が既に存在する場合はスキップ
        NULL;
END $$;

-- ============================================================
-- 3. インデックスの作成
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_auto_order_templates_user_id ON auto_order_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_order_run_items_run_id ON auto_order_run_items(run_id);
CREATE INDEX IF NOT EXISTS idx_auto_order_run_items_user_id ON auto_order_run_items(user_id);

-- ============================================================
-- 4. トリガー（updated_at自動更新）
-- ============================================================

-- updated_atを自動更新する関数（既に存在する場合はスキップ）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガーの作成（既に存在する場合はスキップ）
DROP TRIGGER IF EXISTS update_order_deadlines_updated_at ON order_deadlines;
CREATE TRIGGER update_order_deadlines_updated_at BEFORE UPDATE ON order_deadlines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_auto_order_templates_updated_at ON auto_order_templates;
CREATE TRIGGER update_auto_order_templates_updated_at BEFORE UPDATE ON auto_order_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 5. RLS（Row Level Security）の有効化
-- ============================================================

ALTER TABLE order_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_order_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_order_run_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. RLSポリシーの作成
-- ============================================================

-- 6.1 order_deadlines（管理者のみCRUD、一般ユーザーは参照のみ）
DO $$
BEGIN
    -- 管理者のみCRUD
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'order_deadlines' 
        AND policyname = 'order_deadlines_all_admin'
    ) THEN
        CREATE POLICY "order_deadlines_all_admin"
            ON order_deadlines FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM (
                        SELECT id, role, is_active 
                        FROM users_profile 
                        UNION ALL
                        SELECT id, role, is_active 
                        FROM profiles
                    ) AS up
                    WHERE up.id = auth.uid() AND up.role = 'admin' AND up.is_active = true
                    LIMIT 1
                )
            );
    END IF;

    -- 一般ユーザー：参照のみ
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'order_deadlines' 
        AND policyname = 'order_deadlines_select'
    ) THEN
        CREATE POLICY "order_deadlines_select"
            ON order_deadlines FOR SELECT
            USING (true);
    END IF;
END $$;

-- 6.2 auto_order_templates（一般ユーザーは自分のテンプレートのみ）
DO $$
BEGIN
    -- 一般ユーザー：自分のテンプレートのみ参照
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'auto_order_templates' 
        AND policyname = 'auto_order_templates_select_own'
    ) THEN
        CREATE POLICY "auto_order_templates_select_own"
            ON auto_order_templates FOR SELECT
            USING (auth.uid() = user_id);
    END IF;

    -- 一般ユーザー：自分のテンプレートのみ作成
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'auto_order_templates' 
        AND policyname = 'auto_order_templates_insert_own'
    ) THEN
        CREATE POLICY "auto_order_templates_insert_own"
            ON auto_order_templates FOR INSERT
            WITH CHECK (auth.uid() = user_id);
    END IF;

    -- 一般ユーザー：自分のテンプレートのみ更新
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'auto_order_templates' 
        AND policyname = 'auto_order_templates_update_own'
    ) THEN
        CREATE POLICY "auto_order_templates_update_own"
            ON auto_order_templates FOR UPDATE
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;

    -- 一般ユーザー：自分のテンプレートのみ削除
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'auto_order_templates' 
        AND policyname = 'auto_order_templates_delete_own'
    ) THEN
        CREATE POLICY "auto_order_templates_delete_own"
            ON auto_order_templates FOR DELETE
            USING (auth.uid() = user_id);
    END IF;

    -- 管理者：全テンプレートを参照可能
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'auto_order_templates' 
        AND policyname = 'auto_order_templates_select_admin'
    ) THEN
        CREATE POLICY "auto_order_templates_select_admin"
            ON auto_order_templates FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM (
                        SELECT id, role, is_active 
                        FROM users_profile 
                        UNION ALL
                        SELECT id, role, is_active 
                        FROM profiles
                    ) AS up
                    WHERE up.id = auth.uid() AND up.role = 'admin' AND up.is_active = true
                    LIMIT 1
                )
            );
    END IF;
END $$;

-- 6.3 auto_order_run_items（管理者のみ参照）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'auto_order_run_items' 
        AND policyname = 'auto_order_run_items_all_admin'
    ) THEN
        CREATE POLICY "auto_order_run_items_all_admin"
            ON auto_order_run_items FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM (
                        SELECT id, role, is_active 
                        FROM users_profile 
                        UNION ALL
                        SELECT id, role, is_active 
                        FROM profiles
                    ) AS up
                    WHERE up.id = auth.uid() AND up.role = 'admin' AND up.is_active = true
                    LIMIT 1
                )
            );
    END IF;
END $$;

-- ============================================================
-- 7. 実行後の確認
-- ============================================================
-- 以下のSQLで作成されたテーブルを確認してください：
/*
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
ORDER BY table_name;
*/

-- 期待される結果：13テーブル（既存10 + 新規3）
-- - order_deadlines
-- - auto_order_templates
-- - auto_order_run_items

