-- ============================================================
-- メニュー表示問題の診断用SQL
-- 新規注文画面で「選択可能なメニューがありません」と表示される原因を確認
-- ============================================================

-- 1. 有効な業者の確認
SELECT 
    '有効な業者' AS check_type,
    COUNT(*) AS count,
    STRING_AGG(name, ', ') AS items
FROM vendors
WHERE is_active = true;

-- 2. 有効なメニューの確認
SELECT 
    '有効なメニュー' AS check_type,
    COUNT(*) AS count,
    STRING_AGG(m.name, ', ') AS items
FROM menu_items m
WHERE m.is_active = true;

-- 3. 業者とメニューの関連確認
SELECT 
    v.id AS vendor_id,
    v.code AS vendor_code,
    v.name AS vendor_name,
    v.is_active AS vendor_active,
    COUNT(m.id) AS menu_count,
    STRING_AGG(m.name, ', ') AS menu_names
FROM vendors v
LEFT JOIN menu_items m ON m.vendor_id = v.id AND m.is_active = true
WHERE v.is_active = true
GROUP BY v.id, v.code, v.name, v.is_active
ORDER BY v.code;

-- 4. メニューと業者の関連が正しく設定されているか確認
SELECT 
    m.id AS menu_id,
    m.name AS menu_name,
    m.is_active AS menu_active,
    m.vendor_id,
    v.code AS vendor_code,
    v.name AS vendor_name,
    v.is_active AS vendor_active,
    CASE 
        WHEN v.id IS NULL THEN '❌ 業者が存在しません'
        WHEN v.is_active = false THEN '❌ 業者が無効です'
        WHEN m.is_active = false THEN '❌ メニューが無効です'
        ELSE '✅ 正常'
    END AS status
FROM menu_items m
LEFT JOIN vendors v ON v.id = m.vendor_id
ORDER BY m.name;

-- 5. 現在の日付以降の価格データの確認
SELECT 
    m.id AS menu_id,
    m.name AS menu_name,
    mp.price,
    mp.start_date,
    mp.end_date,
    CASE 
        WHEN mp.start_date <= CURRENT_DATE 
         AND (mp.end_date IS NULL OR mp.end_date >= CURRENT_DATE) 
        THEN '✅ 有効'
        ELSE '❌ 無効'
    END AS price_status
FROM menu_items m
LEFT JOIN menu_prices mp ON mp.menu_item_id = m.id
WHERE m.is_active = true
ORDER BY m.name, mp.start_date DESC;

-- 6. 問題の診断結果
SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM vendors WHERE is_active = true) = 0 
        THEN '❌ 問題: 有効な業者が存在しません'
        WHEN (SELECT COUNT(*) FROM menu_items WHERE is_active = true) = 0 
        THEN '❌ 問題: 有効なメニューが存在しません'
        WHEN (
            SELECT COUNT(*) 
            FROM menu_items m
            JOIN vendors v ON v.id = m.vendor_id
            WHERE m.is_active = true AND v.is_active = true
        ) = 0 
        THEN '❌ 問題: 有効な業者とメニューの関連が存在しません'
        ELSE '✅ データは存在します（他の原因を確認してください）'
    END AS diagnosis;
