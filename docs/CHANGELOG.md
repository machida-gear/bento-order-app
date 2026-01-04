# 変更履歴

このドキュメントでは、お弁当注文 Web アプリケーションの仕様や方針の変更履歴を時系列で記載します。

> 📖 **関連ドキュメント**: [README.md](./README.md) - すべてのドキュメントへの参照

---

## 2025-01-XX（Next.js 16.1.1 型エラー修正と Vercel デプロイ対応）

### Next.js 16.1.1 の型システム変更への対応

- **Route Handlers**: `params` が `Promise<{ id: string }>` 型に変更されたため、すべての動的ルートの Route Handlers を修正
- **Page Components**: `searchParams` が `Promise` 型に変更されたため、すべての Page Components を修正
- **型アサーション**: Supabase クエリ結果が `never` 型として推論される問題を解決するため、型アサーションを追加

### 修正内容

- **34 ファイル**を修正
  - API Routes: 23 ファイル
  - Page Components: 11 ファイル
  - Utility Functions: 1 ファイル

### 主な修正パターン

1. **`params` の Promise 型対応**
   ```typescript
   // 修正前
   { params }: { params: { id: string } }
   
   // 修正後
   { params }: { params: Promise<{ id: string }> }
   const resolvedParams = await Promise.resolve(params);
   ```

2. **`searchParams` の Promise 型対応**
   ```typescript
   // 修正前
   searchParams: { year?: string; month?: string }
   
   // 修正後
   searchParams: Promise<{ year?: string; month?: string }>
   const params = searchParams instanceof Promise ? await searchParams : searchParams;
   ```

3. **型アサーションの追加**
   ```typescript
   const profileTyped = profile as { 
     role?: string; 
     is_active?: boolean; 
     [key: string]: any 
   } | null;
   ```

### 結果

- すべての TypeScript 型エラーを解消
- Vercel へのデプロイが成功
- ビルドが正常に完了

> 📖 **詳細**: [Next.js16型エラー修正とVercelデプロイ対応.md](./Next.js16型エラー修正とVercelデプロイ対応.md)

---

## 2025-01-XX（初期実装）

### データベーススキーマの確定

- 13 テーブルのスキーマを確定
- RLS ポリシーの実装
- ヘルパー関数（`get_menu_price_id`、`get_cutoff_time`、`is_before_cutoff`）の実装

### 自動注文機能の追加

- 自動注文機能の仕様を確定
- 自動注文テンプレート（曜日別パターン）の仕様を確定
- 自動注文実行ロジック（既存注文がある場合はスキップ）を確定

### 価格確定方式の採用

- 注文時に `menu_price_id` を固定保存する方式を採用
- 価格改定後も過去の注文の価格が変更されないことを保証

### 締切判定の DB 時刻基準化

- 締切判定を DB 時刻（JST）基準に統一
- `is_before_cutoff` 関数で統一判定

---

## 2025-01-XX（実装開始）

### Next.js プロジェクトの初期化

- Next.js 16.1.1 (App Router) でプロジェクトを初期化
- TypeScript、Tailwind CSS を設定

### Supabase クライアントの設定

- ブラウザ用、サーバー用、ミドルウェア用の Supabase クライアントを設定
- Service Role Key 用のクライアントを設定

### 認証機能の実装

- ログイン・新規登録機能を実装
- 社員コード・氏名の入力機能を追加
- 新規登録時のプロフィール自動作成を実装

### カレンダー画面の実装

- 月間カレンダーグリッドの実装
- 注文可能日の表示
- 注文済み日の表示
- 注文不可日のグレーアウト表示
- 今日の日付の点滅表示
- 月ナビゲーション機能

---

## 2025-01-XX（テーブル名の調整）

### テーブル名の実際の DB との整合

- `users_profile` → `profiles`（実際のテーブル名に合わせて調整）
- `menus` → `menu_items`（実際のテーブル名に合わせて調整）
- `order_days` → `order_calendar`（実際のテーブル名に合わせて調整）
- `operation_logs` → `audit_logs`（実際のテーブル名に合わせて調整）
- `auto_order_settings` → `auto_order_configs`（実際のテーブル名に合わせて調整）

### カラム名の実際の DB との整合

- `profiles.name` → `profiles.full_name`（実際のカラム名に合わせて調整）
- `order_calendar.date` → `order_calendar.target_date`（実際のカラム名に合わせて調整）
- `order_calendar.special_note` → `order_calendar.note`（実際のカラム名に合わせて調整）
- `order_calendar.deadline_time` を追加（実際のテーブル構造に合わせて調整）

---

## 2025-01-XX（注文可否判定ロジックの改善）

### 過去の日付の判定を追加

- 過去の日付は注文不可とする判定を追加
- セルの背景色を過去の日付でもグレーアウト表示

### 締切時刻の判定を改善

- 今日の日付で締切時刻を過ぎた場合は注文不可とする判定を追加
- クライアント側の時刻ではなく、サーバー側の時刻で判定

---

## 2025-12-29（データベース構造の確認と修正）

### データベース構造の違いを確認

- `menu_prices`テーブルのカラム名が`menu_id`ではなく`menu_item_id`であることを確認
- テストデータ投入 SQL（`027_insert_current_date_test_data.sql`）を実際の構造に合わせて修正
- `ON CONFLICT`句を`NOT EXISTS`による重複チェックに変更（UNIQUE 制約がない場合に対応）

### 動作確認用 SQL の作成

- `026_check_order_test_data.sql`: データベース状態確認用
- `027_insert_current_date_test_data.sql`: テストデータ投入用（修正版）
- `028_check_table_structure.sql`: テーブル構造確認用
- `029_check_unique_constraints.sql`: UNIQUE 制約確認用
- `030_check_existing_menu_items.sql`: 既存メニュー確認用

### ドキュメントの追加

- `docs/データベース構造の注意事項.md`: 実際のデータベース構造と初期スキーマの違いを記録

---

## 2025-12-30（新規注文画面のメニュー表示問題の解決）

### 問題

- 新規注文画面で「選択可能なメニューがありません」と表示される
- データベースには業者とメニューのデータが存在しているが、アプリケーションから取得できない

### 原因

- `vendors`テーブルと`menu_items`テーブルに RLS ポリシーが設定されていなかった
- クエリで`vendors`との JOIN を使用していたため、RLS ポリシーが干渉していた可能性

### 解決策

1. **RLS ポリシーの作成**

   - `033_create_menu_items_select_policy.sql`: `menu_items`テーブルに RLS ポリシーを作成
   - `036_create_vendors_select_policy.sql`: `vendors`テーブルに RLS ポリシーを作成
   - 一般ユーザーは`is_active = true`のレコードのみ参照可能

2. **クエリロジックの改善**

   - `app/(user)/orders/new/page.tsx`: `vendors`との JOIN を削除し、メニューを直接取得
   - `menu.vendor_id`を使用して業者別にグループ化

3. **診断用 SQL の作成**
   - `031_check_menu_availability.sql`: メニュー表示問題の診断用
   - `032_check_rls_policies.sql`: RLS ポリシーの確認用
   - `034_verify_menu_items_policy.sql`: `menu_items`テーブルの RLS ポリシー検証用
   - `035_check_vendors_policy.sql`: `vendors`テーブルの RLS ポリシー確認用
   - `037_check_auth_and_profile.sql`: 認証状態とプロフィールの確認用

### 修正ファイル

- `app/(user)/orders/new/page.tsx`: クエリロジックの改善、デバッグコードの削除
- `components/order-form.tsx`: 型定義の修正、デバッグコードの削除

### ドキュメントの追加

- `docs/メニュー表示問題の解決手順.md`: 問題解決の詳細な手順を記録

---

## 2025-12-30（注文機能の実装と問題解決）

### 注文機能の実装

- 新規注文画面に注文確定ボタンを配置
- 注文フォームの送信処理を実装
- 注文 API（`app/api/orders/route.ts`）のエラーハンドリングを改善

### 問題

- 注文確定ボタンを押しても 500 エラーが発生する
- `get_menu_price_id`関数が正しく動作していない可能性

### 原因の調査

- `get_menu_price_id`関数が`menu_id`を使用しているが、実際のテーブルは`menu_item_id`を使用
- 価格データは存在しているが、関数が正しく更新されていない可能性

### 対応

1. **関数の修正 SQL の作成**

   - `038_fix_get_menu_price_id_function.sql`: `get_menu_price_id`関数を`menu_item_id`を使用するように修正

2. **診断用 SQL の作成**

   - `039_check_get_menu_price_id_function.sql`: 関数の定義と価格データの確認用
   - `040_test_get_menu_price_id_directly.sql`: 関数の直接テスト用

3. **エラーハンドリングの改善**
   - `app/api/orders/route.ts`: 詳細なエラーメッセージとログを追加

### 修正ファイル

- `app/api/orders/route.ts`: エラーハンドリングの改善、デバッグログの追加
- `components/order-form.tsx`: デバッグログの追加、エラーメッセージの改善
- `app/(user)/orders/new/page.tsx`: 下部パディングの追加（ナビゲーションバー対策）

### 確認事項

- 価格データは存在している（039 の SQL 実行結果で確認）
- すべてのメニューに有効な価格データが設定されている
- `get_menu_price_id`関数のテストが成功（042 の SQL 実行結果: price_id=9 が正常に返された）

### 追加の診断用 SQL

- `041_verify_function_and_fix.sql`: 関数の状態確認と修正案内用
- `042_check_function_definition_full.sql`: 関数の定義を完全に確認する用

---

## 2025-12-30（データベーススキーマの確認とコード修正）

### 実際のデータベーススキーマの確認

- 13 個のテーブル定義を確認し、実際のスキーマを`docs/実際のデータベーススキーマ.md`に記録
- 初期スキーマとの違いを確認（テーブル名、カラム名、データ型など）

### コードの修正

- `orders`テーブル: `menu_id` → `menu_item_id`に修正
- `audit_logs`テーブル: `actor_user_id` → `actor_id`に修正
- `audit_logs`テーブル: `detail` → `details`に修正
- `orders`テーブルへの INSERT 時に`unit_price_snapshot`と`source`カラムを追加
- `.catch()`の誤用を修正（try-catch ブロックに変更）

### 修正ファイル

- `app/api/orders/route.ts`: 注文作成 API の修正
- `app/api/orders/[id]/route.ts`: 注文キャンセル API の修正

### ドキュメントの追加

- `docs/実際のデータベーススキーマ.md`: 13 個のテーブルの詳細なスキーマ定義を追加

---

## 2025-12-30（カレンダー注文表示機能の実装）

### 注文内容の表示機能

- カレンダーで注文済みの日にメニュー名と数量を表示
- 注文がある日は「注文可」ボタンを非表示
- 注文がない日のみ「注文可」ボタンを表示

### 注文変更機能

- 注文編集画面（`app/(user)/orders/[id]/edit/page.tsx`）を作成
- 注文編集フォームコンポーネント（`components/order-edit-form.tsx`）を作成
- 注文更新 API（`PUT /api/orders/[id]`）を実装
- 締切時刻前の注文は変更可能
- カレンダーの注文内容をクリックすると編集画面に遷移

### 同日の重複注文防止

- 注文作成時に同日の既存注文をチェック
- 異なるメニューでも 1 日 1 注文のみ許可
- 既存注文がある場合はエラーメッセージを表示

### 技術的な修正

- 型定義と実際の DB 構造の不一致を解決（`menu_id` → `menu_item_id`）
- bigint 型の処理を改善（文字列として扱い、適切に変換）
- メニューデータの結合ロジックを改善（別々に取得してサーバー側で結合）
- デバッグログを追加してデータ取得状況を確認可能に

### 修正ファイル

- `app/(user)/calendar/page.tsx`: 注文データとメニューデータの取得・結合ロジックを改善
- `components/calendar-grid.tsx`: 注文内容の表示とクリック機能を追加
- `app/api/orders/[id]/route.ts`: 注文更新 API を追加
- `app/(user)/orders/[id]/edit/page.tsx`: 注文編集画面を作成（新規）
- `components/order-edit-form.tsx`: 注文編集フォームを作成（新規）
- `app/api/orders/route.ts`: 同日の既存注文チェックを追加

### ドキュメントの追加

- `docs/カレンダー注文表示機能の実装.md`: 実装内容の詳細を記録

---

## 2025-12-30（カレンダー注文表示問題のデバッグ）

### 問題

- 2026/01/01 に注文を入れたが、カレンダー上では「注文可」と表示されてしまう
- 注文がある日にメニュー名と数量が表示されない

### 症状

- ブラウザコンソール: `ordersMap keys: []`、`order found: false`
- サーバー側ログ: `Orders fetched: 0`、`All orders (without date filter): 0`
- エラーは発生していないが、注文データが取得できていない

### デバッグの実施

- 認証状態の確認ログを追加（`=== Authentication Debug ===`）
- セッション状態の確認ログを追加（`=== Session Debug ===`）
- Service Role Key を使用した直接確認を追加（`=== Admin query (RLS bypassed) ===`）
- 日付フィルターなしでの取得確認を追加
- 詳細なデバッグログを追加

### 確認結果

- ✅ 認証は正しく動作している（User ID: `31dc22bf-0b07-4933-a67d-843bc9a5b6aa`）
- ✅ Session も正しく取得できている
- ❌ 注文データが取得できていない（RLS ポリシーまたはデータの問題の可能性）

### 修正ファイル

- `app/(user)/calendar/page.tsx`: デバッグログの追加、Service Role Key での確認を追加
- `components/calendar-grid.tsx`: デバッグログの追加

### ドキュメントの追加

- `docs/カレンダー注文表示問題のデバッグと解決.md`: デバッグの過程と問題の記録

### 次のステップ

- Service Role Key での確認結果を確認して原因を特定
- RLS ポリシーの問題またはデータベースのデータの問題を修正

---

## 2025-12-31（カレンダー注文表示問題の解決とキャンセル機能の追加）

### カレンダー注文表示問題の解決

#### 問題の原因

- Service Role Key では注文データが取得できていたが、通常のクライアントでは取得できなかった
- RLS ポリシーが正しく設定されていたが、実際のデータベースでは `profiles` テーブルを使用していることを確認

#### 解決策

1. **RLS ポリシーの確認と修正**

   - `045_check_and_fix_orders_rls.sql` を作成して RLS ポリシーを確認
   - `profiles` テーブルを参照するように RLS ポリシーを再作成
   - 実際のデータベース構造に合わせてポリシーを修正

2. **createAdminClient エラーの修正**
   - `lib/supabase/admin.ts` では `supabaseAdmin` が直接エクスポートされていることを確認
   - `app/(user)/calendar/page.tsx` のインポートを修正（`createAdminClient()` → `supabaseAdmin`）

#### 修正ファイル

- `app/(user)/calendar/page.tsx`: Service Role Key のインポート方法を修正
- `supabase/migrations/045_check_and_fix_orders_rls.sql`: RLS ポリシー確認・修正用 SQL を作成

### 注文キャンセル機能の追加

#### 実装内容

- 注文編集画面に「注文を取りやめる」ボタンを追加
- 確認ダイアログを表示してからキャンセルを実行
- キャンセル API（`PATCH /api/orders/[id]`）を呼び出し
- 成功後、カレンダーページにリダイレクト

#### 問題と解決

1. **enum 型の不一致エラー**

   - エラー: `invalid input value for enum order_status: "cancelled"`
   - 原因: データベースの enum 型は `canceled`（1 つの 'l'）だが、コードでは `cancelled`（2 つの 'l'）を使用していた
   - 解決: コード内の `'cancelled'` を `'canceled'` に修正

2. **修正したファイル**
   - `app/api/orders/[id]/route.ts`: 3 箇所（キャンセル済みチェック、ステータス更新）
   - `app/(user)/orders/page.tsx`: 2 箇所（キャンセル済み表示判定）
   - `lib/database.types.ts`: 型定義（`OrderStatus` 型）

#### 修正ファイル

- `components/order-edit-form.tsx`: キャンセル機能を追加
- `app/api/orders/[id]/route.ts`: enum 型の不一致を修正
- `app/(user)/orders/page.tsx`: enum 型の不一致を修正
- `lib/database.types.ts`: 型定義を修正

### コードのクリーンアップ

- `app/(user)/calendar/page.tsx`: デバッグログを削除
- `components/calendar-grid.tsx`: デバッグログを削除

### 診断用 SQL の作成

- `046_check_order_status_enum.sql`: enum 型の値を確認する SQL
- `047_add_cancelled_to_order_status_enum.sql`: enum 型に値を追加する SQL（未使用）

### 確認事項

- ✅ カレンダー画面で注文が正しく表示される
- ✅ 注文編集画面から注文の変更ができる
- ✅ 注文編集画面から注文のキャンセルができる
- ✅ RLS ポリシーが正しく動作している

---

## 2025-01-XX（注文履歴画面の金額表示問題の修正）

### 問題

- 注文履歴画面で注文の金額が 0 円と表示される

### 原因

- `menu_prices`テーブルから価格を取得しようとしていたが、RLS ポリシーや JOIN の問題で取得できていなかった
- 実際のデータベースでは`orders`テーブルに`unit_price_snapshot`カラム（注文時の単価スナップショット）が保存されている

### 解決策

1. **注文履歴画面の修正**

   - `menu_prices`テーブルへの JOIN を削除
   - `orders`テーブルの`unit_price_snapshot`カラムを使用
   - 金額計算を`unit_price_snapshot * quantity`に変更

2. **型定義の更新**
   - `orders`テーブルの型定義を実際のデータベーススキーマに合わせて更新
   - `menu_id` → `menu_item_id`に変更
   - `unit_price_snapshot: number`を追加
   - `source: string`を追加
   - `created_at`と`updated_at`を`string | null`に変更

### 修正ファイル

- `app/(user)/orders/page.tsx`: 金額表示ロジックの修正
- `lib/database.types.ts`: 型定義の更新

### 確認事項

- ✅ 注文履歴画面に正しい金額が表示される
- ✅ 価格改定後も過去の注文の金額は正確に表示される（注文時の価格スナップショットを使用）

---

## 2025-01-XX（自動注文設定画面の実装）

### 実装内容

- 自動注文設定画面にお弁当選択機能を追加
- テンプレートの作成・編集・削除機能を実装
- 曜日別テンプレート設定機能を実装

### 機能詳細

1. **テンプレート管理**

   - 曜日別（日曜日〜土曜日、毎日）にテンプレートを設定可能
   - メニュー選択（業者別にグループ化）
   - 数量設定（1 以上）
   - テンプレートの追加・編集・削除

2. **重複チェック機能**
   - 同じ曜日に複数のテンプレートを設定できない
   - 毎日テンプレートと特定の曜日テンプレートを同時に設定できない
   - UI で既に設定されている曜日を選択できないように表示
   - 保存時に重複チェックを実行してエラーメッセージを表示

### 実装ファイル

- `app/(user)/settings/auto-order/page.tsx`: サーバーコンポーネント（メニュー一覧取得）
- `app/(user)/settings/auto-order/auto-order-settings-client.tsx`: クライアントコンポーネント（UI 実装）
- `lib/database.types.ts`: 型定義の更新（`auto_order_templates`テーブル）

### 確認事項

- ✅ テンプレートの作成・編集・削除が正常に動作する
- ✅ 重複チェックが正しく機能する
- ✅ 同じ曜日に複数のテンプレートを設定できない
- ✅ 毎日テンプレートと特定の曜日テンプレートの競合を防止

---

## 2025-01-XX（自動注文実行機能の実装）

### 実装内容

- 自動注文実行 API の実装
- Vercel Cron Jobs の設定
- 認証機能の実装

### 機能詳細

1. **自動注文実行 API** (`app/api/auto-order/run/route.ts`)

   - 翌営業日の判定（`order_calendar`テーブルから`is_available = true`の最初の日を取得）
   - 既存注文チェック（対象日に既に注文がある場合はスキップ）
   - テンプレート適用（曜日別テンプレートまたは毎日テンプレート）
   - 優先順位: 特定の曜日のテンプレート > 毎日テンプレート
   - 実行履歴記録（`auto_order_runs`と`auto_order_run_items`テーブル）

2. **Vercel Cron Jobs の設定** (`vercel.json`)

   - 毎日 10:00（JST）に自動実行
   - `/api/auto-order/run`エンドポイントを呼び出し

3. **認証機能**
   - Vercel Cron Jobs からの呼び出し: `x-vercel-cron`ヘッダーで自動認証
   - 開発環境・手動実行: `Authorization`ヘッダーで認証（`AUTO_ORDER_SECRET`を使用）

### 実装ファイル

- `app/api/auto-order/run/route.ts`: 自動注文実行 API
- `vercel.json`: Vercel Cron Jobs 設定
- `lib/database.types.ts`: 型定義の更新（`auto_order_runs`テーブル）

### 確認事項

- ✅ 自動注文実行 API が正常に動作する
- ✅ 翌営業日が正しく判定される
- ✅ 既存注文がある場合はスキップされる
- ✅ テンプレートが正しく適用される
- ✅ 実行履歴が記録される

---

## 2025-01-XX（ドキュメント整備）

### 実装内容

- ドキュメント参照システムの構築
- 運用ドキュメントの作成

### 作成・更新したドキュメント

1. **README.md** (`docs/README.md`)

   - すべてのドキュメントへの参照と分類
   - チャット開始時の依頼文テンプレート
   - ドキュメントの読み方ガイド

2. **環境変数設定手順.md** (`docs/環境変数設定手順.md`)

   - Vercel での環境変数設定手順
   - ローカル開発環境での設定手順
   - トラブルシューティング

3. **本番環境デプロイ時のチェックリスト.md** (`docs/本番環境デプロイ時のチェックリスト.md`)

   - デプロイ前の確認事項
   - デプロイ手順
   - デプロイ後の確認事項

4. **各基本ドキュメントへの参照追加**
   - `CHANGELOG.md`、`DECISIONS.md`、`PROGRESS.md`、`SPEC.md`、`TODO.md`に README.md へのリンクを追加

### 確認事項

- ✅ README.md からすべてのドキュメントへの参照が確認できる
- ✅ ドキュメントが適切に分類されている
- ✅ チャット開始時の依頼文テンプレートが記載されている

---

## 2025-01-XX（管理者機能の実装）

### 管理者機能の実装

#### カレンダー管理画面

- `app/admin/calendar/page.tsx` の実装
- 月間カレンダー表示（管理者用）
- 日付クリックで注文可能日の設定
- `is_available` の切り替え
- `deadline_time` の設定
- `note` の入力
- 更新 API（`PUT /api/admin/calendar`）

#### 業者管理画面

- `app/admin/vendors/page.tsx` の実装
- 業者一覧表示
- 業者追加・編集・削除機能（`is_active = false` に設定）
- CRUD API（`GET/POST /api/admin/vendors`, `PUT/DELETE /api/admin/vendors/[id]`）
- 業者コードの重複チェック

#### メニュー管理画面

- `app/admin/menus/page.tsx` の実装
- メニュー一覧表示（業者別にグループ化）
- メニュー追加・編集・削除機能（`is_active = false` に設定）
- CRUD API（`GET/POST /api/admin/menus`, `PUT/DELETE /api/admin/menus/[id]`）

#### 価格管理画面

- `app/admin/prices/page.tsx` の実装
- 価格履歴一覧表示（メニュー別にグループ化）
- 価格追加・編集・削除機能
- 期間管理（`start_date`、`end_date`）
- 期間の重複チェック
- CRUD API（`GET/POST /api/admin/prices`, `PUT/DELETE /api/admin/prices/[id]`）

#### 集計・CSV 出力画面

- `app/admin/reports/page.tsx` の実装
- 締日期間の選択（`closing_periods` テーブルから取得）
- 集計データの取得・表示（注文一覧、合計金額）
- CSV 出力機能（`GET /api/admin/reports/csv`）
- CSV ファイルのダウンロード
- 集計データ取得 API（`GET /api/admin/reports/summary`）
- 締日期間一覧取得 API（`GET /api/admin/closing-periods`）

### ルート構造の修正

- ルートグループの衝突問題を解決
- `app/(admin)/calendar` → `app/admin/calendar` に移動（ルートグループから通常のフォルダに変更）
- すべての管理者用ページを `app/admin/` 配下に統一
- これにより、ユーザー用の `/calendar` と管理者用の `/admin/calendar` が正しく区別されるように

### 実装ファイル

- `app/admin/calendar/page.tsx`: カレンダー管理画面
- `app/admin/vendors/page.tsx`: 業者管理画面
- `app/admin/menus/page.tsx`: メニュー管理画面
- `app/admin/prices/page.tsx`: 価格管理画面
- `app/admin/reports/page.tsx`: 集計・CSV 出力画面
- `app/admin/layout.tsx`: 管理者用レイアウト（`app/(admin)/layout.tsx` から移動）
- `app/admin/page.tsx`: 管理者ダッシュボード（`app/(admin)/admin/page.tsx` から移動）
- `app/api/admin/calendar/route.ts`: カレンダー管理 API
- `app/api/admin/vendors/route.ts`: 業者管理 API
- `app/api/admin/vendors/[id]/route.ts`: 業者管理 API（個別）
- `app/api/admin/menus/route.ts`: メニュー管理 API
- `app/api/admin/menus/[id]/route.ts`: メニュー管理 API（個別）
- `app/api/admin/prices/route.ts`: 価格管理 API
- `app/api/admin/prices/[id]/route.ts`: 価格管理 API（個別）
- `app/api/admin/reports/summary/route.ts`: 集計データ取得 API
- `app/api/admin/reports/csv/route.ts`: CSV 出力 API
- `app/api/admin/closing-periods/route.ts`: 締日期間一覧取得 API

### 技術的な注意事項

- `menu_prices` テーブルのカラム名は実際の DB では `menu_item_id` だが、型定義では `menu_id` となっている
- 価格管理 API では `as any` を使用してこの不一致に対応
- 期間の重複チェックは簡易実装（完全なチェックは `get_menu_price_id` 関数で実行）

### 確認事項

- ✅ カレンダー管理画面が正常に動作する
- ✅ 業者管理画面が正常に動作する
- ✅ メニュー管理画面が正常に動作する
- ✅ 価格管理画面が正常に動作する
- ✅ 集計・CSV 出力画面が正常に動作する
- ✅ ルート構造の衝突が解決された

---

## 2025-01-XX（カレンダー管理機能の改善とシステム設定機能の実装）

### カレンダー管理画面の改善

#### チェックボックスを False にした時のエラー修正

- **問題**: 注文可能のチェックボックスを False にして保存したらエラーが発生
- **原因**: データベースから取得した`deadline_time`が`HH:MM:SS`形式で、API が`HH:MM`形式を期待していた
- **解決策**:
  - `formatTime`関数を追加し、`HH:MM:SS`形式を`HH:MM`形式に変換
  - チェックボックスが False の場合、`deadline_time`を`null`に設定
  - `deadline_time`カラムを NULL 許可に変更（`050_allow_null_deadline_time.sql`）

#### 複数日選択機能の実装

- 「複数日を選択して一括編集」チェックボックスで一括編集モードに切り替え
- 一括編集モードでは、各日付にチェックボックスを表示
- 複数日を選択して「選択した X 日を注文可能にする」「選択した X 日を注文不可にする」ボタンで一括更新
- エラーハンドリングを改善し、失敗した日付とエラー内容を詳細に表示

#### 備考入力欄の追加

- 複数日一括編集モードで日付を選択すると、備考入力欄が表示される
- 入力した備考は、選択したすべての日付に適用される

#### 月一括編集機能の実装

- 月一括編集ボタンを追加
- システム設定から曜日ごとの設定を読み込んで適用
- 現在表示中の月のすべての日付を一括設定

#### RLS ポリシーの修正

- **問題**: カレンダー設定の更新時に RLS ポリシー違反エラー（`42501`）が発生
- **原因**: `order_calendar_all_admin`ポリシーに`is_active = true`のチェックが含まれていなかった
- **解決策**: RLS ポリシーを再作成し、`is_active = true`チェックを含めるように修正

### システム設定機能の実装

#### システム設定テーブルの作成

- `system_settings`テーブルを作成（シングルトンパターン、id=1 のみ）
- カラム:
  - `default_deadline_time`: デフォルト締切時刻（TIME 型）
  - `closing_day`: 締め日（1〜31 日、INTEGER 型）
  - `day_of_week_settings`: 曜日ごとの設定（JSONB 型）
- RLS ポリシー: 全ユーザーが参照可能、管理者のみ更新可能

#### システム設定画面の作成

- システム設定画面（`app/admin/settings/page.tsx`）を作成
- 以下の設定が可能:
  1. デフォルト締切時刻
  2. 締め日（毎月）
  3. 曜日ごとのデフォルト設定（月一括編集で使用）

#### カレンダー画面での設定読み込み

- カレンダー画面でシステム設定を読み込むように変更
- 月一括編集で設定から曜日ごとの設定を読み込むように変更
- 複数日一括編集でデフォルト締切時刻を使用するように変更

### エラー修正

- 設定画面の締め日入力欄で`NaN`エラーが発生していた問題を修正
- バリデーションを改善し、空文字や無効な値の入力を防止

### 修正ファイル

- `app/admin/calendar/page.tsx`: カレンダー管理画面の改善
- `app/admin/settings/page.tsx`: システム設定画面の作成
- `app/api/admin/calendar/route.ts`: カレンダー管理 API の改善
- `app/api/admin/settings/route.ts`: システム設定 API の作成
- `components/admin-nav.tsx`: ナビゲーションメニューの更新
- `supabase/migrations/048_create_order_calendar_admin_policy.sql`: RLS ポリシー確認・修正用
- `supabase/migrations/049_debug_order_calendar_rls.sql`: RLS ポリシー問題のデバッグ用
- `supabase/migrations/050_allow_null_deadline_time.sql`: `deadline_time`カラムを NULL 許可に変更
- `supabase/migrations/051_create_system_settings_table.sql`: システム設定テーブルの作成

### ドキュメントの追加

- `docs/カレンダー管理機能の改善とシステム設定機能の実装.md`: 実装内容の詳細を記録

---

## 将来の変更予定

### 複数業者対応

- `vendor_holidays` テーブルの追加（業者別の休業日管理）
- 注文可能日の判定ロジックの更新（少なくとも 1 社が営業していれば OK）

### 管理者画面の機能拡張（一部完了）

- ✅ カレンダー管理画面の実装（GUI で注文可能日を設定） - **完了**
- ✅ 業者・メニュー・価格管理画面の実装 - **完了**
- ✅ 集計・CSV 出力機能の実装 - **完了**
- ✅ システム設定画面の実装 - **完了**
- ✅ ユーザー管理画面の実装 - **完了**
- 自動注文の手動実行機能の追加
- より詳細な集計・レポート機能
- 操作ログ閲覧画面の実装

---

## 2025-01-XX（システム設定機能の拡張とユーザー管理機能の実装）

### システム設定の締め日を月末締めに対応

#### 問題

- システム設定の締め日が 1 ～ 31 日の固定日付のみ設定可能
- 月末締め（月によって 28 ～ 31 日）を設定できない

#### 解決策

- `closing_day`カラムを NULL 許可に変更（NULL = 月末締め）
- システム設定画面に「指定日」と「月末締め」のラジオボタンを追加
- 「指定日」選択時のみ 1 ～ 31 日の入力欄を表示

#### 修正ファイル

- `supabase/migrations/052_allow_null_closing_day_for_month_end.sql`: `closing_day`カラムを NULL 許可に変更
- `app/admin/settings/page.tsx`: UI 更新（ラジオボタン追加）
- `app/api/admin/settings/route.ts`: バリデーション更新（NULL を許可）

### システム設定画面の締め日入力欄の修正

#### 問題

- 指定日を選択した場合、十の位の数字が 2 で固定されていて変更できない

#### 解決策

- 入力タイプを`type="number"`から`type="text"`に変更
- `inputMode="numeric"`と`pattern="[0-9]*"`を追加
- 数値のみを許可する正規表現チェックを追加

#### 修正ファイル

- `app/admin/settings/page.tsx`: 入力欄の修正

### カレンダー設定の一括設定時のエラー修正

#### 問題

- カレンダー設定で一括設定を実行すると、締切時刻の形式エラーが発生
- エラーメッセージ: 「締切時刻の形式が正しくありません (HH:MM 形式で入力してください)」

#### 原因

- データベースから取得した`default_deadline_time`が`HH:MM:SS`形式（例：`10:00:00`）
- API が`HH:MM`形式を期待していた

#### 解決策

- 月一括編集と複数日一括編集で、`formatTime()`関数を使用して`HH:MM`形式に変換してから送信

#### 修正ファイル

- `app/admin/calendar/page.tsx`: `formatTime()`関数の適用

### 最大注文可能日数の設定機能追加

#### 実装内容

- システム設定に「最大注文可能日数」設定項目を追加
- 1 ～ 365 日の範囲で設定可能（デフォルト: 30 日）
- 設定日数を超える未来の日付の「注文可」ボタンをグレーアウト表示

#### 実装詳細

1. **データベーススキーマの更新**

   - `053_add_max_order_days_ahead.sql`を作成
   - `system_settings`テーブルに`max_order_days_ahead`カラムを追加

2. **システム設定画面の更新**

   - 「最大注文可能日数」設定項目を追加

3. **カレンダー画面の更新**

   - システム設定から`max_order_days_ahead`を取得
   - 設定日数を超える未来の日付の「注文可」ボタンをグレーアウト表示

4. **注文画面・API の更新**
   - 日数制限をチェックし、制限を超える場合はエラーメッセージを返す

#### 修正ファイル

- `supabase/migrations/053_add_max_order_days_ahead.sql`: カラム追加
- `app/admin/settings/page.tsx`: 設定項目追加
- `app/api/admin/settings/route.ts`: バリデーション追加
- `app/(user)/calendar/page.tsx`: システム設定取得
- `components/calendar-grid.tsx`: 日数制限チェックとグレーアウト表示
- `app/(user)/orders/new/page.tsx`: 日数制限チェック
- `app/api/orders/route.ts`: 日数制限チェック

### 注文不可設定時のグレーアウトボタン非表示

#### 実装内容

- 最大注文可能日数を超えた日付について、注文不可設定（`is_available === false`）の場合は、グレーアウトした「注文可」ボタンも表示しない

#### 修正ファイル

- `components/calendar-grid.tsx`: 表示ロジックの更新

### 管理画面ナビゲーションから「締日設定」メニューを削除

#### 実装内容

- 管理画面の左側ナビゲーションから「締日設定」メニュー項目を削除
- 締日設定はシステム設定画面（`/admin/settings`）の「締め日（毎月）」セクションから行えるため

#### 修正ファイル

- `components/admin-nav.tsx`: メニュー項目の削除

### ユーザー管理画面の実装

#### 実装内容

- ユーザー管理画面（`/admin/users`）を作成
- ユーザー一覧表示（社員コード、氏名、メール、権限、入社日、退職日、状態）
- ユーザー編集機能
- ユーザー削除機能（`is_active = false`に設定）

#### 実装詳細

1. **ユーザー管理画面**

   - `app/admin/users/page.tsx`を作成

2. **ユーザー管理 API**

   - `GET /api/admin/users` - ユーザー一覧取得
   - `PUT /api/admin/users/[id]` - ユーザー更新
   - `DELETE /api/admin/users/[id]` - ユーザー削除

3. **機能詳細**
   - 社員コードの重複チェック
   - 社員コードは 4 桁の数字のみ許可
   - 退職日を設定すると自動的に`is_active = false`に設定
   - 自分自身を削除できないようにチェック

#### 注意事項

- 新規ユーザー作成は、Supabase Auth との連携が必要なため、現在はエラーメッセージを返します
- 新規ユーザーは認証画面（`/login`）から新規登録を行い、その後この画面で情報を編集してください

#### 実装ファイル

- `app/admin/users/page.tsx`: ユーザー管理画面（新規作成）
- `app/api/admin/users/route.ts`: ユーザー管理 API（新規作成）
- `app/api/admin/users/[id]/route.ts`: ユーザー管理 API（個別）（新規作成）

### ドキュメントの追加

- `docs/システム設定機能の拡張とユーザー管理機能の実装.md`: 実装内容の詳細を記録

---

## 2025-01-XX（ユーザー管理機能の改善とセキュリティ強化）

### ユーザー管理 API の 403 エラー修正

#### 問題

- 管理者ユーザーでユーザー管理画面にアクセスすると、403 Forbidden エラーが発生
- Service Role Key を使用していないため、RLS ポリシーの干渉で管理者権限チェックが失敗

#### 解決策

- ユーザー管理 API（`app/api/admin/users/route.ts`、`app/api/admin/users/[id]/route.ts`）の管理者権限チェックとユーザー一覧取得に Service Role Key（`supabaseAdmin`）を使用
- RLS ポリシーをバイパスして、プロフィール情報を取得可能に

#### 修正ファイル

- `app/api/admin/users/route.ts`: Service Role Key を使用するように修正
- `app/api/admin/users/[id]/route.ts`: Service Role Key を使用するように修正

### 退職日の処理ロジック改善

#### 問題

- 退職日が設定されている場合、未来・過去に関係なく常に`is_active = false`になっていた
- 未来の退職日を設定した場合でも、即座に無効化されてしまい、システムが使えなくなる

#### 解決策

- 退職日が未来（今日以降）の場合は`is_active = true`のまま（在籍中として扱う）
- 退職日が過去（今日より前）の場合は`is_active = false`に自動設定（退職済みとして扱う）
- 退職日が未設定の場合は`is_active`の値をそのまま使用

#### 修正ファイル

- `app/api/admin/users/[id]/route.ts`: 退職日の処理ロジックを改善

### 退職日の自動無効化処理の実装

#### 実装内容

- 退職日の翌日から自動的にユーザーを無効化する Cron Job を実装
- 毎日午前 0 時（JST）に自動実行されるバッチ処理
- `order_calendar`テーブルで、退職日が過去の日付で`is_active = true`のユーザーを自動的に無効化

#### 実装ファイル

- `app/api/admin/users/deactivate-expired/route.ts`: 退職済みユーザーの自動無効化 API（新規作成）
- `vercel.json`: Cron Job の設定を追加

### 注文 API でのユーザー状態チェック追加

#### 実装内容

- 注文作成・更新・キャンセル API で、ユーザーの`is_active`と退職日をチェック
- 無効ユーザー（`is_active = false`）は注文不可
- 退職日が過去の日付のユーザーは注文不可

#### 実装ファイル

- `app/api/orders/route.ts`: `is_active`と退職日チェックを追加
- `app/api/orders/[id]/route.ts`: `is_active`と退職日チェックを追加（PUT、PATCH）
- `app/(user)/layout.tsx`: 退職日チェックを追加（レイアウトレベルでログアウト）

### ユーザー管理画面の改善

#### 新規作成機能の削除

- ユーザー管理画面から新規作成ボタンとフォームを削除
- 新規ユーザー作成は認証画面（`/login`）から行う仕様に統一
- 管理者画面では既存ユーザーの編集のみ可能

#### パスワードリセット機能の実装

- **管理者画面からのパスワードリセット**

  - ユーザー一覧に「リセット」ボタンを追加（メールアドレスがある場合のみ表示）
  - パスワードリセットメールを送信する機能
  - `app/api/admin/users/[id]/reset-password/route.ts`: パスワードリセット API（新規作成）

- **ログインページからのパスワードリセット**
  - 「パスワードを忘れた方はこちら」リンクを追加
  - メールアドレスを入力してパスワードリセットメールを送信

#### UI 改善

- パスワードリセットボタンのテキストを「パスワードリセット」から「リセット」に短縮
- ボタンのサイズを小さくし、行の高さを抑えて一画面に表示できるユーザー数を増加

#### 修正ファイル

- `app/admin/users/page.tsx`: 新規作成機能削除、パスワードリセット機能追加、UI 改善
- `app/(auth)/login/page.tsx`: パスワードリセット機能追加
- `app/api/admin/users/[id]/reset-password/route.ts`: パスワードリセット API（新規作成）

### デフォルト締切時刻変更時の自動更新機能

#### 実装内容

- システム設定でデフォルト締切時刻を変更した場合、`order_calendar`テーブルの締切時刻を自動更新
- 更新対象：今日以降の日付で、`deadline_time`が NULL でないレコード
- システム設定画面から API Route（`/api/admin/settings`）経由で更新するように変更

#### 実装詳細

- 時刻形式の統一処理を追加（DB は`HH:MM:SS`形式、リクエストは`HH:MM`形式）
- 変更検知ロジックを改善（時刻形式を統一してから比較）
- デバッグログを追加して更新処理を確認可能に

#### 修正ファイル

- `app/api/admin/settings/route.ts`: デフォルト締切時刻変更時の`order_calendar`更新処理を追加
- `app/admin/settings/page.tsx`: 直接更新から API Route 経由の更新に変更

### 診断用 SQL ファイルの作成

- `supabase/migrations/054_check_current_user_profile.sql`: ユーザープロフィール確認用 SQL
- `supabase/migrations/055_fix_user_admin_role.sql`: ユーザーを管理者に設定する SQL
- `supabase/migrations/056_activate_admin_user.sql`: 管理者ユーザーを有効化する SQL

---

## 2025-01-XX（ルート衝突エラーの解決とシステム設定・レポート・価格管理機能の改善）

### ルート衝突エラーの解決

#### 問題

- Next.js のビルドエラー: `You cannot have two parallel pages that resolve to the same path. Please check /(admin)/calendar and /(user).`
- `app/(admin)/calendar`と`app/(user)/calendar`が同じ`/calendar`パスに解決されて衝突していた

#### 解決策

- 古い`app/(admin)`ディレクトリ内のファイルを削除
- `app/admin/calendar`に既に正しい実装が存在していたため、重複していた古いファイルを削除

#### 修正ファイル

- `app/(admin)/calendar/page.tsx`: 削除
- `app/(admin)/menus/page.tsx`: 削除
- `app/(admin)/prices/page.tsx`: 削除
- `app/(admin)/reports/page.tsx`: 削除
- `app/(admin)/vendors/page.tsx`: 削除

### システム設定画面の締切時刻形式エラーの修正

#### 問題

- システム設定画面でデフォルト締切時刻を変更して保存すると、400 エラーが発生
- エラーメッセージ: 「締切時刻の形式が正しくありません（HH:MM 形式で入力してください）」

#### 原因

- データベースから取得した`default_deadline_time`が`HH:MM:SS`形式（例：`10:00:00`）で返される
- API のバリデーションは`HH:MM`形式を期待していた

#### 解決策

- データ取得時と API レスポンス時に、`default_deadline_time`を`HH:MM`形式に変換する処理を追加
- `toString().slice(0, 5)`を使用して`HH:MM:SS`形式から`HH:MM`形式に変換

#### 修正ファイル

- `app/admin/settings/page.tsx`: データ取得時と API レスポンス時の時刻形式変換処理を追加

### レポート・CSV 出力画面の改善

#### システム設定の締日表示機能

- レポート・CSV 出力画面に、システム設定で設定されている締日を表示する機能を追加
- 「締日期間を選択」セクションの右側に「システム設定の締日: XX 日」または「システム設定の締日: 月末締め」と表示

#### システム設定の締日を基準にした締日期間の自動計算機能

- `closing_periods`テーブルからの取得をやめ、システム設定の締日を基準に締日期間を自動計算する機能を実装
- 過去 12 ヶ月分の締日期間を自動計算して表示
- 期間の計算ロジック:
  - **指定日締めの場合**: 開始日=前月の締日+1 日、終了日=当月の締日
  - **月末締めの場合**: 開始日=当月 1 日、終了日=当月の最終日
- 例：今日が 2026 年 1 月 1 日、システム設定の締日が 10 日の場合
  - 最新期間：2025 年 12 月 11 日 ～ 2026 年 1 月 10 日
  - その前：2025 年 11 月 11 日 ～ 2025 年 12 月 10 日

#### API の変更

- `summary`と`csv`の API を、`period_id`だけでなく`start_date`と`end_date`も受け取れるように変更
- 既存の`period_id`による取得も引き続きサポート（後方互換性を維持）

#### 修正ファイル

- `app/admin/reports/page.tsx`: システム設定の締日表示と期間自動計算機能を追加
- `app/api/admin/reports/summary/route.ts`: `start_date`と`end_date`パラメータのサポートを追加
- `app/api/admin/reports/csv/route.ts`: `start_date`と`end_date`パラメータのサポートを追加

### 価格管理機能の改善

#### 価格管理 API の Service Role Key 使用

#### 問題

- 価格管理画面で価格一覧が表示されない
- 価格を登録しようとすると 500 エラーが発生

#### 原因

- RLS ポリシーの影響で、管理者権限でも`menu_prices`テーブルへのアクセスが制限されていた

#### 解決策

- 価格管理 API（GET/POST/PUT/DELETE）で Service Role Key（`supabaseAdmin`）を使用するように変更
- RLS ポリシーをバイパスして、管理者権限で確実にデータにアクセス可能に

#### 修正ファイル

- `app/api/admin/prices/route.ts`: Service Role Key を使用するように変更、重複チェックロジックを改善
- `app/api/admin/prices/[id]/route.ts`: Service Role Key を使用するように変更、重複チェックロジックを改善

#### 未来の価格改定設定機能

#### 実装内容

- 新規価格登録時に、既存の有効な価格（`end_date`が NULL）がある場合、自動的に既存の価格の`end_date`を新しい価格の`start_date`の前日に設定する機能を追加
- これにより、未来の価格改定を事前に設定できるようになった

#### 動作仕様

1. 既存の有効な価格がある場合（`end_date`が NULL）
2. 新しい価格の`start_date`が未来の日付で、既存の価格の`start_date`より後の場合
3. 既存の価格の`end_date`を新しい価格の`start_date`の前日に自動設定
4. その後、新しい価格を登録

#### 例

- 現在有効な価格：`start_date: 2024-01-01`, `end_date: NULL`, `price: 600円`
- 新しい価格を登録：`start_date: 2026-04-01`, `end_date: NULL`, `price: 700円`
- 自動処理結果：
  - 既存の価格の`end_date`が`2026-03-31`に設定される
  - 新しい価格が`2026-04-01`から有効になる

#### 修正ファイル

- `app/api/admin/prices/route.ts`: 既存の有効な価格の`end_date`を自動設定する処理を追加

---

## 2025-01-XX（価格管理機能の改善と管理者による注文代理操作機能の追加）

### 価格管理機能の改善

#### 価格編集時の上書き許可

- **問題**: 価格を編集して登録すると、重複しているとエラーが出てしまう
- **解決策**: 編集時の重複チェックを削除し、上書きを許可するように変更
- **修正ファイル**: `app/api/admin/prices/[id]/route.ts`

#### 価格編集時の自動調整機能

- **実装内容**: 価格編集時に、新しい開始日と期間が重複する既存の価格（自分以外）の`end_date`を新しい開始日の前日に自動設定
- **動作**: 編集時に開始日を変更した場合、重複する既存価格の終了日が自動調整される
- **修正ファイル**: `app/api/admin/prices/[id]/route.ts`

#### 価格管理画面の表示改善

- **業者別グループ化**: 価格一覧を業者別にグループ化し、その中でメニュー別にグループ化して表示
- **業者名表示**: 業者コードではなく業者名のみを表示
- **メニュー選択ドロップダウン**: 業者コードではなく業者名を表示
- **修正ファイル**: `app/admin/prices/page.tsx`

### 管理者による注文代理操作機能の追加

#### 注文 API の管理者対応

- **注文作成 API** (`POST /api/orders`): 管理者が`user_id`パラメータを指定して、任意のユーザーの注文を作成可能に
- **注文更新 API** (`PUT /api/orders/[id]`): 管理者が任意のユーザーの注文を更新可能に
- **注文キャンセル API** (`PATCH /api/orders/[id]`): 管理者が任意のユーザーの注文をキャンセル可能に
- **監査ログ**: 管理者による操作であることを記録（`action`に`.admin`サフィックスを追加）
- **修正ファイル**:
  - `app/api/orders/route.ts`
  - `app/api/orders/[id]/route.ts`

#### カレンダー画面の管理者モード

- **URL パラメータ対応**: `/calendar?user_id=xxx`で対象ユーザーのカレンダーを表示
- **管理者権限チェック**: 管理者のみ他ユーザーのカレンダーを開ける
- **注文データの取得**: 指定されたユーザー ID で注文データを取得
- **管理者モード表示**: 代理操作中であることを表示
- **修正ファイル**: `app/(user)/calendar/page.tsx`

#### 注文作成・編集画面の管理者モード

- **注文作成画面**: `/orders/new?date=xxx&user_id=xxx`で管理者が指定ユーザーで注文を作成可能
- **注文編集画面**: `/orders/[id]/edit?user_id=xxx`で管理者が指定ユーザーの注文を編集可能
- **リダイレクト先の保持**: 操作後も管理者モードを維持（`user_id`パラメータを保持）
- **修正ファイル**:
  - `app/(user)/orders/new/page.tsx`
  - `components/order-form.tsx`
  - `app/(user)/orders/[id]/edit/page.tsx`
  - `components/order-edit-form.tsx`
  - `components/calendar-grid.tsx`

#### ユーザー管理画面の機能追加

- **カレンダーボタン**: ユーザー一覧の各行に「カレンダー」ボタンを追加し、クリックでそのユーザーのカレンダー画面を開く
- **注文ボタンの削除**: ユーザー管理画面の「注文」ボタンと注文作成モーダルを削除（カレンダー画面から操作する方式に統一）
- **修正ファイル**: `app/admin/users/page.tsx`

### 技術的な詳細

- **Service Role Key の使用**: 管理者権限チェックとデータ取得に Service Role Key（`supabaseAdmin`）を使用
- **RLS バイパス**: 管理者による他ユーザーのデータアクセスで RLS をバイパス
- **パラメータの保持**: 月ナビゲーションやリダイレクト時に`user_id`パラメータを保持

### 確認事項

- ✅ 価格編集時に上書きが可能
- ✅ 価格編集時に既存価格の終了日が自動調整される
- ✅ 価格管理画面が業者別にグループ化されて表示される
- ✅ 管理者が任意のユーザーの注文を作成・更新・キャンセルできる
- ✅ 管理者が任意のユーザーのカレンダー画面を開いて操作できる
- ✅ ユーザー管理画面からカレンダー画面へのアクセスが可能

---

## 2025-01-XX（パスワードリセット機能の修正と UI 改善）

### パスワードリセット機能の修正

#### 管理者画面からのパスワードリセット機能の削除

- **問題**: ログイン画面に「パスワードを忘れた方はこちら」メニューがあるため、管理者画面からのパスワードリセット機能は不要
- **解決策**: 管理者画面からのパスワードリセット機能を削除
- **削除ファイル**:
  - `app/api/admin/users/[id]/reset-password/route.ts`: 管理者用パスワードリセット API を削除
- **修正ファイル**:
  - `app/admin/users/page.tsx`: パスワードリセットボタンと`handleResetPassword`関数を削除
- **残存機能**: ログインページ（`app/(auth)/login/page.tsx`）のパスワードリセット機能はそのまま

### カレンダー画面の UI 改善

#### ヘッダーとタイトルの間の空間削減

- **問題**: 「お弁当注文」と「注文カレンダー」の間に空間があり、カレンダー全体を一画面で視認できない可能性がある
- **解決策**: レイアウトのパディングとスペーシングを調整
- **修正ファイル**:
  - `app/(user)/layout.tsx`: `main`タグの上部パディングを`pt-2`から`pt-0`に変更
  - `app/(user)/calendar/page.tsx`: 要素間のスペースを`space-y-2 sm:space-y-3`から`space-y-1 sm:space-y-2`に変更、ヘッダー部分に`pt-1`を追加

#### デスクトップ表示でのカレンダーセルサイズ調整

- **問題**: デスクトップ表示でカレンダーが画面に収まらず、スクロールが必要
- **解決策**: デスクトップ表示でカレンダーセルの横幅を 1.2 倍に調整し、セルの高さとパディングを縮小
- **修正ファイル**:
  - `app/globals.css`: デスクトップ表示で`grid-template-columns: repeat(7, minmax(0, 1.2fr))`を適用するカスタム CSS を追加
  - `components/calendar-grid.tsx`:
    - セルの高さを`md:min-h-[140px]`から`md:min-h-[90px]`に縮小
    - パディングを`md:p-4`から`md:p-2`に縮小
    - フォントサイズをデスクトップ表示で縮小
    - 要素間のスペースを縮小
  - `app/(user)/calendar/page.tsx`: 月ナビゲーションのパディングを`md:p-4`から`md:p-2`に縮小

### キャンセル済み注文の再注文機能の修正

#### 問題

- 注文をキャンセルした後、同じ日に再度注文しようとすると「この日付には既に注文があります」というエラーが発生

#### 原因

- UNIQUE 制約は`(user_id, menu_id, order_date, status)`のため、`status`が異なれば同じ日付でも複数のレコードが存在可能
- しかし、同じ`menu_id`でキャンセル済みの注文がある場合、同じ`menu_id`で新規注文を作成しようとすると UNIQUE 制約違反が発生する可能性がある

#### 解決策

- キャンセル済みの注文（同じ`menu_id`）を削除してから新規注文を作成する処理を追加
- 既存注文チェックで`status = 'ordered'`のみをチェックするように改善

#### 修正ファイル

- `app/api/orders/route.ts`:
  - キャンセル済み注文の削除処理を追加（207-220 行目）
  - UNIQUE 制約違反のエラーハンドリングを改善（308-330 行目）

### 注文履歴画面でのキャンセルボタン表示制御

#### 問題

- 締切時間を過ぎた注文にキャンセルボタンが表示されており、押すとエラーが発生するが、ブラウザの画面上では何も表示されず、何が起きたかわかりづらい

#### 解決策

1. **締切時間を過ぎた注文はキャンセルボタンを非表示にする**

   - 注文履歴画面でカレンダー情報を取得して締切時間をチェック
   - `isAfterDeadline`関数を追加して締切時間を過ぎたかどうかを判定
   - 締切時間を過ぎた注文のキャンセルボタンを非表示

2. **キャンセル処理中に締切時間を過ぎた場合のエラーメッセージ表示**
   - エラーメッセージを「最終の確定処理で時間を過ぎているためキャンセルできません」に変更
   - エラーメッセージの表示を改善（背景色とボーダーを追加して目立つように）

#### 修正ファイル

- `app/(user)/orders/page.tsx`:
  - カレンダー情報を取得して締切時間をチェック（17-50 行目）
  - `isAfterDeadline`関数を追加（52-75 行目）
  - 締切時間を過ぎた注文のキャンセルボタンを非表示（109-118 行目）
- `components/cancel-order-button.tsx`:
  - エラーメッセージの表示を改善（背景色とボーダーを追加）（59-61 行目）
- `app/api/orders/[id]/route.ts`:
  - エラーメッセージを「最終の確定処理で時間を過ぎているためキャンセルできません」に変更（377-397 行目）
  - 過去の日付の注文もキャンセル不可にする処理を追加

---

## 2025-01-XX（管理者による他ユーザーカレンダー表示機能の修正と注文一覧機能の実装）

### 管理者による他ユーザーカレンダー表示機能の修正

#### 問題

- 管理者がユーザー管理から他のユーザーのカレンダーをクリックしても、管理者本人のカレンダーが表示されてしまう

#### 解決策

1. **Service Role Key の使用**

   - 管理者が他のユーザーの注文を取得する際、Service Role Key を使用して RLS をバイパス
   - `app/(user)/calendar/page.tsx` で注文データ取得時に Service Role Key を使用

2. **対象ユーザー情報の表示修正**
   - 管理者モード表示で対象ユーザーの名前を正しく表示するように修正
   - `targetProfile` を変数に保持し、表示に使用

#### 修正ファイル

- `app/(user)/calendar/page.tsx`: Service Role Key の使用、対象ユーザー情報の表示修正、デバッグログの追加

### 注文一覧機能の実装

#### 実装内容

1. **本日の注文一覧ページの作成**

   - `app/admin/orders/today/page.tsx` を作成
   - 本日のすべての注文を業者別・メニュー別にグループ化して表示
   - 注文時刻順（新しい順）で表示
   - 各業者・メニューの小計と全体の合計金額を表示

2. **日付選択機能の実装**

   - カレンダー表示から日付を選択可能に
   - 注文がある日のみ選択可能（注文がない日はグレーアウト表示）
   - 月ナビゲーション機能（前月・次月に注文がある場合のみ移動可能）
   - 選択中の日付をハイライト表示
   - 今日の日付を特別表示

3. **ダッシュボードとの連携**

   - ダッシュボードの「本日の注文」カードをクリック可能に
   - クリックで注文一覧ページに遷移

4. **管理画面メニューの変更**

   - 「自動注文実行」メニューを削除
   - 「注文一覧」メニューを追加（ダッシュボードとユーザー管理の間）

5. **ダッシュボードのカードをクリック可能に**

   - アクティブユーザー → ユーザー管理画面
   - アクティブ業者 → 業者管理画面
   - アクティブメニュー → メニュー管理画面

6. **各管理画面に「ダッシュボードに戻る」ボタンを追加**
   - ユーザー管理画面、業者管理画面、メニュー管理画面に追加

#### 実装詳細

1. **注文一覧ページの表示形式**

   - 業者ごとにグループ化
   - 各業者内でメニュー別にグループ化
   - 各メニュー内で注文時刻順（新しい順）に表示
   - 各メニューの数量と小計を表示
   - 各業者の小計を表示
   - 全体の合計金額を表示

2. **日付選択カレンダー**

   - 注文がある日付のみ選択可能
   - 注文がない日付はグレーアウト表示で選択不可
   - 選択中の日付はオレンジ背景で強調表示
   - 今日の日付はオレンジの薄い背景で「今日」ラベルを表示
   - 月ナビゲーションで前月・次月に移動（注文がある月のみ有効）

3. **データ取得**
   - Service Role Key を使用して RLS をバイパス
   - 注文データ、ユーザー情報、メニュー情報、業者情報を結合

#### 実装ファイル

- `app/admin/orders/today/page.tsx`: 注文一覧ページ（新規作成）
- `app/admin/orders/today/date-calendar.tsx`: 日付選択カレンダーコンポーネント（新規作成）
- `app/admin/orders/today/date-selector.tsx`: 日付選択セレクトボックスコンポーネント（新規作成、後にカレンダーに置き換え）
- `app/admin/page.tsx`: ダッシュボードのカードをクリック可能に
- `components/admin-nav.tsx`: メニューの変更（自動注文実行を削除、注文一覧を追加）
- `app/admin/users/page.tsx`: 「ダッシュボードに戻る」ボタンを追加
- `app/admin/vendors/page.tsx`: 「ダッシュボードに戻る」ボタンを追加
- `app/admin/menus/page.tsx`: 「ダッシュボードに戻る」ボタンを追加

#### 確認事項

- ✅ 管理者が他のユーザーのカレンダーを正しく表示できる
- ✅ 本日の注文一覧が業者別・メニュー別にグループ化されて表示される
- ✅ カレンダーから日付を選択して注文一覧を確認できる
- ✅ 注文がある日のみ選択可能
- ✅ ダッシュボードから各管理画面に直接アクセスできる
- ✅ 各管理画面からダッシュボードに戻れる

---

## 2025-01-XX（操作ログ機能の実装と CSV 出力の改善）

### 操作ログ機能の実装

#### 実装内容

- **操作ログ閲覧画面** (`app/admin/logs/page.tsx`)

  - 管理者がシステム内のすべての操作ログを閲覧できる画面を実装
  - フィルタ機能：アクション種別、対象テーブル、開始日、終了日でフィルタリング
  - ページネーション機能：50 件ずつ表示（ページサイズは変更可能）
  - ログ詳細の表示：アクション、実行ユーザー、対象テーブル、対象 ID、詳細情報（JSON）、IP アドレス、実行日時を表示

- **操作ログ取得 API** (`app/api/admin/logs/route.ts`)

  - GET `/api/admin/logs` エンドポイントを実装
  - 管理者権限チェックを実装
  - フィルタリング機能（`action`, `target_table`, `start_date`, `end_date`）
  - ページネーション機能（`page`, `limit`）
  - `supabaseAdmin`を使用して RLS をバイパスし、すべてのログを取得
  - 実行ユーザー（actor）のプロフィール情報（社員コード、氏名）を取得して返却

- **データベース型定義の更新** (`lib/database.types.ts`)
  - `audit_logs`テーブルの型定義を実際の DB 構造に合わせて更新
  - `actor_id`, `target_table`, `target_id`, `details`, `ip_address`カラムの定義を追加

#### UI 改善

- ログ詳細表示の「詳細を表示する」テキストを「詳細」に変更

#### 実装ファイル

- `app/admin/logs/page.tsx`: 操作ログ閲覧画面（新規作成）
- `app/api/admin/logs/route.ts`: 操作ログ取得 API（新規作成）
- `lib/database.types.ts`: `audit_logs`テーブルの型定義を更新

---

### CSV 出力の文字化け問題の修正

#### 問題

- CSV 出力したファイルを Excel で開くと文字化けが発生する

#### 原因

- Excel が UTF-8 エンコーディングを自動認識しないため、BOM（Byte Order Mark）が必要

#### 解決策

- CSV 出力時に UTF-8 BOM（`\uFEFF`）をファイルの先頭に追加
- これにより、Excel が UTF-8 エンコーディングを正しく認識し、文字化けが解消される

#### 修正ファイル

- `app/api/admin/reports/csv/route.ts`: UTF-8 BOM を追加

---

### CSV 出力で管理者が代理注文した場合の社員コード・氏名が欠落する問題の修正

#### 問題

- 管理者がユーザーの代わりに注文を作成した場合、CSV 出力でその注文の社員コードと氏名が空欄になる

#### 原因

- `supabase`クライアントを使用して注文データを取得していたため、RLS ポリシーの影響で、管理者が代理で作成した注文の対象ユーザーのプロフィール情報にアクセスできない可能性があった

#### 解決策

- CSV 出力 API で`supabaseAdmin`（Service Role Key）を使用して注文データを取得
- RLS をバイパスすることで、すべてのユーザーのプロフィール情報を確実に取得できるようにした

#### 修正ファイル

- `app/api/admin/reports/csv/route.ts`: `supabase`を`supabaseAdmin`に変更

#### 確認事項

- ✅ 管理者が代理で作成した注文の CSV 出力に、正しく社員コードと氏名が含まれる
- ✅ 通常のユーザーが作成した注文の CSV 出力も、引き続き正しく社員コードと氏名が含まれる

---

## 2025-01-XX（レポート機能の改善と PDF 出力機能の実装）

### レポート・CSV 出力画面の改善

#### 業者とユーザーの絞り込み機能の実装

- **問題**: 業者とユーザーで絞り込めるようになっているが、どちらも「すべて」しか選択できない
- **解決策**:
  - レポート画面で業者とユーザーのリストを取得する処理を追加
  - ドロップダウンで選択可能に（「すべて」も選択可能）
  - フィルタ変更時に集計結果を自動再取得

#### 代理注文の視覚表示改善

- **問題**: 管理者が代理で注文した注文明細で、社員コードと氏名が表示されていない。誰の注文かわからない
- **解決策**:
  - `summary` API で`supabaseAdmin`を使用して RLS をバイパスし、代理注文のプロフィール情報を取得
  - 監査ログから代理注文を識別（`action`に`.admin`が含まれる場合）
  - 代理注文の視覚表示：
    - 背景色を薄いオレンジ（`bg-amber-50`）に変更
    - 左側にオレンジのボーダー（`border-l-4 border-amber-500`）を追加
    - 注文日の横に「代理」バッジを表示

#### 修正ファイル

- `app/api/admin/reports/summary/route.ts`: Service Role Key 使用、代理注文識別、フィルタ機能追加
- `app/admin/reports/page.tsx`: 業者・ユーザーリスト取得、フィルタ UI、代理注文の視覚表示

### レポート画面の締日期間選択のコンパクト化

#### 実装内容

- **問題**: 締日期間を選択のリストが大きく画面を占有している
- **解決策**:
  - ラジオボタンリスト → セレクトボックスに変更
  - パディング削減（`p-6` → `p-4`、`mb-4` → `mb-3`）
  - フォントサイズ調整（タイトルを`text-lg` → `text-base`、システム設定の締日表示を`text-sm` → `text-xs`）
  - 読み込み中の表示をコンパクト化（`py-4` → `py-2`、`text-sm`を追加）

#### 修正ファイル

- `app/admin/reports/page.tsx`: 締日期間選択をセレクトボックスに変更

### PDF 出力機能の実装

#### 実装内容

- **要件**: 今日の注文を業者にメールや FAX できるように、PDF ファイルで注文書を作成
- **仕様**:
  - A4 サイズの PDF
  - 何を何食、という明細を表示
  - 業者ごとの注文書のみ（全業者の PDF は不要）

#### 実装詳細

1. **PDF 生成ライブラリの選定**

   - 最初は`@react-pdf/renderer`を使用したが、Next.js の API Route で JSX 構文の問題が発生
   - `pdfkit`に切り替えて実装（Node.js 環境で動作し、Next.js の API Route で使用しやすい）

2. **PDF 生成 API の実装**

   - `app/api/admin/orders/today/pdf/route.ts`を作成
   - `vendor_id`パラメータを必須に（業者ごとの PDF のみ）
   - A4 サイズで PDF を生成
   - 注文書のヘッダー、業者情報、メニューごとの注文明細、合計金額を表示
   - テーブル形式で注文明細を表示（注文時刻、社員コード、氏名、数量、単価、小計）

3. **UI の追加**
   - 注文一覧画面の各業者セクションに「PDF 出力」ボタンを追加
   - 全業者 PDF 出力ボタンは削除（業者ごとの PDF のみ）

#### 技術的な詳細

- **PDF 生成**: `pdfkit`を使用
- **ファイル拡張子**: `route.ts`（JSX が不要なため）
- **エラーハンドリング**: 詳細なエラーログとエラーメッセージを追加

#### 実装ファイル

- `app/api/admin/orders/today/pdf/route.ts`: PDF 生成 API（新規作成）
- `app/admin/orders/today/page.tsx`: PDF 出力ボタンの追加

#### 確認事項

- ✅ 業者ごとの PDF 出力が正常に動作する
- ✅ A4 サイズで PDF が生成される
- ✅ 注文明細が正しく表示される
- ✅ 業者ごとの合計金額が表示される

#### 注意事項

- `pdfkit`は日本語フォントのサポートが限定的です。日本語が正しく表示されない場合は、日本語フォントを埋め込む必要があります

---

## 2025-01-02（PDF 出力機能のフォント問題解決と日本語対応）

### PDF 生成時のフォントファイル問題の解決

#### 問題

- PDF 生成時に`ENOENT: no such file or directory, open 'C:\\Users\\kazu\\my-app\\.next\\dev\\server\\vendor-chunks\\data\\Helvetica.afm'`エラーが発生
- pdfkit がデフォルトフォント（Helvetica）のファイルを見つけられない
- Next.js 16 で Turbopack がデフォルトになり、webpack 設定との競合が発生

#### 解決策

1. **フォントファイルの自動コピースクリプトの作成**

   - `scripts/copy-fonts.js`: Node.js 用のフォントファイルコピースクリプト
   - `scripts/copy-fonts.ps1`: PowerShell 用のフォントファイルコピースクリプト
   - pdfkit のフォントファイル（.afm）を`.next/dev/server/vendor-chunks/data/`にコピー

2. **package.json の修正**

   - `predev`スクリプトを追加し、開発サーバー起動前に自動的にフォントファイルをコピー
   - `dev`スクリプトに`--webpack`フラグを追加（Next.js 16 で Turbopack がデフォルトのため）

3. **next.config.ts の修正**

   - webpack 設定を削除（Next.js 16 で Turbopack がデフォルトのため）

4. **PDF 生成 API の改善**
   - PDF 生成時にフォントファイルを動的にコピーする処理を追加
   - フォントファイルが見つからない場合のエラーハンドリングを改善

### PDF 生成時の日本語文字化け問題の解決

#### 問題

- PDF 生成時に日本語が文字化けする
- pdfkit のデフォルトフォント（Helvetica）は日本語をサポートしていない

#### 解決策

1. **日本語フォントの埋め込み機能を実装**

   - IPAex フォント（`ipaexg.ttf`）のサポート
   - IPA フォント（`ipag.ttf`）のサポート
   - Noto Sans JP のサポート
   - 複数のフォントパスを試して、最初に見つかったフォントを使用

2. **フォント設定手順ドキュメントの作成**

   - `docs/PDFフォント設定手順.md`: 日本語フォントのダウンロードと配置手順を記載

3. **デバッグログの追加**
   - フォントファイルの存在確認と登録状況をログ出力
   - フォント登録に失敗した場合のエラーメッセージを改善

#### 修正ファイル

- `app/api/admin/orders/today/pdf/route.ts`: 日本語フォントの埋め込み機能、フォントファイルの動的コピー処理
- `next.config.ts`: webpack 設定の削除
- `package.json`: `predev`スクリプトの追加、`--webpack`フラグの追加
- `scripts/copy-fonts.js`: フォントファイルコピースクリプト（新規作成）
- `scripts/copy-fonts.ps1`: PowerShell 用フォントファイルコピースクリプト（新規作成）
- `docs/PDFフォント設定手順.md`: フォント設定手順ドキュメント（新規作成）

#### 確認事項

- ✅ PDF 生成時に Helvetica.afm エラーが解消される
- ✅ 日本語フォントが正しく読み込まれる
- ✅ PDF で日本語が正しく表示される
- ✅ 開発サーバー起動前に自動的にフォントファイルがコピーされる

#### 注意事項

- 日本語フォント（IPAex フォントまたは IPA フォント）を`public/fonts/`フォルダに配置する必要があります
- フォントファイルのダウンロード手順は`docs/PDFフォント設定手順.md`を参照してください
- 開発サーバーを再起動するたびに、`predev`スクリプトでフォントファイルが自動的にコピーされます

---

## 2025-01-02（PDF 生成機能の改善と発注書形式への変更）

### PDF 生成エラーの修正

#### 問題

- PDF 生成時に`ENOENT: no such file or directory, open 'C:\\Users\\kazu\\my-app\\.next\\dev\\server\\vendor-chunks\\data\\Helvetica.afm'`エラーが発生
- `predev`スクリプトでフォントファイルはコピーされているが、実行時に pdfkit がフォントファイルを見つけられない
- Next.js の開発環境でパスが動的に変わる可能性がある

#### 解決策

1. **実行時に確実にフォントファイルをコピー**

   - 複数の候補ディレクトリ（`.next/dev/server/vendor-chunks/data`、`.next/server/vendor-chunks/data`、`.next/static/chunks/data`）にフォントファイルをコピー
   - フォントファイルが見つからない場合のエラーハンドリングを強化

2. **フォントパスの検出と設定**
   - 最初に見つかったターゲットディレクトリを使用
   - フォントパスが見つからない場合は、`node_modules/pdfkit/js/data`を使用
   - フォントパスが設定されていない場合は明確なエラーメッセージを表示

#### 修正ファイル

- `app/api/admin/orders/today/pdf/route.ts`: フォントファイルのコピー処理とフォントパス設定を改善

### Next.js ロックエラーの解決スクリプト

#### 問題

- 別の Next.js プロセスが実行中で、ロックファイル（`.next/dev/lock`）が残っている
- 新しいインスタンスを起動できない

#### 解決策

1. **プロセス終了スクリプトの作成**

   - `scripts/kill-nextjs.js`: Node.js 版
   - `scripts/kill-nextjs.ps1`: PowerShell 版（日本語対応）
   - `scripts/kill-nextjs-safe.ps1`: PowerShell 版（英語のみ、エンコーディング問題を回避）

2. **PowerShell 変数の問題修正**
   - `$pid`は PowerShell の自動変数（読み取り専用）のため、`$processId`に変更

#### 修正ファイル

- `scripts/kill-nextjs.js`: Node.js 版プロセス終了スクリプト
- `scripts/kill-nextjs.ps1`: PowerShell 版プロセス終了スクリプト（日本語対応）
- `scripts/kill-nextjs-safe.ps1`: PowerShell 版プロセス終了スクリプト（英語のみ）
- `package.json`: スクリプトコマンドを追加

### PDF デザインの発注書形式への変更

#### 変更内容

1. **ヘッダー部分**

   - 青いバナー（`#2563eb`）で「発注書」を中央に白文字で表示
   - 右上に「発注日 YYYY/M/D」を白文字で表示

2. **左上：業者名**

   - 業者名「○○○○ 御中」を表示

3. **右上：送信者情報**

   - 会社名、郵便番号、住所、電話番号を表示
   - 会社マスター（`system_settings`テーブル）から取得

4. **本文**

   - 「下記の通り、発注いたします。」を追加

5. **合計食数表示**

   - 青いボックスで「合計食数」を表示
   - 大きなフォントで食数を表示（例: `31食`）

6. **明細テーブル**

   - 列構成: 「内容」「数量」のみ
   - メニューごとに集計して表示（個別注文ではなく、メニューごとの合計）
   - フォントサイズ: 14pt（以前は 10pt）
   - 数量の配置: 中央寄せ（以前は右寄せ）

7. **小計・消費税・合計の削除**
   - 小計、消費税、合計の金額表示を削除

#### 修正ファイル

- `app/api/admin/orders/today/pdf/route.ts`: PDF 生成ロジックを発注書形式に変更

### 会社マスター機能の実装

#### 実装内容

1. **データベースマイグレーション**

   - `supabase/migrations/057_add_company_info_to_system_settings.sql`を作成
   - `system_settings`テーブルに以下のカラムを追加:
     - `company_name`: 会社名
     - `company_postal_code`: 郵便番号
     - `company_address`: 住所
     - `company_phone`: 電話番号
     - `company_fax`: FAX 番号
     - `company_email`: メールアドレス

2. **システム設定画面の更新**

   - 会社情報セクションを追加
   - 以下の入力欄を追加:
     - 会社名
     - 郵便番号
     - 住所
     - 電話番号
     - FAX 番号
     - メールアドレス

3. **システム設定 API の更新**

   - 会社情報の保存・取得に対応
   - PUT リクエストで会社情報を更新可能

4. **PDF 生成 API の更新**
   - 会社マスター（`system_settings`テーブル）から会社情報を取得
   - 取得優先順位:
     1. 会社マスター（`system_settings`テーブル）
     2. 環境変数（`PDF_SENDER_*`）
     3. 固定値（フォールバック）

#### 修正ファイル

- `supabase/migrations/057_add_company_info_to_system_settings.sql`: 会社情報カラムを追加
- `app/admin/settings/page.tsx`: 会社情報セクションを追加
- `app/api/admin/settings/route.ts`: 会社情報の保存・取得に対応
- `app/api/admin/orders/today/pdf/route.ts`: 会社マスターから情報を取得

#### 確認事項

- ✅ PDF 生成時に Helvetica.afm エラーが解消される
- ✅ 実行時に確実にフォントファイルがコピーされる
- ✅ Next.js ロックエラーを解決するスクリプトが作成される
- ✅ PDF デザインが発注書形式に変更される
- ✅ 明細のフォントサイズが拡大され、数量が中央寄せになる
- ✅ 会社マスター機能が実装され、PDF 生成時に自動的に使用される

#### 本番環境での注意事項

- **フォントファイルの確認**: `node_modules/pdfkit/js/data/`にフォントファイル（`.afm`）が存在することを確認
- **ビルド時の確認**: 本番環境でビルドする際、フォントファイルが正しく配置されることを確認
- **エラーハンドリング**: フォントファイルが見つからない場合、明確なエラーメッセージが表示される
- **日本語フォントの設定**: 日本語フォント（IPAex フォントまたは IPA フォント）を`public/fonts/`フォルダに配置
- **会社情報の設定**: 本番環境で会社情報を設定することを推奨

---

## 2025-01-XX（住所 2 行分割と PDF 改善、監査ログ完全実装）

### 住所を 2 行に分割する機能の実装

#### 実装内容

- **データベースマイグレーション**: `company_address`を`company_address1`と`company_address2`に分割
- **システム設定画面**: 住所入力欄を「住所（1 行目）」と「住所（2 行目）」の 2 つに分割
- **システム設定 API**: 住所 1 と住所 2 の保存・取得に対応
- **PDF 生成 API**: 住所を 2 行で表示、長文対応（企業名、業者名、住所の幅を拡大）

#### 実装詳細

1. **データベースマイグレーション** (`supabase/migrations/058_split_company_address_to_two_columns.sql`)

   - `company_address1`カラムを追加（既存データを移行）
   - `company_address2`カラムを追加
   - 既存の`company_address`データを`company_address1`に自動移行

2. **システム設定画面の更新** (`app/admin/settings/page.tsx`)

   - 住所入力欄を 2 つに分割
   - 型定義を更新（`company_address` → `company_address1`, `company_address2`）

3. **PDF 生成 API の改善** (`app/api/admin/orders/today/pdf/route.ts`)
   - 住所を 2 行で表示（`company_address1`と`company_address2`）
   - 長文対応:
     - 企業名: 幅を 200px に拡大、`ellipsis: false`で切らない
     - 住所: 2 行対応、幅を 200px に拡大
     - 業者名: 幅を 300px に拡大

#### 修正ファイル

- `supabase/migrations/058_split_company_address_to_two_columns.sql`: マイグレーションファイル（新規作成）
- `app/admin/settings/page.tsx`: 住所入力欄を 2 つに分割
- `app/api/admin/settings/route.ts`: 住所 1 と住所 2 の保存・取得に対応
- `app/api/admin/orders/today/pdf/route.ts`: 住所を 2 行で表示、長文対応

### PDF に FAX 番号を追加

#### 実装内容

- PDF 生成 API に FAX 番号の表示機能を追加
- システム設定から`company_fax`を取得して PDF に表示
- 電話番号の下に FAX 番号を表示

#### 修正ファイル

- `app/api/admin/orders/today/pdf/route.ts`: FAX 番号の表示を追加

### 監査ログの完全実装

#### 実装内容

すべての管理者操作を監査ログに記録するように実装しました。

1. **価格管理 API**

   - `POST /api/admin/prices` - 価格作成時（`price.create`）
   - `PUT /api/admin/prices/[id]` - 価格更新時（`price.update`）
   - `DELETE /api/admin/prices/[id]` - 価格削除時（`price.delete`）

2. **業者管理 API**

   - `POST /api/admin/vendors` - 業者作成時（`vendor.create`）
   - `PUT /api/admin/vendors/[id]` - 業者更新時（`vendor.update`）
   - `DELETE /api/admin/vendors/[id]` - 業者削除時（`vendor.delete`）

3. **メニュー管理 API**

   - `POST /api/admin/menus` - メニュー作成時（`menu.create`）
   - `PUT /api/admin/menus/[id]` - メニュー更新時（`menu.update`）
   - `DELETE /api/admin/menus/[id]` - メニュー削除時（`menu.delete`）

4. **カレンダー管理 API**

   - `PUT /api/admin/calendar` - カレンダー設定更新時（`calendar.update`）

5. **ユーザー管理 API**

   - `PUT /api/admin/users/[id]` - ユーザー更新時（`user.update`）
   - `DELETE /api/admin/users/[id]` - ユーザー削除時（`user.delete`）

6. **システム設定 API**
   - `PUT /api/admin/settings` - システム設定更新時（`settings.update`）

#### ログ記録の内容

各ログには以下を含みます：

- `actor_id`: 実行ユーザー ID
- `action`: アクション種別（例: `price.create`, `vendor.update`）
- `target_table`: 対象テーブル名
- `target_id`: 対象レコード ID
- `details`: 操作の詳細情報（JSONB 形式）
- `ip_address`: 実行元 IP アドレス

#### 修正ファイル

- `app/api/admin/prices/route.ts`: 価格作成時のログ記録を追加
- `app/api/admin/prices/[id]/route.ts`: 価格更新・削除時のログ記録を追加
- `app/api/admin/vendors/route.ts`: 業者作成時のログ記録を追加
- `app/api/admin/vendors/[id]/route.ts`: 業者更新・削除時のログ記録を追加
- `app/api/admin/menus/route.ts`: メニュー作成時のログ記録を追加
- `app/api/admin/menus/[id]/route.ts`: メニュー更新・削除時のログ記録を追加
- `app/api/admin/calendar/route.ts`: カレンダー設定更新時のログ記録を追加
- `app/api/admin/users/[id]/route.ts`: ユーザー更新・削除時のログ記録を追加
- `app/api/admin/settings/route.ts`: システム設定更新時のログ記録を追加

#### 確認事項

- ✅ すべての管理者操作が監査ログに記録される
- ✅ 操作ログ閲覧画面（`/admin/logs`）で確認可能
- ✅ 既存のログ記録（注文作成・更新・キャンセル、自動注文）も引き続き動作

---

## 2025-01-XX（レポート機能の拡張と監査ログの完全実装）

### ユーザー別合計金額CSV出力機能の追加

#### 実装内容

- レポート・CSV出力画面から、締日期間中のユーザーごとの合計金額のCSVをダウンロードできる機能を追加
- 「ユーザー別合計CSV」ダウンロードボタンを追加（「明細CSV」ボタンと並べて表示）
- ユーザーごとに集計した合計金額をCSV形式で出力
- 社員コード順にソートして表示
- 合計行は含めない（ユーザーごとの合計のみ）

#### 実装詳細

1. **新しいAPIエンドポイントの作成**
   - `app/api/admin/reports/csv-by-user/route.ts` を作成
   - ユーザーごとに集計した合計金額をCSV形式で出力
   - 既存のCSV APIと同様に、フィルタ（業者・ユーザー）に対応

2. **レポート画面の更新**
   - 「ユーザー別合計CSV」ダウンロードボタンを追加
   - 既存の「明細CSV」ボタンと並べて表示（青色で区別）

#### CSV出力形式

```
社員コード,氏名,合計金額
0001,"山田 太郎",15000
0002,"佐藤 花子",12000
```

- 社員コード順にソート
- 合計行は含めない
- UTF-8 BOM付き（Excelで正しく開ける）
- フィルタ（業者・ユーザー）に対応

#### 修正ファイル

- `app/api/admin/reports/csv-by-user/route.ts`: ユーザー別合計金額CSV出力API（新規作成）
- `app/admin/reports/page.tsx`: 「ユーザー別合計CSV」ダウンロードボタンの追加

### PDF生成・CSV出力時の監査ログ記録機能の追加

#### 実装内容

- PDF生成時に監査ログを記録する機能を追加
- CSV出力（明細・ユーザー別合計）時に監査ログを記録する機能を追加
- すべての出力操作を監査ログに記録することで、操作履歴を追跡可能に

#### 実装詳細

1. **PDF生成APIの監査ログ記録**
   - `app/api/admin/orders/today/pdf/route.ts` に監査ログ記録を追加
   - アクション: `pdf.generate`
   - 記録内容:
     - 日付
     - 業者ID・業者名
     - 合計食数
     - 注文件数

2. **CSV出力API（明細）の監査ログ記録**
   - `app/api/admin/reports/csv/route.ts` に監査ログ記録を追加
   - アクション: `csv.download`
   - 記録内容:
     - 開始日・終了日
     - 業者ID（フィルタ適用時）
     - ユーザーID（フィルタ適用時）
     - 注文件数

3. **CSV出力API（ユーザー別合計）の監査ログ記録**
   - `app/api/admin/reports/csv-by-user/route.ts` に監査ログ記録を追加
   - アクション: `csv.download.by_user`
   - 記録内容:
     - 開始日・終了日
     - 業者ID（フィルタ適用時）
     - ユーザーID（フィルタ適用時）
     - ユーザー数

#### 監査ログの記録項目

- `actor_id`: 実行ユーザーID
- `action`: アクション種別（`pdf.generate`, `csv.download`, `csv.download.by_user`）
- `target_table`: `orders`
- `target_id`: `null`（集計操作のため）
- `details`: 詳細情報（JSONB形式）
- `ip_address`: 実行元IPアドレス

#### 修正ファイル

- `app/api/admin/orders/today/pdf/route.ts`: 監査ログ記録を追加
- `app/api/admin/reports/csv/route.ts`: 監査ログ記録を追加
- `app/api/admin/reports/csv-by-user/route.ts`: 監査ログ記録を追加

#### 確認事項

- ✅ PDF生成時に監査ログが記録される
- ✅ CSV出力（明細）時に監査ログが記録される
- ✅ CSV出力（ユーザー別合計）時に監査ログが記録される
- ✅ 操作ログ閲覧画面（`/admin/logs`）で確認可能

---

## 2025-01-XX（PDF生成時の監査ログ記録機能の修正）

### 問題

- PDF生成時に監査ログが記録されない
- エラー: `TypeError: headers is not a function`

### 原因

- `headers()`関数の呼び出し方法が誤っていた
- Next.js 16では`request.headers`から直接取得する必要がある

### 解決策

- `request.headers`から直接IPアドレスを取得する方法に変更
- `doc.on('end')`の重複を削除

### 修正ファイル

- `app/api/admin/orders/today/pdf/route.ts`: `headers()`関数の呼び出しを削除し、`request.headers`から直接取得

### 確認事項

- ✅ PDF生成時に監査ログが正しく記録される
- ✅ 操作ログ閲覧画面（`/admin/logs`）で確認可能

---

## 2025-01-XX（新規登録制限機能の実装）

### 実装内容

社員のみが新規登録できるようにする制限機能を実装しました。

1. **招待コード方式**
   - 4桁の数字の招待コードを必須にする
   - 使用回数制限機能（1〜9999回、または無制限）
   - 招待コード変更時に使用回数を自動リセット

2. **社員コードマスター方式**
   - 事前に登録された社員コードのみ新規登録可能
   - 登録済みフラグで二重登録を防止
   - 管理者画面で社員コードマスターを管理可能

3. **招待コード管理専用ページ**
   - システム設定画面から分離して専用ページを作成
   - 招待コードの発行・管理を一元化

### データベースマイグレーション

- `supabase/migrations/059_add_employee_codes_and_invitation_code.sql`: 社員コードマスターテーブルの作成、招待コードカラムの追加
- `supabase/migrations/060_add_invitation_code_usage_limit.sql`: 使用回数制限機能の追加

### 実装ファイル

- `app/(auth)/login/page.tsx`: 招待コード入力欄を追加
- `app/admin/invitation-code/page.tsx`: 招待コード管理専用ページ（新規作成）
- `app/admin/employee-codes/page.tsx`: 社員コードマスター管理画面（新規作成）
- `app/api/auth/signup/route.ts`: 招待コードと社員コードマスターのチェックを実装
- `app/api/admin/invitation-code/route.ts`: 招待コード管理API（新規作成）
- `app/api/admin/employee-codes/route.ts`: 社員コードマスター管理API（新規作成）
- `app/api/admin/employee-codes/[id]/route.ts`: 社員コードマスター管理API（個別）（新規作成）
- `app/admin/settings/page.tsx`: 招待コード設定を削除
- `app/api/admin/settings/route.ts`: 招待コード関連の処理を削除
- `components/admin-nav.tsx`: 「招待コード管理」「社員コードマスター」メニューを追加

### 機能詳細

1. **招待コードのチェック**
   - システム設定で設定した招待コードと一致する場合のみ登録可能
   - 使用回数が上限に達している場合は登録不可

2. **社員コードマスターのチェック**
   - マスターテーブルに存在し、未登録の社員コードのみ登録可能
   - 既に登録済みの社員コードは登録不可

3. **登録成功時の処理**
   - 社員コードマスターの`is_registered`フラグを`true`に更新
   - 招待コードの使用回数をカウントアップ

### 確認事項

- ✅ 招待コードが4桁の数字で生成される
- ✅ 使用回数制限が正しく機能する
- ✅ 社員コードマスターのチェックが正しく機能する
- ✅ 登録済みの社員コードは編集・削除不可
- ✅ 招待コード変更時に使用回数が自動リセットされる

### ドキュメントの追加

- `docs/新規登録制限機能の実装.md`: 実装内容の詳細を記録

---

## 2025-01-02（社員コード変更機能と新規登録方式の変更）

### 社員コード変更機能の実装

#### 実装内容

- 管理者がユーザーの社員コードを変更可能にする機能を実装
- 変更時に古い社員コードを`employee_codes`テーブルで解放（`is_registered = false`、`registered_user_id = NULL`）
- 新しい社員コードを`employee_codes`テーブルでチェック（未登録のみ許可）
- 監査ログに変更前後の社員コードを記録（`old_employee_code`、`new_employee_code`、`employee_code_changed`）

#### 技術的な詳細

- `app/api/admin/users/[id]/route.ts`のPUTメソッドを修正
- 社員コード変更時に`employee_codes`テーブルを更新
- 変更前の社員コードを取得して、変更時に解放処理を実行
- 新しい社員コードが`employee_codes`テーブルに存在する場合、未登録のみ許可

#### 注意事項

- 社員コード変更時、過去の注文データは`user_id`で参照しているため整合性は保たれる
- CSV/PDF出力では、その時点の`profiles`テーブルの社員コードが表示される（過去の注文でも現在の社員コードが表示される）
- 監査ログには変更前後の社員コードが記録される

### 新規登録方式の変更

#### 実装内容

- **社員コードマスター方式の廃止**: 事前に社員コードマスターに登録する方式を廃止
- **承認方式への変更**: 新規登録時は`is_active = false`（承認待ち）に設定し、管理者が承認すると`is_active = true`にする
- **新規登録時の通知**: 新規登録時に監査ログに記録（`user.signup.pending`アクション）
- **ログイン時の承認待ちチェック**: ログイン時に承認待ちユーザーを検出し、適切なメッセージを表示

#### 変更内容

- `app/api/auth/signup/route.ts`: 社員コードマスター方式のチェックを削除、新規登録時は`is_active = false`に設定
- `app/(auth)/login/page.tsx`: ログイン時の承認待ちチェックを追加
- 新規登録時のメッセージを「管理者の承認をお待ちください」に変更

### 承認待ちユーザー管理機能の実装

#### 実装内容

- **承認待ちユーザー一覧画面**: ユーザー管理画面に「承認待ち」タブを追加
- **承認機能**: 管理者が承認待ちユーザーを承認（`is_active = true`に設定）
- **削除（拒否）機能**: 管理者が承認待ちユーザーを削除（物理削除）
- **ダッシュボード表示**: ダッシュボードに承認待ちユーザー数を表示

#### 実装詳細

1. **承認待ちユーザー一覧取得API** (`GET /api/admin/users/pending`)
   - `is_active = false`のユーザー一覧を取得
   - 登録日時順（新しい順）で表示

2. **ユーザー承認API** (`POST /api/admin/users/[id]/approve`)
   - 承認待ちユーザーを承認（`is_active = true`に設定）
   - 社員コードの重複チェックを実行
   - 監査ログに記録（`user.approve`アクション）

3. **承認待ちユーザー削除API** (`POST /api/admin/users/[id]/reject`)
   - 承認待ちユーザーを物理削除
   - 削除前に、関連する注文、自動注文設定、自動注文テンプレートを削除
   - `employee_codes`テーブルで社員コードを解放
   - Supabase Authのユーザーを削除
   - `profiles`テーブルのレコードを削除
   - 監査ログに記録（`user.reject`アクション）

4. **UI実装**
   - ユーザー管理画面に「承認待ち」タブを追加
   - 承認待ちユーザー一覧を表示（社員コード、氏名、メール、登録日時）
   - 「承認」「編集」「削除」ボタンを表示
   - ダッシュボードに承認待ちユーザー数を表示

#### 外部キー制約の問題と解決

- **問題**: 承認待ちユーザーを削除しようとすると、`orders`テーブルに外部キー制約があるため削除できない
- **解決策**: 削除前に、関連する注文、自動注文設定、自動注文テンプレートを削除してから、`profiles`テーブルと認証ユーザーを削除

#### 実装ファイル

- `app/api/admin/users/[id]/route.ts`: 社員コード変更機能の実装
- `app/api/auth/signup/route.ts`: 新規登録方式の変更
- `app/api/admin/users/pending/route.ts`: 承認待ちユーザー一覧取得API（新規作成）
- `app/api/admin/users/[id]/approve/route.ts`: ユーザー承認API（新規作成）
- `app/api/admin/users/[id]/reject/route.ts`: 承認待ちユーザー削除API（新規作成）
- `app/admin/users/page.tsx`: 承認待ちユーザー一覧画面の追加
- `app/admin/page.tsx`: ダッシュボードに承認待ちユーザー数を表示
- `app/(auth)/login/page.tsx`: ログイン時の承認待ちチェック

#### 確認事項

- ✅ 社員コード変更時に古い社員コードが解放される
- ✅ 新しい社員コードが未登録の場合のみ変更可能
- ✅ 新規登録時は承認待ち（`is_active = false`）になる
- ✅ 管理者が承認待ちユーザーを承認できる
- ✅ 管理者が承認待ちユーザーを削除（拒否）できる
- ✅ 承認待ちユーザーはログインできない
- ✅ ダッシュボードに承認待ちユーザー数が表示される

---

## 2025-01-02（ダッシュボードの集計修正とユーザー管理画面の改善）

### ダッシュボードの承認待ちユーザー数・アクティブユーザー数の修正

#### 問題

- 承認待ちユーザーが1名いるのに、ダッシュボードの承認待ちが0人と表示される
- 承認後、アクティブユーザーが増加せず、承認前と同じ人数のまま

#### 原因

- ダッシュボードで通常のSupabaseクライアント（`createClient()`）を使用していたため、RLSポリシーの影響で全ユーザーを取得できなかった
- 承認待ちユーザーの条件が不適切（`is_active = false`のみで、退職者も含まれていた）

#### 解決策

1. **Service Role Keyの使用**
   - ダッシュボードで`supabaseAdmin`（Service Role Key）を使用してRLSをバイパス
   - アクティブユーザー数と承認待ちユーザー数を正しく取得

2. **承認待ちユーザー数の条件修正**
   - 以前: `is_active = false`のみ（退職者も含まれていた）
   - 修正後: `is_active = false` かつ `left_date`が未設定または未来の日付

#### 修正ファイル

- `app/admin/page.tsx`: Service Role Keyを使用、承認待ちユーザー数の条件を修正
- `app/api/admin/users/pending/route.ts`: 承認待ちユーザーの条件を修正

#### 確認事項

- ✅ ダッシュボードで承認待ちユーザー数が正しく表示される
- ✅ 承認後にアクティブユーザー数が増加する

### ユーザー管理画面の有効/無効切り替え表示機能

#### 実装内容

ユーザー管理画面を「有効なユーザー」「無効なユーザー」「承認待ち」の3つのタブに分割。

1. **有効なユーザータブ**
   - `is_active = true`のユーザーのみ表示
   - 通常の操作（編集、カレンダー、削除）が可能
   - 「状態」列を削除（すべて有効のため）

2. **無効なユーザータブ**
   - `is_active = false`かつ退職日が設定されているユーザー（退職者を含む）
   - グレーアウト表示（`opacity-75`）
   - 編集のみ可能（カレンダーや削除ボタンは非表示）

3. **承認待ちタブ**
   - `is_active = false`かつ退職日が未設定または未来のユーザー
   - 承認・編集・削除（拒否）が可能

#### UI改善

- 各タブにユーザー数を表示（例: 「有効なユーザー (10)」）
- 無効なユーザーの行をグレーアウト表示して視認性を向上
- 退職者が多くても有効なユーザーをすぐに確認可能

#### 修正ファイル

- `app/admin/users/page.tsx`: タブ切り替え機能を3つに分割、表示ロジックを改善

#### 確認事項

- ✅ 有効なユーザーと無効なユーザーを切り替えて表示できる
- ✅ 退職者が多くても見やすくなった

---

## 2025-01-02（ユーザー削除時の注文データ保護機能の強化）

### 問題の確認と解決

#### 問題
- 既に注文があるユーザーを削除した場合、それまでに注文したデータが消えて、お弁当代をいくら徴収すればいいかわからなくなる可能性がある

#### 現状確認
- 既存の実装では、既存ユーザーの削除は論理削除（`is_active = false`）のみで、物理削除は行っていない
- したがって、注文データは保持されており、会計・集計に問題はない

#### 追加の保護機能

1. **外部キー制約の確認・修正マイグレーション**
   - `061_check_orders_user_id_fk_constraint.sql`: 現在の外部キー制約を確認
   - `062_fix_orders_user_id_fk_to_restrict.sql`: `ON DELETE RESTRICT`に変更（データ保護のため）
   - `orders.user_id`が`profiles.id`を参照する際、`ON DELETE RESTRICT`により物理削除を防止

2. **ユーザー削除APIの改善**
   - 削除時に注文データの存在をチェック
   - 注文データがある場合、警告ログを出力
   - APIのコメントを更新し、論理削除のみであることを明確化

3. **ドキュメントの追加**
   - `docs/ユーザー削除と注文データ保護.md`: ユーザー削除と注文データ保護の仕組みを説明

#### 修正ファイル

- `app/api/admin/users/[id]/route.ts`: 注文データチェックと警告ログを追加
- `supabase/migrations/061_check_orders_user_id_fk_constraint.sql`: 外部キー制約確認用SQL（新規作成）
- `supabase/migrations/062_fix_orders_user_id_fk_to_restrict.sql`: 外部キー制約修正用SQL（新規作成）
- `docs/ユーザー削除と注文データ保護.md`: ドキュメント（新規作成）

#### 確認事項

- ✅ 既存ユーザーの削除は論理削除のみ（`is_active = false`）
- ✅ 注文データは保持される（削除されない）
- ✅ 外部キー制約により、注文データがあるユーザーは物理削除できない
- ✅ 会計・集計に影響なし

---

## 2026-01-02（ユーザー削除時の承認待ちリスト表示問題の修正）

### 問題

- 有効なユーザーを削除すると、削除直後は有効・無効・承認待ちのどこにも表示されない
- ブラウザをリロードすると、削除したユーザーが承認待ちリストに表示されてしまう
- 削除したユーザーが承認待ちリストに蓄積していく問題

### 原因

1. **削除APIが`left_date`を設定していなかった**
   - 削除時に`is_active = false`のみ設定し、`left_date`を設定していなかった
   - そのため、削除されたユーザーが承認待ち条件（`is_active = false` かつ `left_date`が未設定または未来）に一致していた

2. **承認待ちAPIの条件が不適切**
   - 承認待ち条件が`left_date >= 今日`（以上）だったため、今日の日付も含まれていた
   - 削除時に今日の日付を設定しても、承認待ちリストに含まれてしまっていた

3. **フロントエンドの即時反映が不十分**
   - 削除後に`fetchPendingUsers()`を呼び出していなかったため、承認待ちリストが即座に更新されなかった

### 解決策

1. **削除APIで`left_date`を今日の日付に設定**
   - 削除時に`is_active = false`と`left_date = 今日の日付`を同時に設定
   - これにより、削除されたユーザーは無効なユーザーリストに表示される

2. **承認待ちAPIの条件を修正**
   - 条件を`left_date >= 明日`（より大きい）に変更
   - 今日の日付は承認待ちリストから除外される

3. **フロントエンドの即時反映を改善**
   - 削除後に`fetchPendingUsers()`も呼び出すように修正
   - 削除直後から承認待ちリストが正しく更新される

### 修正ファイル

- `app/api/admin/users/[id]/route.ts`: 削除時に`left_date`を今日の日付に設定
- `app/api/admin/users/pending/route.ts`: 承認待ち条件を`left_date >= 明日`に変更
- `app/admin/users/page.tsx`: 削除後に`fetchPendingUsers()`も呼び出すように修正

### 確認事項

- ✅ 削除したユーザーは無効なユーザーリストに表示される
- ✅ 削除したユーザーは承認待ちリストに表示されない（リロード後も）
- ✅ 削除直後から承認待ちリストが正しく更新される
- ✅ 承認待ちリストに不要なユーザーが蓄積しない

---

## 2026-01-02（社員コードマスター管理画面のメニュー削除と締切時刻チェックの確認）

### 社員コードマスターの使用状況確認

#### 確認結果

- **新規登録**: 社員コードマスターを使用していない（承認方式に変更されたため）
- **社員コード変更機能**: 社員コードマスターを使用している（内部的に自動更新）
  - 新しい社員コードがマスターに存在する場合、未登録かチェック
  - 古い社員コードをマスターで解放
  - 新しい社員コードをマスターで登録済みに更新

#### 判断

- 社員コードマスターは社員コード変更機能で内部的に使用されているため、テーブルとAPIは維持
- ただし、管理者が手動でマスターを管理する必要性は低い（自動更新されるため）

### 管理者メニューからの社員コードマスター項目の削除

#### 実装内容

- 管理者メニュー（`components/admin-nav.tsx`）から「社員コードマスター」メニュー項目を削除
- 管理画面やAPIは残す（社員コード変更機能で内部的に使用されるため）
- 直接URL（`/admin/employee-codes`）でアクセスすることは可能

#### 修正ファイル

- `components/admin-nav.tsx`: 「社員コードマスター」メニュー項目を削除（35行目）

### 注文の締切時刻チェック動作の確認

#### 確認内容

注文作業中に締切時刻を過ぎた場合の動作を確認。

#### 確認結果

1. **注文作成（POST /api/orders）**
   - 締切時刻を過ぎている場合: 「締切時刻を過ぎています」というエラーが返され、注文は作成されない
   - チェックは注文確定ボタンを押した時点（API呼び出し時点）で実行される

2. **注文変更（PUT /api/orders/[id]）**
   - 締切時刻を過ぎている場合: 「締切時刻を過ぎているため、注文を変更できません」というエラーが返される
   - チェックは変更確定ボタンを押した時点（API呼び出し時点）で実行される

3. **注文キャンセル（PATCH /api/orders/[id]）**
   - 締切時刻を過ぎている場合: 「最終の確定処理で時間を過ぎているためキャンセルできません」というエラーが返される
   - チェックはキャンセルボタンを押した時点（API呼び出し時点）で実行される

#### 重要なポイント

- すべての処理で、締切時刻のチェックは処理実行時点（API呼び出し時点）で行われる
- 画面を開いた時点ではなく、確定・変更・キャンセルボタンを押した時点で判定される
- サーバー側の現在時刻（`new Date()`）を使用するため、クライアント側の時刻改ざんの影響を受けない
- 作業中に締切時刻を過ぎても、確定処理の時点でチェックされるため、締切時刻を過ぎた操作は実行されない

#### 確認ファイル

- `app/api/orders/route.ts`: 注文作成時の締切時刻チェック（177-191行目）
- `app/api/orders/[id]/route.ts`: 注文変更時の締切時刻チェック（131-149行目）、注文キャンセル時の締切時刻チェック（387-422行目）

---

## 2026-01-02（環境変数設定手順の詳細化とログイン問題の解決）

### 環境変数設定手順の詳細化

#### 実装内容

- `.env.local`ファイルの作成手順をステップバイステップで詳細化
- Supabase Dashboardからの値取得手順を追加
- 環境変数の確認方法を追加
- 使用されている環境変数の完全なリストを追加

#### 追加内容

1. **`.env.local`ファイルの作成手順**
   - PowerShellでのコピー方法
   - 手動での作成方法
   - ファイルの保存方法

2. **Supabaseの値取得手順**
   - Supabase Dashboardへのアクセス方法
   - Project Settings > APIからの値取得方法
   - 各環境変数の取得箇所の明示

3. **環境変数の設定方法**
   - 実際の値の設定例
   - プレースホルダー値の置き換え方法
   - コメント行の説明

4. **トラブルシューティングの拡充**
   - ログインできない場合（「Failed to fetch」エラー）の対処法
   - 環境変数がプレースホルダーのままの場合の対処法
   - ファイルが見つからない場合の対処法

#### 使用されている環境変数の完全なリスト

コードベース全体で使用されている環境変数を整理：

- **必須環境変数**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTO_ORDER_SECRET`
- **オプション環境変数**: `PDF_SENDER_COMPANY`, `PDF_SENDER_POSTAL_CODE`, `PDF_SENDER_ADDRESS`, `PDF_SENDER_PHONE`, `PDF_SENDER_FAX`

各環境変数の使用箇所と説明を明記。

#### 修正ファイル

- `docs/環境変数設定手順.md`: `.env.local`ファイルの作成手順を詳細化、トラブルシューティングを拡充、使用されている環境変数の完全なリストを追加

#### 確認事項

- ✅ `.env.local`ファイルの作成手順が詳細に記載されている
- ✅ Supabase Dashboardからの値取得手順が記載されている
- ✅ 使用されている環境変数の完全なリストが記載されている
- ✅ ログインできない場合のトラブルシューティングが追加されている

---

## 2026-01-02（環境変数設定とデバッグログの削除）

### 環境変数設定に関する説明の追加

#### 問題
- ログイン時に「Failed to fetch」エラーが発生
- エラーメッセージ: `net::ERR_NAME_NOT_RESOLVED`（`https://your-project-id.supabase.co`にアクセスしようとしている）

#### 原因
- `.env.local`ファイルにプレースホルダー値（`your-project-id.supabase.co`、`your-anon-key`）が残っていた
- 環境変数が正しく設定されていなかった

#### 解決策
1. **環境変数の設定手順の確認**
   - Supabase Dashboard > Project Settings > API から値を取得
   - `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`を設定
   - 開発サーバーを再起動（`.env.local`を変更した後は必須）

2. **`AUTO_ORDER_SECRET`の設定方法の説明**
   - 文字数に制限はない（推奨は64文字程度）
   - 開発環境なら簡単な文字列でも可（例: `dev-secret-key-12345`）
   - 本番環境では推測されにくいランダムな文字列を推奨

3. **PDF生成関連の環境変数について**
   - PDF生成関連の環境変数（`PDF_SENDER_*`）は**オプション**（不要）
   - システム設定画面（`/admin/settings`）から会社情報を設定することを推奨
   - 環境変数は、システム設定に値がない場合のフォールバックとして使用される

#### 修正ファイル
- `docs/環境変数設定手順.md`: 既存のドキュメントを確認（詳細な手順が記載済み）

### デバッグログの削除

#### 問題
- ログイン後、カレンダーページでログが流れ続け、画面がちらつき操作ができない

#### 原因
- デバッグ用の`console.log`が複数のファイルに残っていた
- 特に`app/(user)/calendar/page.tsx`で頻繁にログが出力されていた

#### 解決策
以下のファイルからデバッグログを削除：

1. **`lib/supabase/client.ts`**
   - `createClient`関数内のデバッグログを削除
   - 環境変数のチェックログを削除

2. **`app/(auth)/login/page.tsx`**
   - `handleLogin`関数内のデバッグログを削除
   - 環境変数チェック、`signInWithPassword`呼び出し前後のログを削除

3. **`app/(user)/calendar/page.tsx`**
   - `console.log("=== Calendar Page Debug ===")`とその関連ログを削除
   - 注文データ取得に関するログを削除
   - メニューアイテム取得に関する警告ログを削除

#### 修正ファイル
- `lib/supabase/client.ts`: デバッグログを削除
- `app/(auth)/login/page.tsx`: デバッグログを削除
- `app/(user)/calendar/page.tsx`: デバッグログを削除

#### 確認事項
- ✅ ログインが正常に動作する
- ✅ カレンダーページでログが流れない
- ✅ 画面のちらつきが解消される
- ✅ すべての機能が正常に動作する

---

## 2026-01-02（デバッグログの完全削除）

### 問題

- 新規注文画面でログが流れ続ける
- 注文ボタンを押したら警告が表示される
- エラー発生時にログが流れる

### 原因

- 注文関連のコンポーネントとAPIに多数の`console.log`と`console.error`が残っていた
- 開発時のデバッグログが本番環境でも出力されていた

### 解決策

すべての注文関連ファイルからデバッグログを削除しました。

#### 修正ファイル

1. **`components/order-form.tsx`**
   - `console.log('Submitting order:', ...)` を削除
   - `console.log('Response status:', ...)` を削除
   - `console.log('Response data:', ...)` を削除
   - `console.log('Order successful, redirecting...')` を削除
   - `console.error('Order error:', ...)` を削除

2. **`app/(user)/orders/new/page.tsx`**
   - `console.error('Vendors fetch error:', ...)` を削除
   - `console.error('Menu items fetch error:', ...)` を削除

3. **`app/api/orders/route.ts`（注文作成API）**
   - `console.log('Fetching price for menu_id:', ...)` を削除
   - `console.log('Price fetch result:', ...)` を削除
   - `console.error('Price fetch error details:', ...)` を削除
   - `console.error('Price data is null or undefined')` を削除
   - `console.log('Menu price ID:', ...)` を削除
   - `console.error('Price info fetch error:', ...)` を削除
   - `console.error('Existing order check error:', ...)` を削除
   - `console.error('UNIQUE constraint violation but no ordered order found:', ...)` を削除
   - `console.error('Order insert error:', ...)` を削除
   - `console.error('Insert error details:', ...)` を削除
   - `console.error('Audit log insert error:', ...)` を削除
   - `console.error('RPC call error:', ...)` を削除
   - `console.error('Order API error:', ...)` を削除

4. **`app/api/orders/[id]/route.ts`（注文更新・キャンセルAPI）**
   - `console.log('=== Cancel Order Request ===')` を削除
   - `console.log('Raw params:', ...)` を削除
   - `console.log('Parsed orderId:', ...)` を削除
   - `console.error('Invalid orderId:', ...)` を削除
   - `console.log('Attempting to cancel order:', ...)` を削除
   - `console.log('Update result:', ...)` を削除
   - `console.error('Order cancel error:', ...)` を削除
   - `console.error('Error details:', ...)` を削除
   - `console.error('Audit log insert error:', ...)` を削除（2箇所）
   - `console.error('Order cancel API error:', ...)` を削除
   - `console.error('Error stack:', ...)` を削除
   - `console.error('Order update error:', ...)` を削除
   - `console.error('Order update API error:', ...)` を削除

5. **`components/cancel-order-button.tsx`**
   - `console.error('Cancel error:', ...)` を削除

6. **`components/order-edit-form.tsx`**
   - `console.error('Order update error:', ...)` を削除
   - `console.error('Cancel order error:', ...)` を削除
   - `console.error('Order cancel error:', ...)` を削除

7. **`app/(user)/orders/[id]/edit/page.tsx`**
   - `console.error('Vendors fetch error:', ...)` を削除
   - `console.error('Menu items fetch error:', ...)` を削除

### 確認事項

- ✅ 新規注文画面でログが流れない
- ✅ 注文ボタンを押しても警告が表示されない
- ✅ エラー発生時もログが流れない
- ✅ すべての機能が正常に動作する

---

## 2026-01-02（注文確定時のログ出力問題と画面表示エラーの修正）

### 注文確定時のログ出力問題の修正

#### 問題

- 注文確定ボタンを押すと、コンソールに大量のログが流れる
- `router.refresh()`が呼ばれると、カレンダーページが再レンダリングされ、そのたびに`createClient()`が呼ばれてログが大量に出力される
- 注文が正常に確定できない

#### 原因

- `lib/supabase/server.ts`に以前のデバッグセッションで追加されたログが残っていた
- `router.refresh()`が呼ばれると、カレンダーページが再レンダリングされ、そのたびに`createClient()`が呼ばれてログが大量に出力されていた
- `components/order-form.tsx`で`router.refresh()`を呼び出していたが、`router.push()`で自動的にリフレッシュされるため不要

#### 解決策

1. **`lib/supabase/server.ts`からデバッグログを削除**
   - 以前のデバッグセッションで追加されたログを削除
   - `createClient()`が呼ばれるたびにログが出力されないように修正

2. **`router.refresh()`の削除**
   - `components/order-form.tsx`から`router.refresh()`を削除
   - `router.push()`で自動的にリフレッシュされるため不要

3. **すべてのデバッグログの削除**
   - `components/order-form.tsx`からデバッグログを削除
   - `app/api/orders/route.ts`からデバッグログを削除
   - `app/(user)/calendar/page.tsx`からデバッグログを削除

#### 修正ファイル

- `lib/supabase/server.ts`: デバッグログを削除
- `components/order-form.tsx`: `router.refresh()`を削除、デバッグログを削除
- `app/api/orders/route.ts`: デバッグログを削除
- `app/(user)/calendar/page.tsx`: デバッグログを削除

#### 確認事項

- ✅ 注文確定ボタンを押してもログが流れない
- ✅ 注文が正常に確定できる
- ✅ カレンダーページへのリダイレクトが正常に動作する

### 画面表示エラーの修正

#### 問題

- カレンダーページにアクセスすると、`ReferenceError: envUrl is not defined`エラーが発生
- 画面が正常に表示されない

#### 原因

- デバッグログ削除時に、`envUrl`と`envKey`の変数定義も一緒に削除してしまった
- `createServerClient`で`envUrl`と`envKey`を参照する際に、変数が定義されていないためエラーが発生

#### 解決策

- `lib/supabase/server.ts`に、環境変数から`envUrl`と`envKey`を取得するコードを復元

#### 修正ファイル

- `lib/supabase/server.ts`: `envUrl`と`envKey`の変数定義を復元

#### 確認事項

- ✅ カレンダーページが正常に表示される
- ✅ すべてのページが正常に表示される

### ユーザー管理画面のデバッグログ削除

#### 問題

- ユーザー管理画面にデバッグログが残っていた

#### 解決策

- `app/admin/users/page.tsx`からデバッグログを削除

#### 修正ファイル

- `app/admin/users/page.tsx`: デバッグログを削除

#### 確認事項

- ✅ ユーザー管理画面でログが流れない
- ✅ すべての機能が正常に動作する

---

## 2026-01-02（テスト環境のセットアップとエラーハンドリングの統一）

### テスト環境のセットアップ

#### 実装内容

- **Jest + React Testing Libraryのセットアップ**
  - JestとReact Testing Libraryをインストール
  - `jest.config.mjs`と`jest.setup.mjs`を作成
  - `package.json`にテストスクリプトを追加（`test`, `test:watch`, `test:coverage`）

#### 実装ファイル

- `jest.config.mjs`: Jest設定ファイル
- `jest.setup.mjs`: Jestセットアップファイル（環境変数のモック、Next.jsのモック）
- `package.json`: テストスクリプトの追加

### エラーハンドリングの統一

#### 実装内容

1. **エラーハンドリング用ユーティリティ関数の作成**
   - `lib/utils/errors.ts`: エラーハンドリング用ユーティリティ関数
     - `ApiError`クラス: カスタムエラークラス
     - 各種エラーレスポンス生成関数（`unauthorizedResponse`, `forbiddenResponse`, `notFoundResponse`, `validationErrorResponse`, `internalErrorResponse`）
     - `createErrorResponse`: エラーレスポンス生成ヘルパー関数

2. **API Route用ヘルパー関数の作成**
   - `lib/utils/api-helpers.ts`: API Route用ヘルパー関数
     - `getAuthenticatedUser`: 認証済みユーザー取得
     - `checkAdminPermission`: 管理者権限チェック
     - `requireAdmin`: 管理者権限必須チェック
     - `parseRequestBody`: リクエストボディのパース
     - `checkUserActive`: ユーザーのアクティブ状態チェック
     - `validateDateNotPast`: 日付バリデーション（過去の日付チェック）
     - `validateQuantity`: 数量バリデーション

#### 実装ファイル

- `lib/utils/errors.ts`: エラーハンドリングユーティリティ関数（新規作成）
- `lib/utils/api-helpers.ts`: API Route用ヘルパー関数（新規作成）

### 型定義の整理

#### 実装内容

- `lib/utils/types.ts`: 共通型定義
  - `ApiResponse`: APIレスポンスの基本型
  - `PaginationParams`, `PaginationResponse`: ページネーション型
  - `DateRange`: 日付範囲型
  - `SortOption`: ソートオプション型
  - `FilterOption`: フィルターオプション型

#### 実装ファイル

- `lib/utils/types.ts`: 共通型定義（新規作成）

### テストの追加

#### 実装内容

- `lib/utils/api-helpers.test.ts`: バリデーション関数のテスト
  - `validateDateNotPast`のテスト（未来の日付、今日の日付、過去の日付）
  - `validateQuantity`のテスト（正の整数、0、負の数、小数）
  - テスト結果: 9件すべて通過

#### 実装ファイル

- `lib/utils/api-helpers.test.ts`: バリデーション関数のテスト（新規作成）

### ドキュメントの追加

#### 実装内容

- `docs/TESTING.md`: テストガイド
  - テスト環境の説明
  - テストの実行方法
  - テストの種類（ユニットテスト、コンポーネントテスト、API Routeテスト）
  - テストカバレッジの目標
  - テストファイルの配置
  - ベストプラクティス
  - 今後の課題

- `README_TESTING.md`: テスト実行ガイド（ルートディレクトリ）
  - クイックスタート
  - テストの種類
  - 詳細ドキュメントへのリンク

#### 実装ファイル

- `docs/TESTING.md`: テストガイド（新規作成）
- `README_TESTING.md`: テスト実行ガイド（新規作成）

### .gitignoreの更新

- `.gitignore`に`.cursor/`ディレクトリを追加（デバッグログを除外）

#### 修正ファイル

- `.gitignore`: `.cursor/`ディレクトリを追加

### 確認事項

- ✅ JestとReact Testing Libraryが正常に動作する
- ✅ バリデーション関数のテストが9件すべて通過
- ✅ エラーハンドリングユーティリティ関数が作成された
- ✅ 型定義が整理された
- ✅ テストドキュメントが追加された

### 今後の課題

- API Routeの統合テストの実装（モックを使用）
- コンポーネントテストの追加
- E2Eテストのセットアップ（PlaywrightまたはCypress）
- エラーハンドリングユーティリティを既存API Routeに適用

---

## 変更履歴の記録ルール

- 日付は `YYYY-MM-DD` 形式で記載
- 変更内容は簡潔に記述
- 仕様変更の場合は、`SPEC.md` と `DECISIONS.md` も更新すること
- 実装完了後は、`PROGRESS.md` も更新すること
