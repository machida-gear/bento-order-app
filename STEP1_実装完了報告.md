# STEP1: DB DDL + RLSポリシー実装完了報告

## 実装内容

### 1. データベーススキーマ

以下の13テーブルを作成しました：

#### 基本テーブル
- **users_profile**: ユーザープロフィール（Auth.users.id参照）
- **vendors**: 業者マスタ
- **menus**: メニューマスタ
- **menu_prices**: メニュー価格（履歴管理：start_date/end_date）
- **order_days**: 注文可能日カレンダー
- **order_deadlines**: 日別締切時刻
- **orders**: 注文
- **closing_periods**: 締日期間（月次集計の境界管理）

#### 監査・自動化テーブル
- **operation_logs**: 操作ログ（監査用）
- **auto_order_settings**: 自動注文設定
- **auto_order_templates**: 自動注文テンプレート（曜日別パターン）
- **auto_order_runs**: 自動注文実行履歴
- **auto_order_run_items**: 自動注文実行アイテム（ユーザーごとの結果）

### 2. ENUM型

- **user_role**: 'user' | 'admin'
- **order_status**: 'ordered' | 'cancelled' | 'invalid'
- **auto_order_run_status**: 'running' | 'completed' | 'failed'

### 3. 制約・インデックス

- 主キー・外部キー制約
- UNIQUE制約（重複防止）
- CHECK制約（データ整合性）
- パフォーマンス向上のためのインデックス

### 4. トリガー

- `updated_at`カラムの自動更新トリガー（全テーブル）

### 5. RLS（Row Level Security）ポリシー

#### 一般ユーザー権限
- **users_profile**: 自分のプロフィールのみ参照・更新
- **orders**: 自分の注文のみ参照・作成・更新
- **auto_order_settings**: 自分の設定のみCRUD
- **auto_order_templates**: 自分のテンプレートのみCRUD
- **vendors/menus/menu_prices/order_days/order_deadlines/closing_periods**: 参照のみ（is_active=trueのみ表示）

#### 管理者権限
- 全テーブルに対してCRUD可能
- **operation_logs**: 管理者のみ参照可能（全ユーザーが記録は可能）

### 6. ヘルパー関数

#### `get_menu_price_id(menu_id, order_date)`
- 指定日付・メニューIDに対応する有効な価格IDを取得
- 価格が見つからない場合、重複する場合にエラーを投げる

#### `get_cutoff_time(order_date)`
- 指定日付の締切時刻を取得
- order_deadlinesに設定がない場合はデフォルト10:00を返す

#### `is_before_cutoff(order_date)`
- 指定日付の注文が締切前かどうかを判定（DB時刻基準）
- JST固定（UTCからAsia/Tokyoに変換して判定）

## ファイル構成

```
supabase/
└── migrations/
    ├── 001_initial_schema.sql  # メインのDDL + RLS
    ├── 002_test_data.sql      # テストデータ（開発環境用）
    └── README.md              # 実行手順・動作確認方法
```

## 実行手順

### 1. Supabase SQL Editorで実行

1. Supabase Dashboard → SQL Editor
2. `001_initial_schema.sql` の内容をすべてコピー＆ペースト
3. 「Run」ボタンをクリック
4. エラーがないことを確認

### 2. 動作確認

詳細は `supabase/migrations/README.md` を参照してください。

主要な確認項目：
- テーブル作成の確認
- ENUM型の確認
- RLS有効化の確認
- インデックスの確認
- ヘルパー関数の動作確認

### 3. テストデータ投入（オプション）

開発環境でのみ `002_test_data.sql` を実行してください。

## 重要な設計判断

### 1. ordersテーブルのUNIQUE制約

```sql
UNIQUE(user_id, menu_id, order_date, status)
```

- 同一ユーザー・同一メニュー・同一日付・同一ステータスでの重複を防ぐ
- 'ordered'と'cancelled'は別レコードとして存在可能
- 複数個注文する場合は`quantity`カラムで管理

### 2. 価格履歴管理

- `menu_prices`テーブルで`start_date`/`end_date`による期間管理
- 重複期間の検証は`get_menu_price_id`関数で実施
- 注文確定時に`menu_price_id`を固定保存（価格改定の影響を受けない）

### 3. 締切判定

- DB時刻（`CURRENT_DATE`, `CURRENT_TIME`）を基準に判定
- アプリ側の時刻は信用しない設計
- `is_before_cutoff`関数で統一判定

### 4. 自動注文の冪等性

- `auto_order_runs`で`(run_date, cutoff_time)`一意制約
- `auto_order_run_items`で`(run_id, user_id)`一意制約
- 二重実行を防止

## 次のステップ

STEP1完了後、以下を実施：

- **STEP2**: Next.js プロジェクト骨組みの作成
- **STEP3**: 認証 + users_profile同期の実装

## 注意事項

1. **管理者ユーザーの作成**
   - Auth.users作成後、手動で`users_profile`にINSERTする必要があります
   - 例：
   ```sql
   INSERT INTO users_profile (id, employee_code, name, email, role, is_active)
   VALUES ('<auth.users.id>', '0001', '管理者', 'admin@example.com', 'admin', true);
   ```

2. **タイムゾーン設定**
   - `is_before_cutoff`関数は関数内でUTCからAsia/Tokyo（JST）に変換します
   - SupabaseのデフォルトはUTCですが、関数内で変換するため追加設定は不要です

3. **RLSポリシーのテスト**
   - 一般ユーザーと管理者で異なる権限が正しく動作するか、実際にテストしてください

