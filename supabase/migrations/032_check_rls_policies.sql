-- ============================================================
-- RLSポリシーの確認
-- menu_itemsとvendorsテーブルのRLSポリシーを確認
-- ============================================================

-- 1. menu_itemsテーブルのRLSポリシー確認
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'menu_items'
ORDER BY policyname;

-- 2. vendorsテーブルのRLSポリシー確認
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'vendors'
ORDER BY policyname;

-- 3. RLSが有効かどうか確認
SELECT 
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE tablename IN ('menu_items', 'vendors', 'menus')
ORDER BY tablename;

-- 4. 現在のユーザーでmenu_itemsを取得できるかテスト
-- （このクエリは実際のユーザーコンテキストで実行する必要があります）
SELECT 
    COUNT(*) AS menu_count,
    STRING_AGG(name, ', ') AS menu_names
FROM menu_items
WHERE is_active = true;

-- 5. 現在のユーザーでvendorsを取得できるかテスト
SELECT 
    COUNT(*) AS vendor_count,
    STRING_AGG(name, ', ') AS vendor_names
FROM vendors
WHERE is_active = true;
