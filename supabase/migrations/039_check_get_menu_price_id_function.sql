-- ============================================================
-- get_menu_price_id関数の定義を確認
-- ============================================================

-- 1. 関数の定義を取得
SELECT pg_get_functiondef(oid) AS function_definition
FROM pg_proc
WHERE proname = 'get_menu_price_id';

-- 2. 関数のパラメータを確認
SELECT 
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
WHERE p.proname = 'get_menu_price_id';

-- 3. 関数をテスト（メニューID=23、日付=2025-12-30）
SELECT get_menu_price_id(23, '2025-12-30'::DATE) AS price_id;

-- 4. メニューID=23の価格データを確認
SELECT 
    id,
    menu_item_id,
    price,
    start_date,
    end_date,
    CASE 
        WHEN start_date <= '2025-12-30'::DATE 
         AND (end_date IS NULL OR end_date >= '2025-12-30'::DATE) 
        THEN '✅ 有効'
        ELSE '❌ 無効'
    END AS status
FROM menu_prices
WHERE menu_item_id = 23
ORDER BY start_date DESC;

-- 5. すべてのメニューの価格データを確認（2025-12-30時点）
SELECT 
    m.id AS menu_id,
    m.name AS menu_name,
    mp.id AS price_id,
    mp.price,
    mp.start_date,
    mp.end_date,
    CASE 
        WHEN mp.start_date <= '2025-12-30'::DATE 
         AND (mp.end_date IS NULL OR mp.end_date >= '2025-12-30'::DATE) 
        THEN '✅ 有効'
        ELSE '❌ 無効'
    END AS price_status
FROM menu_items m
LEFT JOIN menu_prices mp ON mp.menu_item_id = m.id
WHERE m.is_active = true
ORDER BY m.name, mp.start_date DESC;
