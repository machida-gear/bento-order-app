-- ================================================================================
-- 013_show_profiles_policies.sql
-- profiles テーブルの全ポリシーを詳細表示
-- ================================================================================

-- profiles テーブルの全ポリシーを表示
SELECT 
  policyname AS "ポリシー名",
  cmd AS "コマンド",
  CASE 
    WHEN cmd = 'SELECT' THEN 'SELECT（読み取り）'
    WHEN cmd = 'INSERT' THEN 'INSERT（作成）'
    WHEN cmd = 'UPDATE' THEN 'UPDATE（更新）'
    WHEN cmd = 'DELETE' THEN 'DELETE（削除）'
    WHEN cmd = '*' THEN 'ALL（全操作）'
    ELSE cmd
  END AS "コマンド（日本語）",
  permissive AS "許可型",
  roles AS "ロール",
  qual AS "USING条件",
  with_check AS "WITH CHECK条件"
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY cmd, policyname;

