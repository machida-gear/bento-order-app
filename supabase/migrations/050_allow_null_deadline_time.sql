-- order_calendarテーブルのdeadline_timeカラムをNULL許可に変更
-- 注文不可（is_available = false）の日には締切時刻は不要

-- 1. 現在のdeadline_timeカラムの制約を確認
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'order_calendar'
  AND column_name = 'deadline_time';

-- 2. deadline_timeカラムをNULL許可に変更
ALTER TABLE order_calendar
ALTER COLUMN deadline_time DROP NOT NULL;

-- 3. 確認：変更後のカラム情報
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'order_calendar'
  AND column_name = 'deadline_time';

-- 4. 既存のデータでis_available = falseのレコードのdeadline_timeをNULLに更新（オプション）
-- 必要に応じて実行してください
-- UPDATE order_calendar
-- SET deadline_time = NULL
-- WHERE is_available = false AND deadline_time IS NOT NULL;
