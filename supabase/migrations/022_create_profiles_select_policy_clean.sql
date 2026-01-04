-- profilesテーブルのSELECT用RLSポリシーを作成

-- 1. 既存のSELECTポリシーを確認
SELECT 
    policyname,
    cmd,
    qual AS using_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'profiles'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- 2. ユーザーが自分のプロファイルをSELECTできるポリシーを作成
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles' 
        AND policyname = 'users_can_select_own_profile'
    ) THEN
        CREATE POLICY "users_can_select_own_profile"
            ON profiles FOR SELECT
            USING (auth.uid() = id);
        
        RAISE NOTICE 'Policy users_can_select_own_profile created';
    ELSE
        RAISE NOTICE 'Policy users_can_select_own_profile already exists';
    END IF;
END $$;

-- 3. 確認：すべてのポリシーを表示
SELECT 
    policyname,
    cmd,
    qual AS using_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'profiles'
ORDER BY cmd, policyname;
