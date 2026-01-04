-- 現在ログインしているユーザーのプロフィールを確認するSQL
-- このSQLは、Supabase DashboardのSQL Editorで実行してください
-- または、実際のユーザーIDを指定して実行してください

-- 1. すべてのユーザーのプロフィールを確認
SELECT 
    id,
    employee_code,
    full_name,
    email,
    role,
    is_active,
    joined_date,
    left_date,
    created_at,
    updated_at
FROM profiles
ORDER BY employee_code;

-- 2. 管理者ユーザーのみを確認
SELECT 
    id,
    employee_code,
    full_name,
    email,
    role,
    is_active,
    joined_date,
    left_date
FROM profiles
WHERE role = 'admin'
ORDER BY employee_code;

-- 3. 無効化されているユーザーを確認
SELECT 
    id,
    employee_code,
    full_name,
    email,
    role,
    is_active,
    left_date
FROM profiles
WHERE is_active = false
ORDER BY employee_code;

-- 4. 特定のユーザーIDで確認する場合（実際のユーザーIDに置き換えてください）
-- SELECT 
--     id,
--     employee_code,
--     full_name,
--     email,
--     role,
--     is_active,
--     joined_date,
--     left_date
-- FROM profiles
-- WHERE id = '実際のユーザーIDをここに入力';
