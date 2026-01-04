-- 既存ユーザー（mondaykazu@hotmail.com）のプロファイルを作成

INSERT INTO profiles (id, employee_code, full_name, email, role, is_active)
VALUES (
    '31dc22bf-0b07-4933-a67d-843bc9a5b6aa',  -- ユーザーID（auth.users.id）
    '0001',                                  -- 社員コード（4桁）- 必要に応じて変更してください
    'ユーザー',                              -- フルネーム - 必要に応じて変更してください
    'mondaykazu@hotmail.com',               -- メールアドレス
    'user',                                  -- ロール（user または admin）
    true                                     -- アクティブ状態
)
ON CONFLICT (id) DO UPDATE SET
    employee_code = EXCLUDED.employee_code,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active;

-- 確認用クエリ
SELECT * FROM profiles WHERE id = '31dc22bf-0b07-4933-a67d-843bc9a5b6aa';
