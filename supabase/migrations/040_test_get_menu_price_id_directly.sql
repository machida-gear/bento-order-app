-- ============================================================
-- get_menu_price_id関数を直接テスト
-- ============================================================

-- 1. 関数の定義を確認（menu_item_idを使用しているか）
SELECT 
    pg_get_functiondef(oid) AS function_definition
FROM pg_proc
WHERE proname = 'get_menu_price_id';

-- 2. メニューID=23で関数をテスト
SELECT get_menu_price_id(23, '2025-12-30'::DATE) AS price_id;

-- 3. エラーが発生する場合、手動で価格IDを取得
SELECT 
    id AS price_id,
    menu_item_id,
    price,
    start_date,
    end_date
FROM menu_prices
WHERE menu_item_id = 23
    AND start_date <= '2025-12-30'::DATE
    AND (end_date IS NULL OR end_date >= '2025-12-30'::DATE)
ORDER BY start_date DESC
LIMIT 1;
