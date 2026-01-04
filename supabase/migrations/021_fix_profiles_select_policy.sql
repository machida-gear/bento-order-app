-- profilesテーブルのSELECT用RLSポリシーを確認・作成

-- 1. 既存のSELECTポリシーを確認
SELECT 
    policyname,
    cmd,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'profiles'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- 2. ユーザーが自分のプロファイルをSELECTできるポリシーを作成
DO $$
BEGIN
    -- ユーザーが自分のプロファイルをSELECTできるポリシー
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles' 
        AND policyname = 'users_can_select_own_profile'
    ) THEN
        CREATE POLICY "users_can_select_own_profile"
            ON profiles FOR SELECT
            USING (auth.uid() = id);
        
        RAISE NOTICE '✅ ポリシー "users_can_select_own_profile" を作成しました';
    ELSE
        RAISE NOTICE 'ℹ️ ポリシー "users_can_select_own_profile" は既に存在します';
    END IF;

    -- 管理者が全プロファイルをSELECTできるポリシー（オプション）
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles' 
        AND policyname = 'admins_can_select_all_profiles'
    ) THEN
        CREATE POLICY "admins_can_select_all_profiles"
            ON profiles FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE id = auth.uid() 
                    AND role = 'admin' 
                    AND is_active = true
                )
            );
        
        RAISE NOTICE '✅ ポリシー "admins_can_select_all_profiles" を作成しました';
    ELSE
        RAISE NOTICE 'ℹ️ ポリシー "admins_can_select_all_profiles" は既に存在します';
    END IF;
END $$;

-- 3. 最終確認：すべてのポリシーを表示
SELECT 
    policyname,
    cmd,
    qual AS using_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'profiles'
ORDER BY cmd, policyname;
