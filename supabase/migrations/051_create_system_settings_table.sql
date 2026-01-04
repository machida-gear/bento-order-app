-- システム設定テーブルの作成
-- 管理者がシステム全体の設定を管理するためのテーブル

-- 1. テーブル作成
CREATE TABLE IF NOT EXISTS system_settings (
    id BIGSERIAL PRIMARY KEY,
    default_deadline_time TIME NOT NULL DEFAULT '10:00'::time,
    closing_day INTEGER NOT NULL DEFAULT 25 CHECK (closing_day >= 1 AND closing_day <= 31),
    day_of_week_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- 設定は1レコードのみ（シングルトン）
    CONSTRAINT single_settings_row CHECK (id = 1)
);

-- 2. 初期データの投入
INSERT INTO system_settings (id, default_deadline_time, closing_day, day_of_week_settings)
VALUES (
    1,
    '10:00'::time,
    25,
    '{
        "0": {"is_available": false, "note": "週末"},
        "1": {"is_available": true, "note": null},
        "2": {"is_available": true, "note": null},
        "3": {"is_available": true, "note": null},
        "4": {"is_available": true, "note": null},
        "5": {"is_available": true, "note": null},
        "6": {"is_available": false, "note": "週末"}
    }'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- 3. トリガーでupdated_atを自動更新
CREATE OR REPLACE FUNCTION update_system_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_system_settings_updated_at
    BEFORE UPDATE ON system_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_system_settings_updated_at();

-- 4. RLS有効化
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 5. RLSポリシー
-- 全ユーザーが参照可能
CREATE POLICY "system_settings_select_all"
    ON system_settings FOR SELECT
    USING (true);

-- 管理者のみ更新可能
CREATE POLICY "system_settings_update_admin"
    ON system_settings FOR UPDATE
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

-- 6. インデックス（idは主キーなので不要だが、念のため）
CREATE UNIQUE INDEX IF NOT EXISTS idx_system_settings_singleton ON system_settings (id);
