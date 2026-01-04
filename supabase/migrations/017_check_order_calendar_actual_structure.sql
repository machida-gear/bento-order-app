-- order_calendarテーブルの実際の構造を確認

-- 1. テーブルが存在するか確認
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('order_calendar', 'order_days')
ORDER BY table_name;

-- 2. 実際のカラム名を確認（order_calendarが存在する場合）
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'order_calendar'
ORDER BY ordinal_position;

-- 3. データのサンプルを確認（最初の5件）
SELECT * FROM order_calendar LIMIT 5;
