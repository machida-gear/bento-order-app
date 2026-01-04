-- ユーザーを管理者に設定するSQL
-- このSQLは、Supabase DashboardのSQL Editorで実行してください
-- 実際のユーザーIDまたは社員コードに置き換えてください

-- 方法1: ユーザーIDで管理者に設定
-- UPDATE profiles
-- SET role = 'admin', is_active = true
-- WHERE id = '実際のユーザーIDをここに入力';

-- 方法2: 社員コードで管理者に設定
-- UPDATE profiles
-- SET role = 'admin', is_active = true
-- WHERE employee_code = '0309';  -- 例: 社員コード0309のユーザーを管理者に設定

-- 方法3: メールアドレスで管理者に設定
-- UPDATE profiles
-- SET role = 'admin', is_active = true
-- WHERE email = 'mondaykazu@hotmail.com';  -- 例: メールアドレスで管理者に設定

-- 確認: 更新後の状態を確認
-- SELECT 
--     id,
--     employee_code,
--     full_name,
--     email,
--     role,
--     is_active
-- FROM profiles
-- WHERE employee_code = '0309';  -- 確認したい社員コード
