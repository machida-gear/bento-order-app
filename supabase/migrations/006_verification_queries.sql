-- ============================================================
-- 不足テーブル作成後の確認用SQL
-- ============================================================

-- ============================================================
-- 1. テーブル数の確認（13個になるはず）
-- ============================================================
SELECT 
    COUNT(*) as table_count,
    '期待値: 13個' as expected
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE';

-- ============================================================
-- 2. 全テーブル一覧（アルファベット順）
-- ============================================================
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ============================================================
-- 3. 新規作成されたテーブルの確認
-- ============================================================
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.table_name) as column_count,
    CASE 
        WHEN table_name = 'order_deadlines' THEN '日別締切時刻'
        WHEN table_name = 'auto_order_templates' THEN '自動注文テンプレート'
        WHEN table_name = 'auto_order_run_items' THEN '自動注文実行アイテム'
        ELSE 'その他'
    END as description
FROM information_schema.tables t
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name IN ('order_deadlines', 'auto_order_templates', 'auto_order_run_items')
ORDER BY table_name;

-- ============================================================
-- 4. 新規テーブルのカラム情報
-- ============================================================
SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.character_maximum_length,
    c.is_nullable,
    c.column_default
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND t.table_name IN ('order_deadlines', 'auto_order_templates', 'auto_order_run_items')
ORDER BY t.table_name, c.ordinal_position;

-- ============================================================
-- 5. 外部キー制約の確認
-- ============================================================
SELECT
    tc.table_name AS "テーブル名",
    kcu.column_name AS "カラム名",
    ccu.table_name AS "参照先テーブル",
    ccu.column_name AS "参照先カラム",
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

-- ============================================================
-- 6. インデックスの確認
-- ============================================================
SELECT 
    tablename AS "テーブル名",
    indexname AS "インデックス名",
    indexdef AS "定義"
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN ('order_deadlines', 'auto_order_templates', 'auto_order_run_items')
ORDER BY tablename, indexname;

-- ============================================================
-- 7. RLS（Row Level Security）の有効化確認
-- ============================================================
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

-- ============================================================
-- 8. RLSポリシーの確認
-- ============================================================
SELECT 
    schemaname AS "スキーマ",
    tablename AS "テーブル名",
    policyname AS "ポリシー名",
    permissive AS "許可/制限",
    roles AS "ロール",
    cmd AS "操作",
    qual AS "USING句",
    with_check AS "WITH CHECK句"
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN ('order_deadlines', 'auto_order_templates', 'auto_order_run_items')
ORDER BY tablename, policyname;

-- ============================================================
-- 9. トリガーの確認
-- ============================================================
SELECT 
    trigger_name AS "トリガー名",
    event_object_table AS "テーブル名",
    event_manipulation AS "イベント",
    action_timing AS "タイミング",
    action_statement AS "アクション"
FROM information_schema.triggers
WHERE trigger_schema = 'public'
    AND event_object_table IN ('order_deadlines', 'auto_order_templates', 'auto_order_run_items')
ORDER BY event_object_table, trigger_name;

-- ============================================================
-- 10. 001_initial_schema.sqlで定義されている全テーブルの存在確認
-- ============================================================
WITH expected_tables AS (
    SELECT unnest(ARRAY[
        'users_profile',
        'vendors',
        'menus',
        'menu_prices',
        'order_days',
        'order_deadlines',
        'orders',
        'closing_periods',
        'operation_logs',
        'auto_order_settings',
        'auto_order_templates',
        'auto_order_runs',
        'auto_order_run_items'
    ]) AS table_name
),
existing_tables AS (
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
)
SELECT 
    et.table_name AS "期待されるテーブル名",
    CASE 
        WHEN EXISTS (SELECT 1 FROM existing_tables WHERE table_name = et.table_name) THEN '✅ 存在'
        WHEN EXISTS (SELECT 1 FROM existing_tables WHERE table_name = 'profiles' AND et.table_name = 'users_profile') THEN '✅ 存在（別名: profiles）'
        WHEN EXISTS (SELECT 1 FROM existing_tables WHERE table_name = 'menu_items' AND et.table_name = 'menus') THEN '✅ 存在（別名: menu_items）'
        WHEN EXISTS (SELECT 1 FROM existing_tables WHERE table_name = 'order_calendar' AND et.table_name = 'order_days') THEN '✅ 存在（別名: order_calendar）'
        WHEN EXISTS (SELECT 1 FROM existing_tables WHERE table_name = 'audit_logs' AND et.table_name = 'operation_logs') THEN '✅ 存在（別名: audit_logs）'
        WHEN EXISTS (SELECT 1 FROM existing_tables WHERE table_name = 'auto_order_configs' AND et.table_name = 'auto_order_settings') THEN '✅ 存在（別名: auto_order_configs）'
        ELSE '❌ 不足'
    END AS "状態"
FROM expected_tables et
ORDER BY et.table_name;

-- ============================================================
-- 11. ENUM型の確認
-- ============================================================
SELECT 
    typname AS "ENUM型名",
    oid,
    (SELECT string_agg(enumlabel, ', ' ORDER BY enumsortorder) 
     FROM pg_enum 
     WHERE enumtypid = t.oid) AS "値の一覧"
FROM pg_type t
WHERE typname IN ('user_role', 'order_status', 'auto_order_run_status')
ORDER BY typname;

-- ============================================================
-- 12. ヘルパー関数の確認
-- ============================================================
SELECT 
    routine_name AS "関数名",
    routine_type AS "種類",
    data_type AS "戻り値の型"
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name IN ('get_menu_price_id', 'get_cutoff_time', 'is_before_cutoff', 'update_updated_at_column')
ORDER BY routine_name;

