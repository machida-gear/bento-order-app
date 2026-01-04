-- closing_dayをNULL許可に変更（NULL = 月末締め）
-- 月末締めを設定できるようにするためのマイグレーション

-- 1. CHECK制約を削除
ALTER TABLE system_settings
DROP CONSTRAINT IF EXISTS system_settings_closing_day_check;

-- 2. closing_dayカラムをNULL許可に変更
ALTER TABLE system_settings
ALTER COLUMN closing_day DROP NOT NULL;

-- 3. 新しいCHECK制約を追加（NULLまたは1～31の範囲）
ALTER TABLE system_settings
ADD CONSTRAINT system_settings_closing_day_check
CHECK (closing_day IS NULL OR (closing_day >= 1 AND closing_day <= 31));

-- 4. コメントを追加
COMMENT ON COLUMN system_settings.closing_day IS '締め日（1～31日）。NULLの場合は月末締め（月によって28～31日）';
