-- プロファイルの存在確認とRLSポリシーの確認

-- 1. プロファイルが存在するか確認
SELECT 
    id,
    employee_code,
    full_name,
    email,
    role,
    is_active,
    created_at
FROM profiles 
WHERE id = '31dc22bf-0b07-4933-a67d-843bc9a5b6aa';

-- 2. profilesテーブルのRLSポリシーを確認
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
WHERE schemaname = 'public' 
  AND tablename = 'profiles'
ORDER BY policyname;

-- 3. RLSが有効になっているか確認
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'profiles';
