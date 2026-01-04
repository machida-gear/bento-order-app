-- max_order_days_aheadカラムを追加
-- ユーザーが何日先の注文までできるかを設定する

-- 1. max_order_days_aheadカラムを追加
ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS max_order_days_ahead INTEGER NOT NULL DEFAULT 30 CHECK (max_order_days_ahead >= 1 AND max_order_days_ahead <= 365);

-- 2. コメントを追加
COMMENT ON COLUMN system_settings.max_order_days_ahead IS '最大注文可能日数（今日から何日先まで注文可能か、1～365日）';

-- 3. 既存データがある場合、デフォルト値を設定
UPDATE system_settings
SET max_order_days_ahead = 30
WHERE max_order_days_ahead IS NULL;
