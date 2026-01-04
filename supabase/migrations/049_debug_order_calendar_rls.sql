-- order_calendarテーブルのRLSポリシー問題のデバッグ用SQL

-- 1. 現在のauth.uid()を確認（SQL EditorではNULLになるが、アプリケーションでは値が入る）
SELECT auth.uid() AS current_user_id;

-- 2. profilesテーブルのRLSポリシーを確認
SELECT 
    policyname,
    cmd,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'profiles'
ORDER BY cmd, policyname;

-- 3. order_calendarテーブルのRLSポリシーを確認
SELECT 
    policyname,
    cmd,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'order_calendar'
ORDER BY cmd, policyname;

-- 4. 管理者ユーザーを直接確認（RLSをバイパスするため、Service Role Keyで実行する必要がある）
-- 注意: このクエリはService Role Keyで実行する必要があります
SELECT 
    id,
    role,
    is_active,
    full_name,
    employee_code
FROM profiles
WHERE role = 'admin'
ORDER BY created_at DESC
LIMIT 10;

-- 5. order_calendar_all_adminポリシーを再作成（より確実な方法）
-- ポリシー内でprofilesテーブルを参照する際に、RLSが干渉しないようにする
DO $$
BEGIN
    -- 既存のポリシーを削除
    DROP POLICY IF EXISTS "order_calendar_all_admin" ON order_calendar;
    
    -- 新しいポリシーを作成
    -- 注意: ポリシー内でのprofilesテーブルへの参照は、profilesテーブルのRLSポリシーの影響を受けます
    -- そのため、profilesテーブルに適切なRLSポリシーが設定されている必要があります
    CREATE POLICY "order_calendar_all_admin"
        ON order_calendar FOR ALL
        USING (
            EXISTS (
                SELECT 1 FROM profiles
                WHERE profiles.id = auth.uid() 
                  AND profiles.role = 'admin'::user_role 
                  AND profiles.is_active = true
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM profiles
                WHERE profiles.id = auth.uid() 
                  AND profiles.role = 'admin'::user_role 
                  AND profiles.is_active = true
            )
        );
    
    RAISE NOTICE 'Policy order_calendar_all_admin recreated';
END $$;

-- 6. 確認：更新後のポリシーを表示
SELECT 
    policyname,
    cmd,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'order_calendar'
  AND policyname = 'order_calendar_all_admin';
