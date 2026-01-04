-- ============================================================
-- menu_itemsテーブルのRLSポリシー確認と検証
-- ============================================================

-- 1. menu_itemsテーブルでRLSが有効か確認
SELECT 
    tablename,
    rowsecurity AS rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✅ RLS有効'
        ELSE '❌ RLS無効'
    END AS status
FROM pg_tables
WHERE tablename = 'menu_items';

-- 2. menu_itemsテーブルのRLSポリシー一覧
SELECT 
    policyname,
    cmd AS command,
    CASE 
        WHEN cmd = 'SELECT' THEN '参照'
        WHEN cmd = 'INSERT' THEN '挿入'
        WHEN cmd = 'UPDATE' THEN '更新'
        WHEN cmd = 'DELETE' THEN '削除'
        WHEN cmd = 'ALL' THEN '全権限'
        ELSE cmd::text
    END AS command_jp,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE tablename = 'menu_items'
ORDER BY policyname;

-- 3. vendorsテーブルのRLSポリシー一覧（参考）
SELECT 
    policyname,
    cmd AS command,
    CASE 
        WHEN cmd = 'SELECT' THEN '参照'
        WHEN cmd = 'INSERT' THEN '挿入'
        WHEN cmd = 'UPDATE' THEN '更新'
        WHEN cmd = 'DELETE' THEN '削除'
        WHEN cmd = 'ALL' THEN '全権限'
        ELSE cmd::text
    END AS command_jp
FROM pg_policies
WHERE tablename = 'vendors'
ORDER BY policyname;

-- 4. 現在のユーザーでmenu_itemsを取得できるかテスト
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

-- 6. 問題診断
SELECT 
    CASE 
        WHEN NOT EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE tablename = 'menu_items' AND rowsecurity = true
        ) THEN '❌ 問題: menu_itemsテーブルでRLSが有効になっていません'
        WHEN NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'menu_items'
            AND cmd = 'SELECT'
        ) THEN '❌ 問題: menu_itemsテーブルにSELECTポリシーが存在しません'
        WHEN NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'menu_items'
            AND policyname = 'menu_items_select_active'
        ) THEN '⚠️ 警告: menu_items_select_activeポリシーが存在しません（他のポリシーが動作している可能性があります）'
        ELSE '✅ RLSポリシーは正しく設定されています'
    END AS diagnosis;
