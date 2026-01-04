-- ============================================================
-- order_status enum型に'cancelled'を追加
-- ============================================================

-- 注意: このSQLを実行する前に、046_check_order_status_enum.sqlを実行して
-- 現在のenum型の値を確認してください

-- 1. 現在のenum型の値を確認
SELECT 
    t.typname AS enum_name,
    e.enumlabel AS enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'order_status'
ORDER BY e.enumsortorder;

-- 2. 'cancelled'が存在しない場合のみ追加
-- PostgreSQLでは、enum型に値を追加する際に、既存の値の後に追加されます
-- 注意: トランザクション内で実行する必要があります

DO $$
BEGIN
    -- 'cancelled'が存在するかチェック
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'cancelled' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status')
    ) THEN
        -- 'cancelled'を追加
        ALTER TYPE order_status ADD VALUE 'cancelled';
        RAISE NOTICE 'Added ''cancelled'' to order_status enum';
    ELSE
        RAISE NOTICE '''cancelled'' already exists in order_status enum';
    END IF;
END $$;

-- 3. 追加後のenum型の値を確認
SELECT 
    t.typname AS enum_name,
    e.enumlabel AS enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'order_status'
ORDER BY e.enumsortorder;
