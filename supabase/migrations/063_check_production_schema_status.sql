-- ============================================================
-- 本番環境のスキーマ状態確認用SQL
-- 
-- 目的: 本番環境のデータベーススキーマの現在の状態を確認
-- 用途: マイグレーション実行前に、不足しているテーブル・関数・制約を特定
-- 
-- 使用方法:
-- 1. Supabase本番環境のSQL Editorで実行
-- 2. 結果を確認して、不足している項目を特定
-- 3. 必要なマイグレーションを実行
-- ============================================================

-- ============================================================
-- 1. テーブル一覧の確認
-- ============================================================

SELECT 
    '=== テーブル一覧 ===' AS section;

SELECT 
    table_name AS "テーブル名",
    CASE 
        WHEN table_name IN (
            'profiles', 'vendors', 'menu_items', 'menu_prices', 
            'order_calendar', 'orders', 'closing_periods', 
            'audit_logs', 'auto_order_configs', 'auto_order_templates',
            'auto_order_runs', 'auto_order_run_items', 
            'system_settings', 'employee_codes'
        ) THEN '✅ 期待されるテーブル'
        ELSE '⚠️ 予期しないテーブル'
    END AS "状態"
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 期待されるテーブルの存在確認
SELECT 
    '=== 期待されるテーブルの存在確認 ===' AS section;

SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN '✅' ELSE '❌' END AS profiles,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vendors') THEN '✅' ELSE '❌' END AS vendors,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_items') THEN '✅' ELSE '❌' END AS menu_items,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_prices') THEN '✅' ELSE '❌' END AS menu_prices,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_calendar') THEN '✅' ELSE '❌' END AS order_calendar,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN '✅' ELSE '❌' END AS orders,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'closing_periods') THEN '✅' ELSE '❌' END AS closing_periods,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN '✅' ELSE '❌' END AS audit_logs,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'auto_order_configs') THEN '✅' ELSE '❌' END AS auto_order_configs,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'auto_order_templates') THEN '✅' ELSE '❌' END AS auto_order_templates,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'auto_order_runs') THEN '✅' ELSE '❌' END AS auto_order_runs,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'auto_order_run_items') THEN '✅' ELSE '❌' END AS auto_order_run_items,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_settings') THEN '✅' ELSE '❌' END AS system_settings,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_codes') THEN '✅' ELSE '❌' END AS employee_codes;

-- ============================================================
-- 2. ENUM型の確認
-- ============================================================

SELECT 
    '=== ENUM型の確認 ===' AS section;

SELECT 
    typname AS "ENUM型名",
    CASE 
        WHEN typname IN ('user_role', 'order_status', 'auto_order_run_status') THEN '✅ 期待されるENUM型'
        ELSE '⚠️ 予期しないENUM型'
    END AS "状態",
    array_agg(enumlabel ORDER BY enumsortorder) AS "値の一覧"
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname IN ('user_role', 'order_status', 'auto_order_run_status')
GROUP BY typname
ORDER BY typname;

-- order_statusの値の確認（'cancelled' vs 'canceled'）
SELECT 
    '=== order_status ENUM型の値の確認 ===' AS section;

SELECT 
    enumlabel AS "値",
    CASE 
        WHEN enumlabel = 'ordered' THEN '✅ 注文済み'
        WHEN enumlabel = 'canceled' THEN '✅ キャンセル済み（正しい）'
        WHEN enumlabel = 'cancelled' THEN '⚠️ キャンセル済み（誤り: 2つのl）'
        WHEN enumlabel = 'invalid' THEN '✅ 無効'
        ELSE '⚠️ 予期しない値'
    END AS "状態"
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname = 'order_status'
ORDER BY enumsortorder;

-- ============================================================
-- 3. 外部キー制約の確認（特にorders.user_id）
-- ============================================================

SELECT 
    '=== 外部キー制約の確認（orders.user_id） ===' AS section;

SELECT 
    tc.constraint_name AS "制約名",
    tc.table_name AS "テーブル名",
    kcu.column_name AS "カラム名",
    ccu.table_name AS "参照テーブル名",
    ccu.column_name AS "参照カラム名",
    rc.delete_rule AS "ON DELETE 動作",
    CASE 
        WHEN rc.delete_rule = 'CASCADE' THEN 
            '❌ 問題: ユーザーを物理削除すると注文データも削除されます。会計・集計データが失われる可能性があります。'
        WHEN rc.delete_rule = 'RESTRICT' THEN 
            '✅ 安全: 注文データがあるユーザーは削除できません。データ保護されています。'
        WHEN rc.delete_rule = 'SET NULL' THEN 
            '⚠️ 注意: ユーザーを削除すると、user_idがNULLになります。'
        WHEN rc.delete_rule = 'NO ACTION' THEN 
            '⚠️ 注意: ユーザーを削除しようとするとエラーになります（RESTRICTと似た動作）。'
        ELSE 
            '⚠️ 未知の動作: ' || rc.delete_rule
    END AS "状態"
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc 
    ON tc.constraint_name = rc.constraint_name
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON rc.constraint_name = ccu.constraint_name
WHERE tc.table_schema = 'public'
    AND tc.table_name = 'orders'
    AND kcu.column_name = 'user_id'
    AND tc.constraint_type = 'FOREIGN KEY';

-- 外部キー制約が見つからない場合の確認
SELECT 
    '=== orders.user_idの外部キー制約の存在確認 ===' AS section;

SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.table_constraints tc
            JOIN information_schema.referential_constraints rc 
                ON tc.constraint_name = rc.constraint_name
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_schema = 'public'
                AND tc.table_name = 'orders'
                AND kcu.column_name = 'user_id'
                AND tc.constraint_type = 'FOREIGN KEY'
        ) THEN '✅ 外部キー制約が存在します'
        ELSE '❌ 外部キー制約が存在しません（062_fix_orders_user_id_fk_to_restrict.sqlを実行してください）'
    END AS "状態";

-- ============================================================
-- 4. RLS（Row Level Security）の確認
-- ============================================================

SELECT 
    '=== RLS有効化の確認 ===' AS section;

SELECT 
    tablename AS "テーブル名",
    CASE 
        WHEN rowsecurity = true THEN '✅ RLS有効'
        ELSE '❌ RLS無効（セキュリティリスク）'
    END AS "状態"
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN (
        'profiles', 'vendors', 'menu_items', 'menu_prices', 
        'order_calendar', 'orders', 'closing_periods', 
        'audit_logs', 'auto_order_configs', 'auto_order_templates',
        'auto_order_runs', 'auto_order_run_items', 
        'system_settings', 'employee_codes'
    )
ORDER BY tablename;

-- ============================================================
-- 5. ヘルパー関数の確認
-- ============================================================

SELECT 
    '=== ヘルパー関数の存在確認 ===' AS section;

SELECT 
    routine_name AS "関数名",
    routine_type AS "種類",
    CASE 
        WHEN routine_name IN ('get_menu_price_id', 'get_cutoff_time', 'is_before_cutoff') THEN '✅ 期待される関数'
        ELSE '⚠️ 予期しない関数'
    END AS "状態"
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name IN ('get_menu_price_id', 'get_cutoff_time', 'is_before_cutoff')
ORDER BY routine_name;

-- 各関数の存在確認
SELECT 
    '=== 各ヘルパー関数の存在確認 ===' AS section;

SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'get_menu_price_id') THEN '✅' ELSE '❌' END AS get_menu_price_id,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'get_cutoff_time') THEN '✅' ELSE '❌' END AS get_cutoff_time,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'is_before_cutoff') THEN '✅' ELSE '❌' END AS is_before_cutoff;

-- ============================================================
-- 6. システム設定テーブルの確認
-- ============================================================

SELECT 
    '=== システム設定テーブルの確認 ===' AS section;

SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_settings') THEN '✅ system_settingsテーブルが存在します'
        ELSE '❌ system_settingsテーブルが存在しません（051_create_system_settings_table.sqlを実行してください）'
    END AS "状態";

-- システム設定の初期データ確認
SELECT 
    '=== システム設定の初期データ確認 ===' AS section;

SELECT 
    id,
    default_deadline_time,
    closing_day,
    CASE WHEN closing_day IS NULL THEN '月末締め' ELSE closing_day::text || '日締め' END AS "締め日設定",
    max_order_days_ahead,
    CASE WHEN day_of_week_settings IS NOT NULL THEN '✅ 設定あり' ELSE '❌ 設定なし' END AS "曜日設定",
    CASE WHEN company_name IS NOT NULL THEN '✅ 設定あり' ELSE '❌ 設定なし' END AS "会社情報"
FROM system_settings
WHERE id = 1;

-- ============================================================
-- 7. 社員コードマスターテーブルの確認
-- ============================================================

SELECT 
    '=== 社員コードマスターテーブルの確認 ===' AS section;

SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_codes') THEN '✅ employee_codesテーブルが存在します'
        ELSE '❌ employee_codesテーブルが存在しません（059_add_employee_codes_and_invitation_code.sqlを実行してください）'
    END AS "状態";

-- ============================================================
-- 8. 重要なカラムの確認（実際のDB構造との整合性）
-- ============================================================

SELECT 
    '=== 重要なカラムの確認 ===' AS section;

-- profilesテーブルのカラム確認
SELECT 
    'profilesテーブルのカラム' AS "テーブル",
    column_name AS "カラム名",
    data_type AS "データ型",
    CASE 
        WHEN column_name = 'full_name' THEN '✅ 正しい（nameではなくfull_name）'
        WHEN column_name = 'name' THEN '⚠️ 古いカラム名（full_nameに変更が必要）'
        ELSE '✅'
    END AS "状態"
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'profiles'
    AND column_name IN ('name', 'full_name')
ORDER BY column_name;

-- ordersテーブルのカラム確認
SELECT 
    'ordersテーブルのカラム' AS "テーブル",
    column_name AS "カラム名",
    data_type AS "データ型",
    CASE 
        WHEN column_name = 'menu_item_id' THEN '✅ 正しい（menu_idではなくmenu_item_id）'
        WHEN column_name = 'menu_id' THEN '⚠️ 古いカラム名（menu_item_idに変更が必要）'
        WHEN column_name = 'unit_price_snapshot' THEN '✅ 価格スナップショットあり'
        WHEN column_name = 'source' THEN '✅ 注文元情報あり'
        ELSE '✅'
    END AS "状態"
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'orders'
    AND column_name IN ('menu_id', 'menu_item_id', 'unit_price_snapshot', 'source')
ORDER BY column_name;

-- order_calendarテーブルのカラム確認
SELECT 
    'order_calendarテーブルのカラム' AS "テーブル",
    column_name AS "カラム名",
    data_type AS "データ型",
    CASE 
        WHEN column_name = 'target_date' THEN '✅ 正しい（dateではなくtarget_date）'
        WHEN column_name = 'date' THEN '⚠️ 古いカラム名（target_dateに変更が必要）'
        WHEN column_name = 'deadline_time' THEN '✅ 締切時刻あり'
        WHEN column_name = 'note' THEN '✅ 備考あり（special_noteではなくnote）'
        WHEN column_name = 'special_note' THEN '⚠️ 古いカラム名（noteに変更が必要）'
        ELSE '✅'
    END AS "状態"
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'order_calendar'
    AND column_name IN ('date', 'target_date', 'deadline_time', 'note', 'special_note')
ORDER BY column_name;

-- ============================================================
-- 9. インデックスの確認（主要なもの）
-- ============================================================

SELECT 
    '=== 主要なインデックスの確認 ===' AS section;

SELECT 
    tablename AS "テーブル名",
    indexname AS "インデックス名",
    indexdef AS "定義"
FROM pg_indexes
WHERE schemaname = 'public'
    AND (
        indexname LIKE '%_pkey' OR  -- 主キー
        indexname LIKE '%_fkey' OR   -- 外部キー
        indexname LIKE '%_unique' OR -- UNIQUE制約
        indexname LIKE 'idx_%'       -- カスタムインデックス
    )
    AND tablename IN (
        'profiles', 'vendors', 'menu_items', 'menu_prices', 
        'order_calendar', 'orders', 'closing_periods', 
        'audit_logs', 'auto_order_configs', 'auto_order_templates',
        'auto_order_runs', 'auto_order_run_items', 
        'system_settings', 'employee_codes'
    )
ORDER BY tablename, indexname;

-- ============================================================
-- 10. まとめ: マイグレーション実行の推奨事項
-- ============================================================

SELECT 
    '=== マイグレーション実行の推奨事項 ===' AS section;

SELECT 
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_settings') THEN 
            '❌ 051_create_system_settings_table.sql を実行してください'
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_codes') THEN 
            '❌ 059_add_employee_codes_and_invitation_code.sql を実行してください'
        WHEN NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints tc
            JOIN information_schema.referential_constraints rc 
                ON tc.constraint_name = rc.constraint_name
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_schema = 'public'
                AND tc.table_name = 'orders'
                AND kcu.column_name = 'user_id'
                AND tc.constraint_type = 'FOREIGN KEY'
                AND rc.delete_rule = 'RESTRICT'
        ) THEN 
            '❌ 062_fix_orders_user_id_fk_to_restrict.sql を実行してください（データ保護のため重要）'
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'get_menu_price_id') THEN 
            '❌ ヘルパー関数が不足しています。001_initial_schema.sql または 038_fix_get_menu_price_id_function.sql を実行してください'
        ELSE 
            '✅ 主要なマイグレーションは適用済みのようです。詳細は上記の結果を確認してください。'
    END AS "推奨事項";
