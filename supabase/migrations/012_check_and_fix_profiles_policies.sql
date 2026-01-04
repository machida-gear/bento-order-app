-- ================================================================================
-- 012_check_and_fix_profiles_policies.sql
-- profiles テーブルの既存ポリシーを確認し、必要に応じて修正
-- ================================================================================

-- 1. 既存のポリシーを確認
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd AS command,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- 2. INSERT用のポリシーが存在するか確認
-- もし "users_can_insert_own_profile" や類似のINSERTポリシーが無い場合は、
-- 以下のDO ブロックで条件付きで作成

DO $$
BEGIN
  -- INSERT用のポリシーが存在しない場合のみ作成
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND cmd = 'INSERT'
    AND policyname = 'users_can_insert_own_profile'
  ) THEN
    -- ポリシーを作成
    CREATE POLICY "users_can_insert_own_profile"
      ON profiles FOR INSERT
      WITH CHECK (auth.uid() = id);
    
    RAISE NOTICE '✅ ポリシー "users_can_insert_own_profile" を作成しました';
  ELSE
    RAISE NOTICE 'ℹ️ ポリシー "users_can_insert_own_profile" は既に存在します';
  END IF;
  
  -- 念のため、一般ユーザーがINSERTできるポリシーが他にあるか確認
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND cmd = 'INSERT'
  ) THEN
    RAISE NOTICE '✅ profiles テーブルにINSERT用のポリシーが設定されています';
  ELSE
    RAISE NOTICE '⚠️ profiles テーブルにINSERT用のポリシーがありません';
  END IF;
END $$;

-- 3. RLSが有効になっているか確認
SELECT 
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE tablename = 'profiles';


