# データベースマイグレーション手順

## STEP1: DB DDL + RLSポリシーの適用

### 前提条件
- Supabaseプロジェクトが作成済み
- Supabase Dashboardにアクセス可能

### 実行手順

#### 方法1: Supabase SQL Editorで実行（推奨）

1. Supabase Dashboardにログイン
2. 左メニューから「SQL Editor」を選択
3. 「New query」をクリック
4. `001_initial_schema.sql` の内容をすべてコピー＆ペースト
5. 「Run」ボタンをクリックして実行
6. エラーがないことを確認

#### 方法2: Supabase CLIで実行

```bash
# Supabase CLIがインストール済みの場合
supabase db push
```

### 動作確認手順

#### 1. テーブル作成の確認

SQL Editorで以下を実行：

```sql
-- 全テーブル一覧を確認
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

以下のテーブルが作成されていることを確認：
- users_profile
- vendors
- menus
- menu_prices
- order_days
- order_deadlines
- orders
- closing_periods
- operation_logs
- auto_order_settings
- auto_order_templates
- auto_order_runs
- auto_order_run_items

#### 2. ENUM型の確認

```sql
-- ENUM型の確認
SELECT typname, oid 
FROM pg_type 
WHERE typname IN ('user_role', 'order_status', 'auto_order_run_status');
```

#### 3. RLS有効化の確認

```sql
-- RLSが有効になっているテーブルを確認
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

すべてのテーブルで `rowsecurity = true` になっていることを確認。

#### 4. インデックスの確認

```sql
-- インデックス一覧を確認
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;
```

#### 5. ヘルパー関数の確認

```sql
-- 関数の存在確認
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_menu_price_id', 'get_cutoff_time', 'is_before_cutoff');
```

#### 6. テストデータの投入（オプション）

```sql
-- テスト用業者
INSERT INTO vendors (code, name, is_active) VALUES
('V001', 'テスト業者A', true),
('V002', 'テスト業者B', true);

-- テスト用メニュー
INSERT INTO menus (vendor_id, name, is_active) VALUES
(1, '和定食', true),
(1, '洋定食', true),
(2, 'サンドイッチセット', true);

-- テスト用価格（2024年1月1日から有効）
INSERT INTO menu_prices (menu_id, price, start_date) VALUES
(1, 600, '2024-01-01'),
(2, 700, '2024-01-01'),
(3, 500, '2024-01-01');

-- テスト用注文可能日（2024年1月）
INSERT INTO order_days (date, is_available) VALUES
('2024-01-15', true),
('2024-01-16', true),
('2024-01-17', true);

-- テスト用締切時刻
INSERT INTO order_deadlines (date, cutoff_time) VALUES
('2024-01-15', '10:00:00'),
('2024-01-16', '10:00:00'),
('2024-01-17', '10:00:00');
```

#### 7. ヘルパー関数の動作確認

```sql
-- 価格取得関数のテスト
SELECT get_menu_price_id(1, '2024-01-15'); -- メニューID=1の価格IDが返る

-- 締切時刻取得関数のテスト
SELECT get_cutoff_time('2024-01-15'); -- '10:00:00'が返る
SELECT get_cutoff_time('2024-01-20'); -- デフォルト'10:00:00'が返る

-- 締切判定関数のテスト（現在時刻に依存するため、結果は変動）
SELECT is_before_cutoff('2024-01-15');
```

### よくあるエラーと対処法

#### エラー: "relation already exists"
- テーブルが既に存在している場合
- 対処: 既存のテーブルを削除するか、`CREATE TABLE IF NOT EXISTS` に変更（ただし、このSQLは冪等性を考慮していないため、初回実行前提）

#### エラー: "permission denied"
- RLSポリシーが原因の場合
- 対処: 管理者権限で実行しているか確認

#### エラー: "function does not exist"
- 関数が作成されていない場合
- 対処: SQL全体を再実行

### 次のステップ

STEP1完了後、以下を実施：
- STEP2: Next.js プロジェクト骨組みの作成
- STEP3: 認証 + users_profile同期の実装

