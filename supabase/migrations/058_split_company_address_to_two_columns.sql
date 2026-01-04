-- 会社情報の住所を2行に分割
-- company_addressをcompany_address1とcompany_address2に分割

-- 1. company_address1カラムを追加（既に存在する場合はスキップ）
ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS company_address1 TEXT;

-- 2. company_address2カラムを追加
ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS company_address2 TEXT;

-- 3. 既存のcompany_addressのデータをcompany_address1に移行（カラムが存在する場合のみ）
UPDATE system_settings
SET company_address1 = company_address
WHERE company_address IS NOT NULL 
  AND company_address1 IS NULL
  AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'system_settings' 
    AND column_name = 'company_address'
  );

-- 4. コメントを追加
COMMENT ON COLUMN system_settings.company_address1 IS '自社の住所（1行目）';
COMMENT ON COLUMN system_settings.company_address2 IS '自社の住所（2行目）';

-- 5. 古いcompany_addressカラムは削除しない（後方互換性のため残す）
-- 必要に応じて後で削除可能: ALTER TABLE system_settings DROP COLUMN IF EXISTS company_address;
