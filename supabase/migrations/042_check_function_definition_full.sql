-- ============================================================
-- get_menu_price_id関数の定義を完全に確認
-- ============================================================

-- 1. 関数の定義を取得（改行を含む完全な定義）
SELECT 
    pg_get_functiondef(oid) AS function_definition
FROM pg_proc
WHERE proname = 'get_menu_price_id';

-- 2. 関数の定義からWHERE句の部分を抽出して確認
SELECT 
    CASE 
        WHEN pg_get_functiondef(oid) LIKE '%WHERE menu_id =%' 
         AND pg_get_functiondef(oid) NOT LIKE '%WHERE menu_item_id =%'
        THEN '❌ 問題: 関数はmenu_idを使用しています。038のSQLを実行して修正してください。'
        WHEN pg_get_functiondef(oid) LIKE '%WHERE menu_item_id =%'
        THEN '✅ 正常: 関数はmenu_item_idを使用しています。'
        ELSE '⚠️ 警告: 関数の定義を確認できませんでした。'
    END AS function_status,
    CASE 
        WHEN pg_get_functiondef(oid) LIKE '%WHERE menu_id =%' 
         AND pg_get_functiondef(oid) NOT LIKE '%WHERE menu_item_id =%'
        THEN 'menu_id'
        WHEN pg_get_functiondef(oid) LIKE '%WHERE menu_item_id =%'
        THEN 'menu_item_id'
        ELSE 'unknown'
    END AS column_used
FROM pg_proc
WHERE proname = 'get_menu_price_id';

-- 3. 関数を直接テスト（エラーが発生するか確認）
SELECT get_menu_price_id(23, '2025-12-30'::DATE) AS price_id;
