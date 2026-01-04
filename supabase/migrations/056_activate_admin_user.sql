-- 管理者ユーザーを有効化するSQL
-- このSQLは、Supabase DashboardのSQL Editorで実行してください

-- 社員コード0309のユーザーを有効化
UPDATE profiles
SET is_active = true
WHERE employee_code = '0309';

-- 確認: 更新後の状態を確認
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
WHERE employee_code = '0309';
