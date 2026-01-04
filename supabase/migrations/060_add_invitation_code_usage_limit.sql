-- 招待コードの使用回数制限機能の追加

-- 1. system_settingsテーブルに使用回数制限関連のカラムを追加
ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS invitation_code_max_uses INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS invitation_code_used_count INTEGER DEFAULT 0;

-- 2. コメントを追加
COMMENT ON COLUMN system_settings.invitation_code_max_uses IS '招待コードの最大使用回数（NULL=無制限）';
COMMENT ON COLUMN system_settings.invitation_code_used_count IS '招待コードの現在の使用回数';
