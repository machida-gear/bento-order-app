-- order_calendarテーブルの管理者用RLSポリシーを作成
-- 管理者がorder_calendarテーブルを更新できるようにする

-- 1. 既存のRLSポリシーを確認
SELECT 
    policyname,
    cmd,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'order_calendar'
ORDER BY cmd, policyname;

-- 2. 既存のポリシーを削除して再作成（is_activeチェックを追加）
DO $$
BEGIN
    -- 既存のポリシーを削除
    DROP POLICY IF EXISTS "order_calendar_all_admin" ON order_calendar;
    
    -- 管理者用のALLポリシーを作成（is_activeチェックを含む）
    CREATE POLICY "order_calendar_all_admin"
        ON order_calendar FOR ALL
        USING (
            EXISTS (
                SELECT 1 FROM profiles
                WHERE id = auth.uid() AND role = 'admin' AND is_active = true
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM profiles
                WHERE id = auth.uid() AND role = 'admin' AND is_active = true
            )
        );
    
    RAISE NOTICE 'Policy order_calendar_all_admin created/updated';
END $$;

-- 3. 確認：すべてのポリシーを表示（完全な式を確認）
SELECT 
    policyname,
    cmd,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'order_calendar'
ORDER BY cmd, policyname;

-- 4. ポリシーの完全な定義を確認（pg_policyテーブルから直接取得）
SELECT 
    p.polname AS policy_name,
    p.polcmd AS command,
    pg_get_expr(p.polqual, p.polrelid) AS using_expression,
    pg_get_expr(p.polwithcheck, p.polrelid) AS with_check_expression
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
  AND c.relname = 'order_calendar'
  AND p.polname = 'order_calendar_all_admin';

-- 5. 現在のユーザーが管理者かどうかを確認
SELECT 
    id,
    role,
    is_active,
    full_name,
    CASE 
        WHEN role = 'admin' AND is_active = true THEN '管理者（有効）'
        WHEN role = 'admin' AND is_active = false THEN '管理者（無効）'
        ELSE '一般ユーザー'
    END AS status
FROM profiles
WHERE id = auth.uid();
