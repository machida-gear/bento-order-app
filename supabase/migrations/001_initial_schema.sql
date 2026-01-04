-- ============================================================
-- お弁当注文Webアプリ - 初期スキーマ
-- Supabase Postgres DDL + RLSポリシー
-- ============================================================

-- ============================================================
-- 1. 拡張機能の有効化
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 2. ENUM型の定義
-- ============================================================

-- ユーザーロール
CREATE TYPE user_role AS ENUM ('user', 'admin');

-- 注文ステータス
CREATE TYPE order_status AS ENUM ('ordered', 'cancelled', 'invalid');

-- 自動注文実行ステータス
CREATE TYPE auto_order_run_status AS ENUM ('running', 'completed', 'failed');

-- ============================================================
-- 3. テーブル定義
-- ============================================================

-- ユーザープロフィール（Auth.usersとは別管理）
CREATE TABLE users_profile (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    employee_code CHAR(4) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    role user_role NOT NULL DEFAULT 'user',
    is_active BOOLEAN NOT NULL DEFAULT true,
    joined_date DATE,
    left_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT valid_employee_code CHECK (LENGTH(employee_code) = 4),
    CONSTRAINT valid_dates CHECK (left_date IS NULL OR joined_date IS NULL OR left_date >= joined_date)
);

-- 業者マスタ
CREATE TABLE vendors (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- メニューマスタ
CREATE TABLE menus (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- メニュー価格（履歴管理：start_date/end_dateで期間管理）
CREATE TABLE menu_prices (
    id SERIAL PRIMARY KEY,
    menu_id INTEGER NOT NULL REFERENCES menus(id) ON DELETE RESTRICT,
    price INTEGER NOT NULL CHECK (price > 0),
    start_date DATE NOT NULL,
    end_date DATE, -- NULLの場合は現在有効
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(menu_id, start_date),
    CONSTRAINT valid_price_period CHECK (end_date IS NULL OR end_date >= start_date)
);

-- 注文可能日カレンダー
CREATE TABLE order_days (
    date DATE PRIMARY KEY,
    is_available BOOLEAN NOT NULL DEFAULT true,
    special_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 日別締切時刻
CREATE TABLE order_deadlines (
    date DATE PRIMARY KEY REFERENCES order_days(date) ON DELETE CASCADE,
    cutoff_time TIME NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 注文
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users_profile(id) ON DELETE RESTRICT,
    menu_id INTEGER NOT NULL REFERENCES menus(id) ON DELETE RESTRICT,
    menu_price_id INTEGER NOT NULL REFERENCES menu_prices(id) ON DELETE RESTRICT,
    order_date DATE NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    status order_status NOT NULL DEFAULT 'ordered',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- 同一ユーザー・同一メニュー・同一日付・同一ステータスでの重複を防ぐ
    UNIQUE(user_id, menu_id, order_date, status)
);

-- 締日期間（月次集計の境界を管理）
CREATE TABLE closing_periods (
    id SERIAL PRIMARY KEY,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    closing_date DATE NOT NULL, -- この期間の締日
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(start_date, end_date),
    CONSTRAINT valid_closing_period CHECK (end_date >= start_date)
);

-- 操作ログ（監査用）
CREATE TABLE operation_logs (
    id SERIAL PRIMARY KEY,
    actor_user_id UUID NOT NULL REFERENCES users_profile(id) ON DELETE RESTRICT,
    action VARCHAR(100) NOT NULL, -- 例: 'order.create', 'order.cancel', 'price.update'
    detail JSONB, -- 詳細情報（JSON形式）
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 自動注文設定
CREATE TABLE auto_order_settings (
    user_id UUID PRIMARY KEY REFERENCES users_profile(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 自動注文テンプレート（曜日別の注文パターン）
CREATE TABLE auto_order_templates (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
    menu_id INTEGER NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    day_of_week INTEGER, -- 0=日曜, 1=月曜, ..., 6=土曜。NULLの場合は毎日
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT valid_day_of_week CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6))
);

-- 自動注文実行履歴
CREATE TABLE auto_order_runs (
    id SERIAL PRIMARY KEY,
    run_date DATE NOT NULL,
    cutoff_time TIME NOT NULL,
    status auto_order_run_status NOT NULL DEFAULT 'running',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    UNIQUE(run_date, cutoff_time)
);

-- 自動注文実行アイテム（ユーザーごとの実行結果）
CREATE TABLE auto_order_run_items (
    id SERIAL PRIMARY KEY,
    run_id INTEGER NOT NULL REFERENCES auto_order_runs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users_profile(id) ON DELETE RESTRICT,
    target_date DATE NOT NULL,
    result VARCHAR(50) NOT NULL, -- 'created', 'skipped', 'error'
    detail TEXT, -- エラーメッセージやスキップ理由
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(run_id, user_id)
);

-- ============================================================
-- 4. インデックス
-- ============================================================

-- パフォーマンス向上のためのインデックス
CREATE INDEX idx_users_profile_employee_code ON users_profile(employee_code);
CREATE INDEX idx_users_profile_email ON users_profile(email);
CREATE INDEX idx_users_profile_is_active ON users_profile(is_active);

CREATE INDEX idx_menus_vendor_id ON menus(vendor_id);
CREATE INDEX idx_menus_is_active ON menus(is_active);

CREATE INDEX idx_menu_prices_menu_id ON menu_prices(menu_id);
CREATE INDEX idx_menu_prices_dates ON menu_prices(menu_id, start_date, end_date);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_order_date ON orders(order_date);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_user_date ON orders(user_id, order_date);

CREATE INDEX idx_operation_logs_actor ON operation_logs(actor_user_id);
CREATE INDEX idx_operation_logs_created_at ON operation_logs(created_at);
CREATE INDEX idx_operation_logs_action ON operation_logs(action);

CREATE INDEX idx_auto_order_templates_user_id ON auto_order_templates(user_id);
CREATE INDEX idx_auto_order_run_items_run_id ON auto_order_run_items(run_id);
CREATE INDEX idx_auto_order_run_items_user_id ON auto_order_run_items(user_id);

-- ============================================================
-- 5. トリガー（updated_at自動更新）
-- ============================================================

-- updated_atを自動更新する関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 各テーブルにトリガーを設定
CREATE TRIGGER update_users_profile_updated_at BEFORE UPDATE ON users_profile
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON vendors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_menus_updated_at BEFORE UPDATE ON menus
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_days_updated_at BEFORE UPDATE ON order_days
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_deadlines_updated_at BEFORE UPDATE ON order_deadlines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_closing_periods_updated_at BEFORE UPDATE ON closing_periods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auto_order_settings_updated_at BEFORE UPDATE ON auto_order_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auto_order_templates_updated_at BEFORE UPDATE ON auto_order_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 6. RLS（Row Level Security）の有効化
-- ============================================================

ALTER TABLE users_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE closing_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_order_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_order_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_order_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_order_run_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. RLSポリシー定義
-- ============================================================

-- ============================================================
-- 7.1 users_profile
-- ============================================================

-- 一般ユーザー：自分のプロフィールのみ参照・更新可能
CREATE POLICY "users_profile_select_own"
    ON users_profile FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "users_profile_update_own"
    ON users_profile FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 管理者：全ユーザーのプロフィールを参照・更新可能
CREATE POLICY "users_profile_all_admin"
    ON users_profile FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================
-- 7.2 vendors（管理者のみCRUD）
-- ============================================================

CREATE POLICY "vendors_all_admin"
    ON vendors FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE id = auth.uid() AND role = 'admin' AND is_active = true
        )
    );

-- 一般ユーザー：参照のみ（is_active=trueのみ）
CREATE POLICY "vendors_select_active"
    ON vendors FOR SELECT
    USING (is_active = true);

-- ============================================================
-- 7.3 menus（管理者のみCRUD）
-- ============================================================

CREATE POLICY "menus_all_admin"
    ON menus FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE id = auth.uid() AND role = 'admin' AND is_active = true
        )
    );

-- 一般ユーザー：参照のみ（is_active=trueのみ）
CREATE POLICY "menus_select_active"
    ON menus FOR SELECT
    USING (is_active = true);

-- ============================================================
-- 7.4 menu_prices（管理者のみCRUD）
-- ============================================================

CREATE POLICY "menu_prices_all_admin"
    ON menu_prices FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE id = auth.uid() AND role = 'admin' AND is_active = true
        )
    );

-- 一般ユーザー：参照のみ
CREATE POLICY "menu_prices_select"
    ON menu_prices FOR SELECT
    USING (true);

-- ============================================================
-- 7.5 order_days（管理者のみCRUD）
-- ============================================================

CREATE POLICY "order_days_all_admin"
    ON order_days FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE id = auth.uid() AND role = 'admin' AND is_active = true
        )
    );

-- 一般ユーザー：参照のみ
CREATE POLICY "order_days_select"
    ON order_days FOR SELECT
    USING (true);

-- ============================================================
-- 7.6 order_deadlines（管理者のみCRUD）
-- ============================================================

CREATE POLICY "order_deadlines_all_admin"
    ON order_deadlines FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE id = auth.uid() AND role = 'admin' AND is_active = true
        )
    );

-- 一般ユーザー：参照のみ
CREATE POLICY "order_deadlines_select"
    ON order_deadlines FOR SELECT
    USING (true);

-- ============================================================
-- 7.7 orders（一般ユーザーは自分の注文のみ）
-- ============================================================

-- 一般ユーザー：自分の注文のみ参照・作成・更新可能
CREATE POLICY "orders_select_own"
    ON orders FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "orders_insert_own"
    ON orders FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM users_profile
            WHERE id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "orders_update_own"
    ON orders FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 管理者：全注文を参照・更新可能
CREATE POLICY "orders_all_admin"
    ON orders FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE id = auth.uid() AND role = 'admin' AND is_active = true
        )
    );

-- ============================================================
-- 7.8 closing_periods（管理者のみCRUD）
-- ============================================================

CREATE POLICY "closing_periods_all_admin"
    ON closing_periods FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE id = auth.uid() AND role = 'admin' AND is_active = true
        )
    );

-- 一般ユーザー：参照のみ
CREATE POLICY "closing_periods_select"
    ON closing_periods FOR SELECT
    USING (true);

-- ============================================================
-- 7.9 operation_logs（管理者のみ参照）
-- ============================================================

-- 管理者のみ参照可能
CREATE POLICY "operation_logs_select_admin"
    ON operation_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE id = auth.uid() AND role = 'admin' AND is_active = true
        )
    );

-- 全ユーザーがログを記録可能（アプリ層で制御）
CREATE POLICY "operation_logs_insert_all"
    ON operation_logs FOR INSERT
    WITH CHECK (auth.uid() = actor_user_id);

-- ============================================================
-- 7.10 auto_order_settings（一般ユーザーは自分の設定のみ）
-- ============================================================

CREATE POLICY "auto_order_settings_select_own"
    ON auto_order_settings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "auto_order_settings_insert_own"
    ON auto_order_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "auto_order_settings_update_own"
    ON auto_order_settings FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 管理者：全設定を参照可能
CREATE POLICY "auto_order_settings_select_admin"
    ON auto_order_settings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE id = auth.uid() AND role = 'admin' AND is_active = true
        )
    );

-- ============================================================
-- 7.11 auto_order_templates（一般ユーザーは自分のテンプレートのみ）
-- ============================================================

CREATE POLICY "auto_order_templates_select_own"
    ON auto_order_templates FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "auto_order_templates_insert_own"
    ON auto_order_templates FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "auto_order_templates_update_own"
    ON auto_order_templates FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "auto_order_templates_delete_own"
    ON auto_order_templates FOR DELETE
    USING (auth.uid() = user_id);

-- 管理者：全テンプレートを参照可能
CREATE POLICY "auto_order_templates_select_admin"
    ON auto_order_templates FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE id = auth.uid() AND role = 'admin' AND is_active = true
        )
    );

-- ============================================================
-- 7.12 auto_order_runs（管理者のみ参照）
-- ============================================================

CREATE POLICY "auto_order_runs_all_admin"
    ON auto_order_runs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE id = auth.uid() AND role = 'admin' AND is_active = true
        )
    );

-- ============================================================
-- 7.13 auto_order_run_items（管理者のみ参照）
-- ============================================================

CREATE POLICY "auto_order_run_items_all_admin"
    ON auto_order_run_items FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE id = auth.uid() AND role = 'admin' AND is_active = true
        )
    );

-- ============================================================
-- 8. ヘルパー関数（価格取得、締切判定など）
-- ============================================================

-- 指定日付・メニューIDに対応する有効な価格IDを取得
-- 複数の価格期間が重複している場合はエラーを投げる
CREATE OR REPLACE FUNCTION get_menu_price_id(
    p_menu_id INTEGER,
    p_order_date DATE
)
RETURNS INTEGER AS $$
DECLARE
    v_price_id INTEGER;
    v_count INTEGER;
BEGIN
    -- 指定日付が含まれる価格期間を検索
    SELECT id, COUNT(*) OVER()
    INTO v_price_id, v_count
    FROM menu_prices
    WHERE menu_id = p_menu_id
        AND start_date <= p_order_date
        AND (end_date IS NULL OR end_date >= p_order_date)
    ORDER BY start_date DESC
    LIMIT 1;

    -- 価格が見つからない場合
    IF v_price_id IS NULL THEN
        RAISE EXCEPTION '指定日付(%)に対応するメニューID(%)の価格が見つかりません', p_order_date, p_menu_id;
    END IF;

    -- 重複する価格期間がある場合
    IF v_count > 1 THEN
        RAISE EXCEPTION '指定日付(%)に対応するメニューID(%)の価格期間が重複しています', p_order_date, p_menu_id;
    END IF;

    RETURN v_price_id;
END;
$$ LANGUAGE plpgsql;

-- 指定日付の締切時刻を取得（order_deadlinesから、なければデフォルト10:00）
CREATE OR REPLACE FUNCTION get_cutoff_time(p_order_date DATE)
RETURNS TIME AS $$
DECLARE
    v_cutoff_time TIME;
BEGIN
    SELECT cutoff_time INTO v_cutoff_time
    FROM order_deadlines
    WHERE date = p_order_date;

    -- 設定がない場合はデフォルト10:00
    IF v_cutoff_time IS NULL THEN
        v_cutoff_time := '10:00:00';
    END IF;

    RETURN v_cutoff_time;
END;
$$ LANGUAGE plpgsql;

-- 指定日付の注文が締切前かどうかを判定（DB時刻基準、JST固定）
CREATE OR REPLACE FUNCTION is_before_cutoff(p_order_date DATE)
RETURNS BOOLEAN AS $$
DECLARE
    v_cutoff_time TIME;
    v_current_time TIME;
    v_current_date DATE;
    v_now_jst TIMESTAMPTZ;
BEGIN
    -- 現在の日時をJSTで取得（UTCからAsia/Tokyoに変換）
    v_now_jst := (NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Tokyo';
    v_current_date := v_now_jst::DATE;
    v_current_time := v_now_jst::TIME;

    -- 注文日が今日より前の場合は締切済み
    IF p_order_date < v_current_date THEN
        RETURN false;
    END IF;

    -- 注文日が今日より後の場合は締切前
    IF p_order_date > v_current_date THEN
        RETURN true;
    END IF;

    -- 注文日が今日の場合、締切時刻と比較
    v_cutoff_time := get_cutoff_time(p_order_date);
    
    RETURN v_current_time < v_cutoff_time;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 9. 初期データ（オプション：テスト用）
-- ============================================================

-- 管理者ユーザーの作成は、Auth.users作成後に手動でusers_profileにINSERTする必要があります
-- 例：
-- INSERT INTO users_profile (id, employee_code, name, email, role, is_active)
-- VALUES ('<auth.users.id>', '0001', '管理者', 'admin@example.com', 'admin', true);

