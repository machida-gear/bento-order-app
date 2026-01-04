-- order_calendar / order_daysテーブルの構造を確認

-- 1. テーブル名の確認
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('order_calendar', 'order_days')
ORDER BY table_name;

-- 2. テーブル構造の確認（order_calendarが存在する場合）
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

-- 3. データの確認（order_calendarが存在する場合）
SELECT COUNT(*) as record_count FROM order_calendar;

-- 4. 最近のデータを確認（order_calendarが存在する場合）
SELECT * FROM order_calendar 
ORDER BY date DESC 
LIMIT 10;
