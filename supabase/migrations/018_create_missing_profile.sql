-- 不足しているプロファイルを確認・作成するSQL

-- 1. 認証済みユーザーでプロファイルが存在しないユーザーを確認
SELECT 
    au.id,
    au.email,
    au.created_at,
    CASE 
        WHEN p.id IS NULL THEN '❌ プロファイルなし'
        ELSE '✅ プロファイルあり'
    END as profile_status
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL
ORDER BY au.created_at DESC;

-- 2. プロファイルを作成（手動で実行する場合）
-- 以下のSQLを実行する前に、email、employee_code、full_nameを適切な値に置き換えてください

-- 例：特定のユーザーのプロファイルを作成
-- INSERT INTO profiles (id, employee_code, full_name, email, role, is_active)
-- VALUES (
--     '31dc22bf-0b07-4933-a67d-843bc9a5b6aa',  -- ユーザーID（auth.users.id）
--     '0001',                                  -- 社員コード（4桁）
--     'ユーザー名',                            -- フルネーム
--     'mondaykazu@hotmail.com',               -- メールアドレス
--     'user',                                  -- ロール（user または admin）
--     true                                     -- アクティブ状態
-- )
-- ON CONFLICT (id) DO NOTHING;

-- 3. 作成後の確認
-- SELECT * FROM profiles WHERE id = '31dc22bf-0b07-4933-a67d-843bc9a5b6aa';
