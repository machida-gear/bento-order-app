-- ============================================================
-- order_status enum型の確認と修正
-- ============================================================

-- 1. 現在のenum型の定義を確認
SELECT 
    t.typname AS enum_name,
    e.enumlabel AS enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'order_status'
ORDER BY e.enumsortorder;

-- 2. ordersテーブルのstatusカラムの型を確認
SELECT 
    table_name,
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE table_name = 'orders' AND column_name = 'status';

-- 3. 現在の注文のstatus値を確認
SELECT 
    status,
    COUNT(*) AS count
FROM orders
GROUP BY status
ORDER BY status;

-- 4. enum型に'cancelled'が存在しない場合、追加する
-- 注意: enum型に値を追加するには、ALTER TYPEを使用する必要があります
-- ただし、既存の値がある場合は慎重に実行してください

-- 5. もし'cancelled'が存在しない場合の修正方法
-- 以下のSQLを実行して、'cancelled'を追加します
-- ALTER TYPE order_status ADD VALUE 'cancelled';

-- 6. 現在のenum型の値をすべて確認
SELECT 
    t.typname AS enum_name,
    array_agg(e.enumlabel ORDER BY e.enumsortorder) AS enum_values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'order_status'
GROUP BY t.typname;
