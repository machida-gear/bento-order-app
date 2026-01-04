-- ============================================================
-- 不足テーブル作成パッチSQL v2（本番環境用）
-- 既存テーブルを壊さずに、不足している3テーブルのみを作成
-- ============================================================
--
-- 【対象テーブル】
-- 1. order_deadlines - 日別締切時刻
-- 2. auto_order_templates - 自動注文テンプレート
-- 3. auto_order_run_items - 自動注文実行アイテム
--
-- 【重要】
-- - 外部キー制約は参照先テーブルの構造に依存するため、
--   テーブル作成後に別途追加します（エラー時はスキップして続行）
-- - DROP/RECREATEは使用しません
--
-- ============================================================

-- ============================================================
-- STEP 0: 既存テーブルの構造確認（情報表示のみ）
-- ============================================================

-- order_calendarの主キーカラム名を確認
SELECT 
    'order_calendar の主キー情報:' as info,
    kcu.column_name as pk_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public' 
    AND tc.table_name = 'order_calendar' 
    AND tc.constraint_type = 'PRIMARY KEY';

-- ============================================================
-- STEP 1: order_deadlines（日別締切時刻）の作成
-- ============================================================

-- テーブル作成（外部キー制約なし）
CREATE TABLE IF NOT EXISTS order_deadlines (
    date DATE PRIMARY KEY,
    cutoff_time TIME NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- STEP 2: auto_order_templates（自動注文テンプレート）の作成
-- ============================================================

-- テーブル作成（外部キー制約なし）
CREATE TABLE IF NOT EXISTS auto_order_templates (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    menu_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    day_of_week INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT valid_day_of_week CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6))
);

-- ============================================================
-- STEP 3: auto_order_run_items（自動注文実行アイテム）の作成
-- ============================================================

-- テーブル作成（外部キー制約なし）
CREATE TABLE IF NOT EXISTS auto_order_run_items (
    id SERIAL PRIMARY KEY,
    run_id INTEGER NOT NULL,
    user_id UUID NOT NULL,
    target_date DATE NOT NULL,
    result VARCHAR(50) NOT NULL,
    detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- UNIQUE制約の追加（存在しない場合のみ）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'public' 
        AND table_name = 'auto_order_run_items' 
        AND constraint_name = 'auto_order_run_items_run_id_user_id_key'
    ) THEN
        ALTER TABLE auto_order_run_items ADD CONSTRAINT auto_order_run_items_run_id_user_id_key UNIQUE (run_id, user_id);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- STEP 4: 外部キー制約の追加（エラー時はスキップして続行）
-- ============================================================

-- 4.1 auto_order_templates -> profiles (user_id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'public' 
        AND table_name = 'auto_order_templates' 
        AND constraint_name = 'auto_order_templates_user_id_fkey'
    ) THEN
        ALTER TABLE auto_order_templates 
        ADD CONSTRAINT auto_order_templates_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ auto_order_templates_user_id_fkey を追加しました';
    ELSE
        RAISE NOTICE '⏭️ auto_order_templates_user_id_fkey は既に存在します';
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE '⚠️ profiles テーブルが見つかりません。FKをスキップします。';
    WHEN undefined_column THEN
        RAISE NOTICE '⚠️ profiles.id カラムが見つかりません。FKをスキップします。';
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️ auto_order_templates_user_id_fkey の追加に失敗: %', SQLERRM;
END $$;

-- 4.2 auto_order_templates -> menu_items (menu_id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'public' 
        AND table_name = 'auto_order_templates' 
        AND constraint_name = 'auto_order_templates_menu_id_fkey'
    ) THEN
        ALTER TABLE auto_order_templates 
        ADD CONSTRAINT auto_order_templates_menu_id_fkey 
        FOREIGN KEY (menu_id) REFERENCES menu_items(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ auto_order_templates_menu_id_fkey を追加しました';
    ELSE
        RAISE NOTICE '⏭️ auto_order_templates_menu_id_fkey は既に存在します';
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE '⚠️ menu_items テーブルが見つかりません。FKをスキップします。';
    WHEN undefined_column THEN
        RAISE NOTICE '⚠️ menu_items.id カラムが見つかりません。FKをスキップします。';
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️ auto_order_templates_menu_id_fkey の追加に失敗: %', SQLERRM;
END $$;

-- 4.3 auto_order_run_items -> auto_order_runs (run_id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'public' 
        AND table_name = 'auto_order_run_items' 
        AND constraint_name = 'auto_order_run_items_run_id_fkey'
    ) THEN
        ALTER TABLE auto_order_run_items 
        ADD CONSTRAINT auto_order_run_items_run_id_fkey 
        FOREIGN KEY (run_id) REFERENCES auto_order_runs(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ auto_order_run_items_run_id_fkey を追加しました';
    ELSE
        RAISE NOTICE '⏭️ auto_order_run_items_run_id_fkey は既に存在します';
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE '⚠️ auto_order_runs テーブルが見つかりません。FKをスキップします。';
    WHEN undefined_column THEN
        RAISE NOTICE '⚠️ auto_order_runs.id カラムが見つかりません。FKをスキップします。';
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️ auto_order_run_items_run_id_fkey の追加に失敗: %', SQLERRM;
END $$;

-- 4.4 auto_order_run_items -> profiles (user_id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'public' 
        AND table_name = 'auto_order_run_items' 
        AND constraint_name = 'auto_order_run_items_user_id_fkey'
    ) THEN
        ALTER TABLE auto_order_run_items 
        ADD CONSTRAINT auto_order_run_items_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE RESTRICT;
        RAISE NOTICE '✅ auto_order_run_items_user_id_fkey を追加しました';
    ELSE
        RAISE NOTICE '⏭️ auto_order_run_items_user_id_fkey は既に存在します';
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE '⚠️ profiles テーブルが見つかりません。FKをスキップします。';
    WHEN undefined_column THEN
        RAISE NOTICE '⚠️ profiles.id カラムが見つかりません。FKをスキップします。';
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️ auto_order_run_items_user_id_fkey の追加に失敗: %', SQLERRM;
END $$;

-- 4.5 order_deadlines -> order_calendar (date)
-- ※ order_calendarの主キーカラム名が不明なため、動的に検出
DO $$
DECLARE
    v_pk_column TEXT;
BEGIN
    -- order_calendarの主キーカラム名を取得
    SELECT kcu.column_name INTO v_pk_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public' 
        AND tc.table_name = 'order_calendar' 
        AND tc.constraint_type = 'PRIMARY KEY'
    LIMIT 1;
    
    IF v_pk_column IS NULL THEN
        RAISE NOTICE '⚠️ order_calendar の主キーが見つかりません。FKをスキップします。';
        RETURN;
    END IF;
    
    RAISE NOTICE 'ℹ️ order_calendar の主キーカラム: %', v_pk_column;
    
    -- order_deadlinesのdateカラムとorder_calendarの主キーが一致するか確認
    IF v_pk_column != 'date' THEN
        RAISE NOTICE '⚠️ order_calendar の主キー(%)と order_deadlines.date が一致しません。FKをスキップします。', v_pk_column;
        RAISE NOTICE '  → 手動で以下を実行してください:';
        RAISE NOTICE '    ALTER TABLE order_deadlines ADD CONSTRAINT order_deadlines_date_fkey';
        RAISE NOTICE '    FOREIGN KEY (date) REFERENCES order_calendar(%) ON DELETE CASCADE;', v_pk_column;
        RETURN;
    END IF;
    
    -- 既存の制約をチェック
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'public' 
        AND table_name = 'order_deadlines' 
        AND constraint_name = 'order_deadlines_date_fkey'
    ) THEN
        EXECUTE format(
            'ALTER TABLE order_deadlines ADD CONSTRAINT order_deadlines_date_fkey FOREIGN KEY (date) REFERENCES order_calendar(%I) ON DELETE CASCADE',
            v_pk_column
        );
        RAISE NOTICE '✅ order_deadlines_date_fkey を追加しました';
    ELSE
        RAISE NOTICE '⏭️ order_deadlines_date_fkey は既に存在します';
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE '⚠️ order_calendar テーブルが見つかりません。FKをスキップします。';
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️ order_deadlines_date_fkey の追加に失敗: %', SQLERRM;
END $$;

-- ============================================================
-- STEP 5: インデックスの作成
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_auto_order_templates_user_id ON auto_order_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_order_run_items_run_id ON auto_order_run_items(run_id);
CREATE INDEX IF NOT EXISTS idx_auto_order_run_items_user_id ON auto_order_run_items(user_id);

-- ============================================================
-- STEP 6: トリガー（updated_at自動更新）
-- ============================================================

-- 関数が存在しない場合のみ作成
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
        RAISE NOTICE '✅ update_updated_at_column 関数を作成しました';
    ELSE
        RAISE NOTICE '⏭️ update_updated_at_column 関数は既に存在します';
    END IF;
END $do$;

-- トリガーの作成
DROP TRIGGER IF EXISTS update_order_deadlines_updated_at ON order_deadlines;
CREATE TRIGGER update_order_deadlines_updated_at BEFORE UPDATE ON order_deadlines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_auto_order_templates_updated_at ON auto_order_templates;
CREATE TRIGGER update_auto_order_templates_updated_at BEFORE UPDATE ON auto_order_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- STEP 7: RLS（Row Level Security）の有効化
-- ============================================================

ALTER TABLE order_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_order_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_order_run_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 8: RLSポリシーの作成
-- ============================================================

-- 8.1 order_deadlinesのRLSポリシー
DO $$
BEGIN
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

-- 8.2 auto_order_templatesのRLSポリシー
DO $$
BEGIN
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

-- 8.3 auto_order_run_itemsのRLSポリシー
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
                    SELECT 1 FROM profiles
                    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
                )
            );
    END IF;
END $$;

-- ============================================================
-- STEP 9: 検証SQL
-- ============================================================

-- 9.1 テーブル存在確認
SELECT 
    COUNT(*) as table_count,
    CASE 
        WHEN COUNT(*) = 13 THEN '✅ 正常（13個）'
        ELSE '⚠️ ' || COUNT(*) || '個（期待値: 13個）'
    END as status
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE';

-- 9.2 新規作成されたテーブルの確認
SELECT 
    table_name,
    '✅ 作成済み' as status
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name IN ('order_deadlines', 'auto_order_templates', 'auto_order_run_items')
ORDER BY table_name;

-- 9.3 外部キー制約の確認
SELECT
    tc.table_name AS "テーブル名",
    kcu.column_name AS "カラム名",
    ccu.table_name AS "参照先テーブル",
    tc.constraint_name AS "制約名"
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

-- 9.4 RLSポリシーの確認
SELECT 
    tablename AS "テーブル名",
    policyname AS "ポリシー名",
    cmd AS "操作"
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN ('order_deadlines', 'auto_order_templates', 'auto_order_run_items')
ORDER BY tablename, policyname;

-- 9.5 全テーブル一覧（最終確認）
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

