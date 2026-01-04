-- ============================================================
-- 不足テーブル作成パッチSQL（本番環境用）
-- 既存テーブルを壊さずに、不足している3テーブルのみを作成
-- ============================================================
--
-- 【対象テーブル】
-- 1. order_deadlines - 日別締切時刻
-- 2. auto_order_templates - 自動注文テンプレート
-- 3. auto_order_run_items - 自動注文実行アイテム
--
-- 【参照先テーブル名の修正】
-- - order_days -> order_calendar
-- - users_profile -> profiles
-- - menus -> menu_items
--
-- ============================================================

-- ============================================================
-- 1. order_deadlines（日別締切時刻）の作成
-- ============================================================
-- 001_initial_schema.sql 86-91行目より抜粋
-- 参照先: order_days -> order_calendar に修正

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
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'public' 
        AND table_name = 'order_deadlines' 
        AND constraint_name = 'order_deadlines_date_fkey'
    ) THEN
        ALTER TABLE order_deadlines DROP CONSTRAINT order_deadlines_date_fkey;
    END IF;
    
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
        NULL;
    WHEN OTHERS THEN
        RAISE;
END $$;

-- ============================================================
-- 2. auto_order_templates（自動注文テンプレート）の作成
-- ============================================================
-- 001_initial_schema.sql 138-147行目より抜粋
-- 参照先: users_profile -> profiles、menus -> menu_items に修正

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
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'public' 
        AND table_name = 'auto_order_templates' 
        AND constraint_name = 'auto_order_templates_user_id_fkey'
    ) THEN
        ALTER TABLE auto_order_templates DROP CONSTRAINT auto_order_templates_user_id_fkey;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'public' 
        AND table_name = 'auto_order_templates' 
        AND constraint_name = 'auto_order_templates_menu_id_fkey'
    ) THEN
        ALTER TABLE auto_order_templates DROP CONSTRAINT auto_order_templates_menu_id_fkey;
    END IF;
    
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
        NULL;
    WHEN OTHERS THEN
        RAISE;
END $$;

-- ============================================================
-- 3. auto_order_run_items（自動注文実行アイテム）の作成
-- ============================================================
-- 001_initial_schema.sql 162-171行目より抜粋
-- 参照先: users_profile -> profiles に修正

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
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'public' 
        AND table_name = 'auto_order_run_items' 
        AND constraint_name = 'auto_order_run_items_run_id_fkey'
    ) THEN
        ALTER TABLE auto_order_run_items DROP CONSTRAINT auto_order_run_items_run_id_fkey;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'public' 
        AND table_name = 'auto_order_run_items' 
        AND constraint_name = 'auto_order_run_items_user_id_fkey'
    ) THEN
        ALTER TABLE auto_order_run_items DROP CONSTRAINT auto_order_run_items_user_id_fkey;
    END IF;
    
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
        NULL;
    WHEN OTHERS THEN
        RAISE;
END $$;

-- ============================================================
-- 4. インデックスの作成
-- ============================================================
-- 001_initial_schema.sql 197-199行目より抜粋

CREATE INDEX IF NOT EXISTS idx_auto_order_templates_user_id ON auto_order_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_order_run_items_run_id ON auto_order_run_items(run_id);
CREATE INDEX IF NOT EXISTS idx_auto_order_run_items_user_id ON auto_order_run_items(user_id);

-- ============================================================
-- 5. トリガー（updated_at自動更新）
-- ============================================================
-- 001_initial_schema.sql 206-212行目（関数）、227-228行目、239-240行目より抜粋

-- updated_atを自動更新する関数（存在しない場合のみ作成）
DO $do$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'update_updated_at_column'
    ) THEN
        EXECUTE $exec$
            CREATE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $func$
            BEGIN
                NEW.updated_at = now();
                RETURN NEW;
            END;
            $func$ LANGUAGE plpgsql
        $exec$;
    END IF;
END $do$;

-- order_deadlinesのトリガー（001_initial_schema.sql 227-228行目）
DROP TRIGGER IF EXISTS update_order_deadlines_updated_at ON order_deadlines;
CREATE TRIGGER update_order_deadlines_updated_at BEFORE UPDATE ON order_deadlines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- auto_order_templatesのトリガー（001_initial_schema.sql 239-240行目）
DROP TRIGGER IF EXISTS update_auto_order_templates_updated_at ON auto_order_templates;
CREATE TRIGGER update_auto_order_templates_updated_at BEFORE UPDATE ON auto_order_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 注意: auto_order_run_itemsにはupdated_atカラムがないため、トリガーは不要

-- ============================================================
-- 6. RLS（Row Level Security）の有効化
-- ============================================================
-- 001_initial_schema.sql 251行目、256行目、258行目より抜粋

ALTER TABLE order_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_order_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_order_run_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. RLSポリシーの作成
-- ============================================================
-- 001_initial_schema.sql 364-376行目、480-505行目、524-531行目より抜粋
-- 参照先テーブル名: users_profile -> profiles に修正

-- 7.1 order_deadlinesのRLSポリシー（001_initial_schema.sql 364-376行目）
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

-- 7.2 auto_order_templatesのRLSポリシー（001_initial_schema.sql 480-505行目）
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

    -- 管理者：全テンプレートをCRUD可能（FOR ALL + WITH CHECK）
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'auto_order_templates' 
        AND policyname = 'auto_order_templates_all_admin'
    ) THEN
        CREATE POLICY "auto_order_templates_all_admin"
            ON auto_order_templates FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
                )
            );
    END IF;
END $$;

-- 7.3 auto_order_run_itemsのRLSポリシー（001_initial_schema.sql 524-531行目）
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
-- 8. 検証SQL
-- ============================================================

-- 8.1 テーブル存在確認（13個になるはず）
SELECT 
    COUNT(*) as table_count,
    CASE 
        WHEN COUNT(*) = 13 THEN '✅ 正常（13個）'
        ELSE '❌ 異常（期待値: 13個）'
    END as status
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE';

-- 8.2 新規作成されたテーブルの確認
SELECT 
    table_name,
    CASE 
        WHEN table_name = 'order_deadlines' THEN '✅ 作成済み'
        WHEN table_name = 'auto_order_templates' THEN '✅ 作成済み'
        WHEN table_name = 'auto_order_run_items' THEN '✅ 作成済み'
        ELSE '❌ 未作成'
    END as status
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name IN ('order_deadlines', 'auto_order_templates', 'auto_order_run_items')
ORDER BY table_name;

-- 8.3 外部キー制約の確認
SELECT
    tc.table_name AS "テーブル名",
    kcu.column_name AS "カラム名",
    ccu.table_name AS "参照先テーブル",
    ccu.column_name AS "参照先カラム",
    CASE 
        WHEN ccu.table_name = 'order_calendar' AND tc.table_name = 'order_deadlines' THEN '✅ 正しい'
        WHEN ccu.table_name = 'profiles' AND tc.table_name IN ('auto_order_templates', 'auto_order_run_items') THEN '✅ 正しい'
        WHEN ccu.table_name = 'menu_items' AND tc.table_name = 'auto_order_templates' THEN '✅ 正しい'
        WHEN ccu.table_name = 'auto_order_runs' AND tc.table_name = 'auto_order_run_items' THEN '✅ 正しい'
        ELSE '⚠️ 確認必要'
    END AS "状態"
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
ORDER BY tc.table_name, kcu.column_name;

-- 8.4 インデックスの確認
SELECT 
    tablename AS "テーブル名",
    indexname AS "インデックス名",
    CASE 
        WHEN indexname LIKE 'idx_%' THEN '✅ 作成済み'
        ELSE '⚠️ 確認必要'
    END AS "状態"
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN ('order_deadlines', 'auto_order_templates', 'auto_order_run_items')
ORDER BY tablename, indexname;

-- 8.5 トリガーの確認
SELECT 
    trigger_name AS "トリガー名",
    event_object_table AS "テーブル名",
    CASE 
        WHEN trigger_name LIKE 'update_%_updated_at' THEN '✅ 作成済み'
        ELSE '⚠️ 確認必要'
    END AS "状態"
FROM information_schema.triggers
WHERE trigger_schema = 'public'
    AND event_object_table IN ('order_deadlines', 'auto_order_templates', 'auto_order_run_items')
ORDER BY event_object_table, trigger_name;

-- 8.6 RLS有効化の確認
SELECT 
    tablename AS "テーブル名",
    rowsecurity AS "RLS有効",
    CASE 
        WHEN rowsecurity THEN '✅ 有効'
        ELSE '❌ 無効'
    END AS "状態"
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('order_deadlines', 'auto_order_templates', 'auto_order_run_items')
ORDER BY tablename;

-- 8.7 RLSポリシーの確認
SELECT 
    tablename AS "テーブル名",
    policyname AS "ポリシー名",
    cmd AS "操作",
    CASE 
        WHEN policyname IS NOT NULL THEN '✅ 作成済み'
        ELSE '❌ 未作成'
    END AS "状態"
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN ('order_deadlines', 'auto_order_templates', 'auto_order_run_items')
ORDER BY tablename, policyname;

-- 8.8 全テーブル一覧（最終確認）
SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('order_deadlines', 'auto_order_templates', 'auto_order_run_items') THEN '🆕 新規作成'
        ELSE '既存'
    END AS "種別"
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
ORDER BY 
    CASE WHEN table_name IN ('order_deadlines', 'auto_order_templates', 'auto_order_run_items') THEN 0 ELSE 1 END,
    table_name;

