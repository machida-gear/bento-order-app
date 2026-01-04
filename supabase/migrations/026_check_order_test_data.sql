-- ============================================================
-- 注文機能動作確認用：現在のデータベース状態を確認
-- ============================================================

-- 0. テーブル構造の確認（デバッグ用）
-- menu_pricesテーブルのカラム名を確認
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'menu_prices'
ORDER BY ordinal_position;

-- menu_itemsテーブルのカラム名を確認
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('menu_items', 'menus')
ORDER BY table_name, ordinal_position;

-- 1. 有効な業者の確認
SELECT 
    id,
    code,
    name,
    is_active
FROM vendors
WHERE is_active = true
ORDER BY code;

-- 2. 有効なメニューの確認（業者別）
SELECT 
    v.code AS vendor_code,
    v.name AS vendor_name,
    m.id AS menu_id,
    m.name AS menu_name,
    m.is_active
FROM vendors v
JOIN menu_items m ON m.vendor_id = v.id
WHERE v.is_active = true AND m.is_active = true
ORDER BY v.code, m.name;

-- 3. 現在の日付以降の有効な価格の確認
SELECT 
    m.id AS menu_id,
    m.name AS menu_name,
    mp.id AS price_id,
    mp.price,
    mp.start_date,
    mp.end_date
FROM menu_items m
JOIN menu_prices mp ON mp.menu_item_id = m.id
WHERE m.is_active = true
  AND mp.start_date <= CURRENT_DATE
  AND (mp.end_date IS NULL OR mp.end_date >= CURRENT_DATE)
ORDER BY m.name, mp.start_date DESC;

-- 4. 現在の日付以降の注文可能日の確認
SELECT 
    target_date,
    is_available,
    deadline_time,
    note
FROM order_calendar
WHERE target_date >= CURRENT_DATE
ORDER BY target_date
LIMIT 30;

-- 5. 今日の注文可能日と締切時刻の確認
SELECT 
    target_date,
    is_available,
    deadline_time,
    note,
    CASE 
        WHEN target_date = CURRENT_DATE AND deadline_time IS NOT NULL THEN
            CASE 
                WHEN CURRENT_TIME < deadline_time THEN '締切前'
                ELSE '締切済み'
            END
        WHEN target_date > CURRENT_DATE THEN '未来の日付'
        ELSE '過去の日付'
    END AS status
FROM order_calendar
WHERE target_date >= CURRENT_DATE - INTERVAL '1 day'
ORDER BY target_date
LIMIT 7;
