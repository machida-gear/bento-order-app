-- ============================================================
-- 既存のメニューアイテムを確認
-- ============================================================

-- 有効なメニューアイテムとその業者を確認
SELECT 
    m.id,
    m.name AS menu_name,
    v.code AS vendor_code,
    v.name AS vendor_name,
    m.is_active
FROM menu_items m
JOIN vendors v ON v.id = m.vendor_id
WHERE m.is_active = true
ORDER BY v.code, m.name;

-- メニュー名の一覧（重複チェック用）
SELECT 
    name,
    COUNT(*) AS count
FROM menu_items
WHERE is_active = true
GROUP BY name
HAVING COUNT(*) > 1;
