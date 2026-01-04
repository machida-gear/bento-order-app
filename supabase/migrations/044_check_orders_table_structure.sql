-- ============================================================
-- ordersテーブルの実際の構造を確認
-- ============================================================

-- 1. ordersテーブルの全カラム情報を確認
SELECT 
    column_name,
    data_type,
    udt_name,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'orders'
ORDER BY ordinal_position;

-- 2. ordersテーブルの外部キー制約を確認
SELECT
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'orders'
    AND tc.table_schema = 'public';

-- 3. サンプルデータを確認（既存の注文がある場合）
SELECT *
FROM orders
LIMIT 5;
