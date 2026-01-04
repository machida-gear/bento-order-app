-- order_calendarテーブルのSELECT用RLSポリシーを作成

-- 1. 既存のRLSポリシーを確認
SELECT 
    policyname,
    cmd,
    qual AS using_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'order_calendar'
ORDER BY cmd, policyname;

-- 2. RLSが有効になっているか確認
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'order_calendar';

-- 3. 一般ユーザーがorder_calendarをSELECTできるポリシーを作成
-- order_calendarは参照専用で、全ユーザーが閲覧可能にする
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'order_calendar' 
        AND policyname = 'order_calendar_select_all'
    ) THEN
        CREATE POLICY "order_calendar_select_all"
            ON order_calendar FOR SELECT
            USING (true);  -- 認証済みユーザーなら全員閲覧可能
        
        RAISE NOTICE 'Policy order_calendar_select_all created';
    ELSE
        RAISE NOTICE 'Policy order_calendar_select_all already exists';
    END IF;
END $$;

-- 4. 確認：すべてのポリシーを表示
SELECT 
    policyname,
    cmd,
    qual AS using_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'order_calendar'
ORDER BY cmd, policyname;
