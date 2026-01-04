-- ============================================================
-- 型の不一致を確認するためのSQL
-- ============================================================

-- 1. menu_itemsテーブルのIDカラムの型を確認
SELECT 
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'menu_items'
    AND column_name = 'id';

-- 2. menu_pricesテーブルのカラム情報を確認
SELECT 
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'menu_prices'
    ORDER BY ordinal_position;

-- 3. get_menu_price_id関数の引数の型を確認
SELECT 
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS return_type,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.proname = 'get_menu_price_id';

-- 4. 実際のメニューIDと価格IDのサンプルを確認
SELECT 
    mi.id AS menu_item_id,
    mi.name AS menu_name,
    mp.id AS menu_price_id,
    mp.price,
    mp.start_date,
    mp.end_date
FROM menu_items mi
LEFT JOIN menu_prices mp ON mp.menu_item_id = mi.id
WHERE mi.is_active = true
LIMIT 5;
