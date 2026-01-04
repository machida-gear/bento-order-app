-- ============================================================
-- UNIQUE制約の確認
-- ============================================================

-- menu_pricesテーブルのUNIQUE制約を確認
SELECT
    tc.constraint_name,
    kcu.column_name,
    tc.constraint_type
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
    AND tc.table_schema = 'public'
    AND tc.table_name = 'menu_prices'
ORDER BY tc.constraint_name, kcu.ordinal_position;

-- menu_itemsテーブルのUNIQUE制約を確認
SELECT
    tc.constraint_name,
    kcu.column_name,
    tc.constraint_type
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
    AND tc.table_schema = 'public'
    AND tc.table_name = 'menu_items'
ORDER BY tc.constraint_name, kcu.ordinal_position;

-- vendorsテーブルのUNIQUE制約を確認
SELECT
    tc.constraint_name,
    kcu.column_name,
    tc.constraint_type
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
    AND tc.table_schema = 'public'
    AND tc.table_name = 'vendors'
ORDER BY tc.constraint_name, kcu.ordinal_position;
