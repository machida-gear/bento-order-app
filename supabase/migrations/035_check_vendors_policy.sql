-- ============================================================
-- vendorsテーブルのRLSポリシー確認と修正
-- ============================================================

-- 1. vendorsテーブルでRLSが有効か確認
SELECT 
    tablename,
    rowsecurity AS rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✅ RLS有効'
        ELSE '❌ RLS無効'
    END AS status
FROM pg_tables
WHERE tablename = 'vendors';

-- 2. vendorsテーブルのRLSポリシー一覧
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
WHERE tablename = 'vendors'
ORDER BY policyname;

-- 3. 問題診断
SELECT 
    CASE 
        WHEN NOT EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE tablename = 'vendors' AND rowsecurity = true
        ) THEN '❌ 問題: vendorsテーブルでRLSが有効になっていません'
        WHEN NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'vendors'
            AND cmd = 'SELECT'
        ) THEN '❌ 問題: vendorsテーブルにSELECTポリシーが存在しません'
        WHEN NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'vendors'
            AND policyname = 'vendors_select_active'
        ) THEN '⚠️ 警告: vendors_select_activeポリシーが存在しません（他のポリシーが動作している可能性があります）'
        ELSE '✅ RLSポリシーは正しく設定されています'
    END AS diagnosis;
