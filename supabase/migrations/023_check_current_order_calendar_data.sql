-- order_calendarテーブルの現在のデータを確認

-- 1. 今日の日付を確認
SELECT CURRENT_DATE as today;

-- 2. 今日から2週間以内のデータを確認
SELECT 
    target_date,
    is_available,
    deadline_time,
    note,
    created_at
FROM order_calendar 
WHERE target_date >= CURRENT_DATE 
  AND target_date <= CURRENT_DATE + INTERVAL '14 days'
ORDER BY target_date;

-- 3. 全データの件数を確認
SELECT COUNT(*) as total_records FROM order_calendar;

-- 4. 最新のデータを確認（過去・未来を含む）
SELECT 
    target_date,
    is_available,
    deadline_time,
    note
FROM order_calendar 
ORDER BY target_date DESC
LIMIT 20;
