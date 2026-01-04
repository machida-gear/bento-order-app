-- ================================================================================
-- 011_allow_profile_self_insert.sql
-- 新規ユーザーが自分のprofileを作成できるようにRLSポリシーを追加
-- ================================================================================

-- 既存のポリシーを確認
-- SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- 新規ユーザーが自分のprofileを作成できるポリシーを追加
-- （サインアップ時に自分のIDでprofileを作成する場合のみ許可）
CREATE POLICY "users_can_insert_own_profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 確認用コメント
COMMENT ON POLICY "users_can_insert_own_profile" ON profiles IS
  '新規ユーザーが自分のprofileレコードを作成できるようにする（サインアップ時）';

-- 確認SQL
-- SELECT 
--   schemaname, 
--   tablename, 
--   policyname, 
--   permissive, 
--   roles, 
--   cmd, 
--   qual, 
--   with_check
-- FROM pg_policies 
-- WHERE tablename = 'profiles'
-- ORDER BY policyname;

