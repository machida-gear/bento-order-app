-- order_calendarテーブルのRLSポリシーを確認

-- 1. RLSが有効になっているか確認
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'order_calendar';

-- 2. 既存のRLSポリシーを確認
SELECT 
    policyname,
    cmd,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'order_calendar'
ORDER BY cmd, policyname;
