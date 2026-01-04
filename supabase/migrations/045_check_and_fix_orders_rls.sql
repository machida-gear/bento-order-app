-- ============================================================
-- ordersテーブルのRLSポリシー確認と修正
-- ============================================================

-- 1. ordersテーブルのRLSが有効かどうか確認
SELECT 
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE tablename = 'orders';

-- 2. ordersテーブルのRLSポリシー確認
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
WHERE tablename = 'orders'
ORDER BY policyname;

-- 3. 現在のauth.uid()の値を確認（テスト用）
-- 注意: このクエリは実際のユーザーコンテキストで実行する必要があります
SELECT 
    auth.uid() AS current_user_id,
    auth.role() AS current_role;

-- 4. profilesテーブルが存在するか確認
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- 5. ordersテーブルのuser_idカラムの型を確認
SELECT 
    table_name,
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE table_name = 'orders' AND column_name = 'user_id';

-- 6. 既存のRLSポリシーを削除（必要に応じて）
-- 注意: 本番環境では慎重に実行してください
-- DROP POLICY IF EXISTS "orders_select_own" ON orders;
-- DROP POLICY IF EXISTS "orders_insert_own" ON orders;
-- DROP POLICY IF EXISTS "orders_update_own" ON orders;
-- DROP POLICY IF EXISTS "orders_all_admin" ON orders;

-- 7. RLSポリシーを再作成（profilesテーブルを使用）
-- 一般ユーザー：自分の注文のみ参照可能
DROP POLICY IF EXISTS "orders_select_own" ON orders;
CREATE POLICY "orders_select_own"
    ON orders FOR SELECT
    USING (auth.uid() = user_id);

-- 一般ユーザー：自分の注文のみ作成可能
DROP POLICY IF EXISTS "orders_insert_own" ON orders;
CREATE POLICY "orders_insert_own"
    ON orders FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND is_active = true
        )
    );

-- 一般ユーザー：自分の注文のみ更新可能
DROP POLICY IF EXISTS "orders_update_own" ON orders;
CREATE POLICY "orders_update_own"
    ON orders FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 管理者：全注文を参照・更新可能
DROP POLICY IF EXISTS "orders_all_admin" ON orders;
CREATE POLICY "orders_all_admin"
    ON orders FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin' AND is_active = true
        )
    );

-- 8. RLSが有効になっているか確認
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 9. 修正後のポリシーを確認
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
WHERE tablename = 'orders'
ORDER BY policyname;
