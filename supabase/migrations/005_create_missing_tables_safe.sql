-- ============================================================
-- 不足テーブルの作成SQL（既存テーブルを壊さずに実行）
-- 既存テーブル名の違いを考慮した安全なバージョン
-- ============================================================
--
-- 【重要】実行前の確認手順：
-- 1. 003_check_existing_tables.sql を実行して既存テーブル構造を確認
-- 2. 既存テーブル名と001_initial_schema.sqlのテーブル名の対応関係を把握
-- 3. 以下のSQLを実行
--
-- ============================================================

-- ============================================================
-- ステップ1: 既存テーブル名の確認（実行前に必ず確認）
-- ============================================================
-- 以下のSQLで既存テーブルを確認してください：
/*
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
ORDER BY table_name;
*/

-- ============================================================
-- ステップ2: 不足テーブルの特定と作成
-- ============================================================

-- 2.1 order_deadlines（日別締切時刻）の作成
-- 依存: order_days または order_calendar
CREATE TABLE IF NOT EXISTS order_deadlines (
    date DATE PRIMARY KEY,
    cutoff_time TIME NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 外部キー制約の追加（既存テーブル名に応じて自動判定）
DO $$
DECLARE
    v_order_days_table TEXT;
BEGIN
    -- order_daysまたはorder_calendarの存在確認
    SELECT table_name INTO v_order_days_table
    FROM information_schema.tables
    WHERE table_schema = 'public'
        AND table_name IN ('order_days', 'order_calendar')
    LIMIT 1;

    IF v_order_days_table IS NOT NULL THEN
        -- 既存の外部キー制約を削除（存在する場合）
        ALTER TABLE order_deadlines DROP CONSTRAINT IF EXISTS order_deadlines_date_fkey;
        
        -- 新しい外部キー制約を追加
        EXECUTE format('ALTER TABLE order_deadlines ADD CONSTRAINT order_deadlines_date_fkey FOREIGN KEY (date) REFERENCES %I(date) ON DELETE CASCADE', v_order_days_table);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        NULL; -- 制約が既に存在する場合はスキップ
    WHEN OTHERS THEN
        RAISE NOTICE '外部キー制約の追加に失敗しました: %', SQLERRM;
END $$;

-- 2.2 auto_order_templates（自動注文テンプレート）の作成
-- 依存: users_profile または profiles、menus または menu_items
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

-- 外部キー制約の追加（既存テーブル名に応じて自動判定）
DO $$
DECLARE
    v_profile_table TEXT;
    v_menu_table TEXT;
BEGIN
    -- users_profileまたはprofilesの確認
    SELECT table_name INTO v_profile_table
    FROM information_schema.tables
    WHERE table_schema = 'public'
        AND table_name IN ('users_profile', 'profiles')
    LIMIT 1;

    -- menusまたはmenu_itemsの確認
    SELECT table_name INTO v_menu_table
    FROM information_schema.tables
    WHERE table_schema = 'public'
        AND table_name IN ('menus', 'menu_items')
    LIMIT 1;

    -- user_idの外部キー制約
    IF v_profile_table IS NOT NULL THEN
        ALTER TABLE auto_order_templates DROP CONSTRAINT IF EXISTS auto_order_templates_user_id_fkey;
        EXECUTE format('ALTER TABLE auto_order_templates ADD CONSTRAINT auto_order_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES %I(id) ON DELETE CASCADE', v_profile_table);
    END IF;

    -- menu_idの外部キー制約
    IF v_menu_table IS NOT NULL THEN
        ALTER TABLE auto_order_templates DROP CONSTRAINT IF EXISTS auto_order_templates_menu_id_fkey;
        EXECUTE format('ALTER TABLE auto_order_templates ADD CONSTRAINT auto_order_templates_menu_id_fkey FOREIGN KEY (menu_id) REFERENCES %I(id) ON DELETE CASCADE', v_menu_table);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
    WHEN OTHERS THEN
        RAISE NOTICE '外部キー制約の追加に失敗しました: %', SQLERRM;
END $$;

-- 2.3 auto_order_run_items（自動注文実行アイテム）の作成
-- 依存: auto_order_runs（既存）、users_profile または profiles
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

-- 外部キー制約の追加（既存テーブル名に応じて自動判定）
DO $$
DECLARE
    v_profile_table TEXT;
BEGIN
    -- auto_order_runsへの参照（既存テーブル）
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'auto_order_runs') THEN
        ALTER TABLE auto_order_run_items DROP CONSTRAINT IF EXISTS auto_order_run_items_run_id_fkey;
        ALTER TABLE auto_order_run_items ADD CONSTRAINT auto_order_run_items_run_id_fkey 
            FOREIGN KEY (run_id) REFERENCES auto_order_runs(id) ON DELETE CASCADE;
    END IF;

    -- users_profileまたはprofilesへの参照
    SELECT table_name INTO v_profile_table
    FROM information_schema.tables
    WHERE table_schema = 'public'
        AND table_name IN ('users_profile', 'profiles')
    LIMIT 1;

    IF v_profile_table IS NOT NULL THEN
        ALTER TABLE auto_order_run_items DROP CONSTRAINT IF EXISTS auto_order_run_items_user_id_fkey;
        EXECUTE format('ALTER TABLE auto_order_run_items ADD CONSTRAINT auto_order_run_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES %I(id) ON DELETE RESTRICT', v_profile_table);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
    WHEN OTHERS THEN
        RAISE NOTICE '外部キー制約の追加に失敗しました: %', SQLERRM;
END $$;

-- ============================================================
-- ステップ3: インデックスの作成
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_auto_order_templates_user_id ON auto_order_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_order_run_items_run_id ON auto_order_run_items(run_id);
CREATE INDEX IF NOT EXISTS idx_auto_order_run_items_user_id ON auto_order_run_items(user_id);

-- ============================================================
-- ステップ4: トリガー（updated_at自動更新）
-- ============================================================

-- updated_atを自動更新する関数（既に存在する場合は上書き）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガーの作成（既に存在する場合は削除して再作成）
DROP TRIGGER IF EXISTS update_order_deadlines_updated_at ON order_deadlines;
CREATE TRIGGER update_order_deadlines_updated_at BEFORE UPDATE ON order_deadlines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_auto_order_templates_updated_at ON auto_order_templates;
CREATE TRIGGER update_auto_order_templates_updated_at BEFORE UPDATE ON auto_order_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ステップ5: RLS（Row Level Security）の有効化
-- ============================================================

ALTER TABLE order_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_order_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_order_run_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ステップ6: RLSポリシーの作成（既存ポリシーをチェック）
-- ============================================================

-- 6.1 order_deadlinesのRLSポリシー
DO $$
DECLARE
    v_profile_table TEXT;
BEGIN
    -- users_profileまたはprofilesの確認
    SELECT table_name INTO v_profile_table
    FROM information_schema.tables
    WHERE table_schema = 'public'
        AND table_name IN ('users_profile', 'profiles')
    LIMIT 1;

    -- 管理者のみCRUD
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'order_deadlines' 
        AND policyname = 'order_deadlines_all_admin'
    ) THEN
        IF v_profile_table = 'users_profile' THEN
            CREATE POLICY "order_deadlines_all_admin"
                ON order_deadlines FOR ALL
                USING (
                    EXISTS (
                        SELECT 1 FROM users_profile
                        WHERE id = auth.uid() AND role = 'admin' AND is_active = true
                    )
                );
        ELSIF v_profile_table = 'profiles' THEN
            CREATE POLICY "order_deadlines_all_admin"
                ON order_deadlines FOR ALL
                USING (
                    EXISTS (
                        SELECT 1 FROM profiles
                        WHERE id = auth.uid() AND role = 'admin' AND is_active = true
                    )
                );
        END IF;
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

-- 6.2 auto_order_templatesのRLSポリシー
DO $$
DECLARE
    v_profile_table TEXT;
BEGIN
    SELECT table_name INTO v_profile_table
    FROM information_schema.tables
    WHERE table_schema = 'public'
        AND table_name IN ('users_profile', 'profiles')
    LIMIT 1;

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
        IF v_profile_table = 'users_profile' THEN
            CREATE POLICY "auto_order_templates_select_admin"
                ON auto_order_templates FOR SELECT
                USING (
                    EXISTS (
                        SELECT 1 FROM users_profile
                        WHERE id = auth.uid() AND role = 'admin' AND is_active = true
                    )
                );
        ELSIF v_profile_table = 'profiles' THEN
            CREATE POLICY "auto_order_templates_select_admin"
                ON auto_order_templates FOR SELECT
                USING (
                    EXISTS (
                        SELECT 1 FROM profiles
                        WHERE id = auth.uid() AND role = 'admin' AND is_active = true
                    )
                );
        END IF;
    END IF;
END $$;

-- 6.3 auto_order_run_itemsのRLSポリシー
DO $$
DECLARE
    v_profile_table TEXT;
BEGIN
    SELECT table_name INTO v_profile_table
    FROM information_schema.tables
    WHERE table_schema = 'public'
        AND table_name IN ('users_profile', 'profiles')
    LIMIT 1;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'auto_order_run_items' 
        AND policyname = 'auto_order_run_items_all_admin'
    ) THEN
        IF v_profile_table = 'users_profile' THEN
            CREATE POLICY "auto_order_run_items_all_admin"
                ON auto_order_run_items FOR ALL
                USING (
                    EXISTS (
                        SELECT 1 FROM users_profile
                        WHERE id = auth.uid() AND role = 'admin' AND is_active = true
                    )
                );
        ELSIF v_profile_table = 'profiles' THEN
            CREATE POLICY "auto_order_run_items_all_admin"
                ON auto_order_run_items FOR ALL
                USING (
                    EXISTS (
                        SELECT 1 FROM profiles
                        WHERE id = auth.uid() AND role = 'admin' AND is_active = true
                    )
                );
        END IF;
    END IF;
END $$;

-- ============================================================
-- ステップ7: 実行後の確認
-- ============================================================
-- 以下のSQLで作成されたテーブルを確認してください：
/*
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
ORDER BY table_name;
*/

-- 期待される結果：13テーブル（既存10 + 新規3）
-- 新規作成されるテーブル：
-- - order_deadlines
-- - auto_order_templates
-- - auto_order_run_items

