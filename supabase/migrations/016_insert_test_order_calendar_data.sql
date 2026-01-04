-- テスト用：order_calendarテーブルにサンプルデータを挿入
-- 今日から2週間分のデータを作成

-- 既存のデータを削除（テスト用）
-- DELETE FROM order_calendar;

-- 今日から14日間のデータを生成
INSERT INTO order_calendar (target_date, is_available, deadline_time, note)
SELECT 
    date_series.target_date,
    true as is_available,
    '10:00:00'::time as deadline_time,
    CASE 
        WHEN EXTRACT(DOW FROM date_series.target_date) IN (0, 6) 
        THEN '週末'
        ELSE NULL
    END as note
FROM (
    SELECT (CURRENT_DATE + (generate_series(0, 13) || ' days')::interval)::date as target_date
) as date_series
ON CONFLICT (target_date) 
DO UPDATE SET
    is_available = EXCLUDED.is_available,
    deadline_time = EXCLUDED.deadline_time,
    note = EXCLUDED.note;

-- 確認用クエリ
SELECT * FROM order_calendar 
WHERE target_date >= CURRENT_DATE 
ORDER BY target_date 
LIMIT 20;
