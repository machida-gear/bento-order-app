# 001_initial_schema.sql から抜き出した3テーブルの定義

## 1. order_deadlines（日別締切時刻）

### CREATE TABLE定義（001_initial_schema.sql 86-91行目）

```sql
CREATE TABLE order_deadlines (
    date DATE PRIMARY KEY REFERENCES order_days(date) ON DELETE CASCADE,
    cutoff_time TIME NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### インデックス
- なし（001_initial_schema.sqlには該当インデックスなし）

### トリガー（001_initial_schema.sql 227-228行目）

```sql
CREATE TRIGGER update_order_deadlines_updated_at BEFORE UPDATE ON order_deadlines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### RLS有効化（001_initial_schema.sql 251行目）

```sql
ALTER TABLE order_deadlines ENABLE ROW LEVEL SECURITY;
```

### RLSポリシー（001_initial_schema.sql 364-376行目）

```sql
-- 管理者のみCRUD
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
```

### 修正が必要な箇所
- 外部キー参照: `order_days` → `order_calendar`
- RLSポリシー内の参照: `users_profile` → `profiles`

---

## 2. auto_order_templates（自動注文テンプレート）

### CREATE TABLE定義（001_initial_schema.sql 138-147行目）

```sql
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
```

### インデックス（001_initial_schema.sql 197行目）

```sql
CREATE INDEX idx_auto_order_templates_user_id ON auto_order_templates(user_id);
```

### トリガー（001_initial_schema.sql 239-240行目）

```sql
CREATE TRIGGER update_auto_order_templates_updated_at BEFORE UPDATE ON auto_order_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### RLS有効化（001_initial_schema.sql 256行目）

```sql
ALTER TABLE auto_order_templates ENABLE ROW LEVEL SECURITY;
```

### RLSポリシー（001_initial_schema.sql 480-505行目）

```sql
-- 一般ユーザー：自分のテンプレートのみ参照
CREATE POLICY "auto_order_templates_select_own"
    ON auto_order_templates FOR SELECT
    USING (auth.uid() = user_id);

-- 一般ユーザー：自分のテンプレートのみ作成
CREATE POLICY "auto_order_templates_insert_own"
    ON auto_order_templates FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 一般ユーザー：自分のテンプレートのみ更新
CREATE POLICY "auto_order_templates_update_own"
    ON auto_order_templates FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 一般ユーザー：自分のテンプレートのみ削除
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
```

### 修正が必要な箇所
- 外部キー参照: `users_profile` → `profiles`、`menus` → `menu_items`
- RLSポリシー内の参照: `users_profile` → `profiles`

---

## 3. auto_order_run_items（自動注文実行アイテム）

### CREATE TABLE定義（001_initial_schema.sql 162-171行目）

```sql
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
```

### インデックス（001_initial_schema.sql 198-199行目）

```sql
CREATE INDEX idx_auto_order_run_items_run_id ON auto_order_run_items(run_id);
CREATE INDEX idx_auto_order_run_items_user_id ON auto_order_run_items(user_id);
```

### トリガー
- なし（001_initial_schema.sqlには該当トリガーなし。updated_atカラムがないため）

### RLS有効化（001_initial_schema.sql 258行目）

```sql
ALTER TABLE auto_order_run_items ENABLE ROW LEVEL SECURITY;
```

### RLSポリシー（001_initial_schema.sql 524-531行目）

```sql
-- 管理者のみ参照可能
CREATE POLICY "auto_order_run_items_all_admin"
    ON auto_order_run_items FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users_profile
            WHERE id = auth.uid() AND role = 'admin' AND is_active = true
        )
    );
```

### 修正が必要な箇所
- 外部キー参照: `users_profile` → `profiles`
- RLSポリシー内の参照: `users_profile` → `profiles`

---

## 共通の依存関係

### update_updated_at_column関数（001_initial_schema.sql 206-212行目）

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

この関数は既に存在している可能性が高い（他のテーブルで使用されているため）。

