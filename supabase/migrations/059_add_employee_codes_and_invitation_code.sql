-- 社員コードマスターテーブルの作成と招待コードの追加
-- 新規登録制限機能の実装

-- 1. 社員コードマスターテーブルの作成
CREATE TABLE IF NOT EXISTS employee_codes (
    id BIGSERIAL PRIMARY KEY,
    employee_code TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    is_registered BOOLEAN NOT NULL DEFAULT false,
    registered_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. 社員コードマスターテーブルのインデックス
CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_codes_code ON employee_codes (employee_code);
CREATE INDEX IF NOT EXISTS idx_employee_codes_registered ON employee_codes (is_registered);

-- 3. トリガーでupdated_atを自動更新
CREATE OR REPLACE FUNCTION update_employee_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_employee_codes_updated_at
    BEFORE UPDATE ON employee_codes
    FOR EACH ROW
    EXECUTE FUNCTION update_employee_codes_updated_at();

-- 4. RLS有効化
ALTER TABLE employee_codes ENABLE ROW LEVEL SECURITY;

-- 5. RLSポリシー
-- 全ユーザーが参照可能（新規登録時のチェックに必要）
CREATE POLICY "employee_codes_select_all"
    ON employee_codes FOR SELECT
    USING (true);

-- 管理者のみCRUD可能
CREATE POLICY "employee_codes_insert_admin"
    ON employee_codes FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'::user_role AND is_active = true
        )
    );

CREATE POLICY "employee_codes_update_admin"
    ON employee_codes FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'::user_role AND is_active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'::user_role AND is_active = true
        )
    );

CREATE POLICY "employee_codes_delete_admin"
    ON employee_codes FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'::user_role AND is_active = true
        )
    );

-- 6. system_settingsテーブルに招待コードカラムを追加
ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS invitation_code TEXT;

-- 7. コメントを追加
COMMENT ON TABLE employee_codes IS '社員コードマスターテーブル（新規登録制限用）';
COMMENT ON COLUMN employee_codes.employee_code IS '社員コード（4桁）';
COMMENT ON COLUMN employee_codes.full_name IS '氏名';
COMMENT ON COLUMN employee_codes.is_registered IS '登録済みフラグ';
COMMENT ON COLUMN employee_codes.registered_user_id IS '登録済みユーザーID（profiles.idを参照）';
COMMENT ON COLUMN system_settings.invitation_code IS '新規登録用招待コード';
