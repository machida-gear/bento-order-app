-- ============================================================
-- 不足テーブル作成SQL（本番環境用・安全版）
-- 既存テーブルを壊さずに、不足している3テーブルのみを作成
-- ============================================================
--
-- 【前提確認】
-- 既存テーブル（10個）：
-- - audit_logs (operation_logs相当)
-- - auto_order_configs (auto_order_settings相当)
-- - auto_order_runs
-- - closing_periods
-- - menu_items (menus相当)
-- - menu_prices
-- - order_calendar (order_days相当)
-- - orders
-- - profiles (users_profile相当)
-- - vendors
--
-- 【不足テーブル（3個）】
-- 1. order_deadlines - 日別締切時刻
-- 2. auto_order_templates - 自動注文テンプレート
-- 3. auto_order_run_items - 自動注文実行アイテム
--
-- ============================================================

-- ============================================================
-- 1. order_deadlines（日別締切時刻）の作成
-- ============================================================
-- 依存: order_calendar (既存テーブル名)
-- 注意: 001_initial_schema.sqlでは order_days を参照しているが、
--       既存テーブル名は order_calendar のため、外部キー参照を修正

CREATE TABLE IF NOT EXISTS order_deadlines (
    date DATE PRIMARY KEY,
    cutoff_time TIME NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 外部キー制約の追加（order_calendarを参照）
DO $$
BEGIN
    -- 既存の制約を削除（存在する場合）
    ALTER TABLE order_deadlines DROP CONSTRAINT IF EXISTS order_deadlines_date_fkey;
    
    -- order_calendarへの外部キー制約を追加
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_calendar') THEN
        ALTER TABLE order_deadlines 
        ADD CONSTRAINT order_deadlines_date_fkey 
        FOREIGN KEY (date) REFERENCES order_calendar(date) ON DELETE CASCADE;
    ELSE
        RAISE EXCEPTION 'order_calendarテーブルが見つかりません';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        NULL; -- 制約が既に存在する場合はスキップ
    WHEN OTHERS THEN
        RAISE NOTICE '外部キー制約の追加に失敗しました: %', SQLERRM;
END $$;

-- ============================================================
-- 2. auto_order_templates（自動注文テンプレート）の作成
-- ============================================================
-- 依存: profiles (既存テーブル名、users_profile相当)、menu_items (既存テーブル名、menus相当)
-- 注意: 001_initial_schema.sqlでは users_profile と menus を参照しているが、
--       既存テーブル名は profiles と menu_items のため、外部キー参照を修正

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

-- 外部キー制約の追加（profilesとmenu_itemsを参照）
DO $$
BEGIN
    -- 既存の制約を削除（存在する場合）
    ALTER TABLE auto_order_templates DROP CONSTRAINT IF EXISTS auto_order_templates_user_id_fkey;
    ALTER TABLE auto_order_templates DROP CONSTRAINT IF EXISTS auto_order_templates_menu_id_fkey;
    
    -- profilesへの外部キー制約
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        ALTER TABLE auto_order_templates 
        ADD CONSTRAINT auto_order_templates_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
    ELSE
        RAISE EXCEPTION 'profilesテーブルが見つかりません';
    END IF;
    
    -- menu_itemsへの外部キー制約
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_items') THEN
        ALTER TABLE auto_order_templates 
        ADD CONSTRAINT auto_order_templates_menu_id_fkey 
        FOREIGN KEY (menu_id) REFERENCES menu_items(id) ON DELETE CASCADE;
    ELSE
        RAISE EXCEPTION 'menu_itemsテーブルが見つかりません';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        NULL; -- 制約が既に存在する場合はスキップ
    WHEN OTHERS THEN
        RAISE NOTICE '外部キー制約の追加に失敗しました: %', SQLERRM;
END $$;

-- ============================================================
-- 3. auto_order_run_items（自動注文実行アイテム）の作成
-- ============================================================
-- 依存: auto_order_runs (既存)、profiles (既存テーブル名、users_profile相当)
-- 注意: 001_initial_schema.sqlでは users_profile を参照しているが、
--       既存テーブル名は profiles のため、外部キー参照を修正

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

-- 外部キー制約の追加（auto_order_runsとprofilesを参照）
DO $$
BEGIN
    -- 既存の制約を削除（存在する場合）
    ALTER TABLE auto_order_run_items DROP CONSTRAINT IF EXISTS auto_order_run_items_run_id_fkey;
    ALTER TABLE auto_order_run_items DROP CONSTRAINT IF EXISTS auto_order_run_items_user_id_fkey;
    
    -- auto_order_runsへの外部キー制約
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'auto_order_runs') THEN
        ALTER TABLE auto_order_run_items 
        ADD CONSTRAINT auto_order_run_items_run_id_fkey 
        FOREIGN KEY (run_id) REFERENCES auto_order_runs(id) ON DELETE CASCADE;
    ELSE
        RAISE EXCEPTION 'auto_order_runsテーブルが見つかりません';
    END IF;
    
    -- profilesへの外部キー制約
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        ALTER TABLE auto_order_run_items 
        ADD CONSTRAINT auto_order_run_items_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE RESTRICT;
    ELSE
        RAISE EXCEPTION 'profilesテーブルが見つかりません';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        NULL; -- 制約が既に存在する場合はスキップ
    WHEN OTHERS THEN
        RAISE NOTICE '外部キー制約の追加に失敗しました: %', SQLERRM;
END $$;

-- ============================================================
-- 4. インデックスの作成
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_auto_order_templates_user_id ON auto_order_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_order_run_items_run_id ON auto_order_run_items(run_id);
CREATE INDEX IF NOT EXISTS idx_auto_order_run_items_user_id ON auto_order_run_items(user_id);

-- ============================================================
-- 5. トリガー（updated_at自動更新）
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
-- 6. RLS（Row Level Security）の有効化
-- ============================================================

ALTER TABLE order_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_order_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_order_run_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. RLSポリシーの作成（既存テーブル名に応じて設定）
-- ============================================================

-- 7.1 order_deadlinesのRLSポリシー
DO $$
BEGIN
    -- 管理者のみCRUD（profilesテーブルを参照）
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
                    SELECT 1 FROM profiles
                    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
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

-- 7.2 auto_order_templatesのRLSポリシー
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

    -- 管理者：全テンプレートを参照可能（profilesテーブルを参照）
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
                    SELECT 1 FROM profiles
                    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
                )
            );
    END IF;
END $$;

-- 7.3 auto_order_run_itemsのRLSポリシー
DO $$
BEGIN
    -- 管理者のみ参照可能（profilesテーブルを参照）
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
                    SELECT 1 FROM profiles
                    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
                )
            );
    END IF;
END $$;

-- ============================================================
-- 8. 実行後の確認クエリ
-- ============================================================
-- 以下のSQLで作成されたテーブルを確認してください：
/*
-- テーブル数の確認（13個になるはず）
SELECT COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE';

-- 新規作成されたテーブルの確認
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name IN ('order_deadlines', 'auto_order_templates', 'auto_order_run_items')
ORDER BY table_name;

-- 外部キー制約の確認
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name IN ('order_deadlines', 'auto_order_templates', 'auto_order_run_items')
ORDER BY tc.table_name;
*/

