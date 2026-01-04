-- ============================================================
-- 認証状態とプロフィールの確認
-- アプリケーションからデータが取得できない原因を特定
-- ============================================================

-- 1. 現在の認証ユーザーを確認（Supabase SQL Editorでは表示されない可能性があります）
SELECT 
    auth.uid() AS current_user_id,
    auth.email() AS current_user_email;

-- 2. プロフィールテーブルのRLSポリシー確認
SELECT 
    policyname,
    cmd AS command,
    qual AS using_expression
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- 3. プロフィールテーブルでRLSが有効か確認
SELECT 
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE tablename = 'profiles';

-- 4. すべてのテーブルのRLS状態を確認
SELECT 
    tablename,
    rowsecurity AS rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✅ RLS有効'
        ELSE '❌ RLS無効'
    END AS status
FROM pg_tables
WHERE tablename IN ('vendors', 'menu_items', 'profiles', 'order_calendar')
ORDER BY tablename;

-- 5. 各テーブルのSELECTポリシー数を確認
SELECT 
    tablename,
    COUNT(*) AS select_policy_count
FROM pg_policies
WHERE tablename IN ('vendors', 'menu_items', 'profiles', 'order_calendar')
AND cmd = 'SELECT'
GROUP BY tablename
ORDER BY tablename;

-- 6. 問題診断
SELECT 
    CASE 
        WHEN NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'vendors' AND cmd = 'SELECT'
        ) THEN '❌ vendorsテーブルにSELECTポリシーが存在しません'
        WHEN NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'menu_items' AND cmd = 'SELECT'
        ) THEN '❌ menu_itemsテーブルにSELECTポリシーが存在しません'
        WHEN NOT EXISTS (
            SELECT 1 FROM pg_tables
            WHERE tablename = 'vendors' AND rowsecurity = true
        ) THEN '❌ vendorsテーブルでRLSが有効になっていません'
        WHEN NOT EXISTS (
            SELECT 1 FROM pg_tables
            WHERE tablename = 'menu_items' AND rowsecurity = true
        ) THEN '❌ menu_itemsテーブルでRLSが有効になっていません'
        ELSE '✅ 基本的な設定は正しいようです（認証状態を確認してください）'
    END AS diagnosis;
