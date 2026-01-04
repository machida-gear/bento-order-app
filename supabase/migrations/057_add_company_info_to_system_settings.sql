-- 会社情報カラムをsystem_settingsテーブルに追加
-- 自社の社名、住所、電話番号、FAX番号、メールアドレスを保存

-- 1. 会社情報カラムを追加
ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS company_postal_code TEXT,
ADD COLUMN IF NOT EXISTS company_address TEXT,
ADD COLUMN IF NOT EXISTS company_phone TEXT,
ADD COLUMN IF NOT EXISTS company_fax TEXT,
ADD COLUMN IF NOT EXISTS company_email TEXT;

-- 2. コメントを追加
COMMENT ON COLUMN system_settings.company_name IS '自社の会社名';
COMMENT ON COLUMN system_settings.company_postal_code IS '自社の郵便番号';
COMMENT ON COLUMN system_settings.company_address IS '自社の住所';
COMMENT ON COLUMN system_settings.company_phone IS '自社の電話番号';
COMMENT ON COLUMN system_settings.company_fax IS '自社のFAX番号';
COMMENT ON COLUMN system_settings.company_email IS '自社のメールアドレス';
