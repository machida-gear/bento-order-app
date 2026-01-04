# 実装タスク一覧

このドキュメントでは、次に実装すべき作業を優先度順に箇条書きで記載します。開発者（Cursor）がそのままタスクとして使える粒度で書きます。

> 📖 **関連ドキュメント**: [README.md](./README.md) - すべてのドキュメントへの参照

---

## 優先度: 高（次に実装すべき）

### 社員コード変更機能と新規登録方式の変更

#### 1. 社員コード変更機能

- [x] 社員コード変更機能の実装（`app/api/admin/users/[id]/route.ts`のPUTメソッド）
- [x] 変更時に古い社員コードを`employee_codes`テーブルで解放
- [x] 新しい社員コードを`employee_codes`テーブルでチェック（未登録のみ許可）
- [x] 監査ログに変更前後の社員コードを記録

#### 2. 新規登録方式の変更

- [x] 社員コードマスター方式の廃止（新規登録時のチェックを削除）
- [x] 新規登録時は`is_active = false`（承認待ち）に設定
- [x] 新規登録時に監査ログに記録（`user.signup.pending`アクション）
- [x] ログイン時の承認待ちチェック機能

#### 3. 承認待ちユーザー管理機能

- [x] 承認待ちユーザー一覧取得API（`GET /api/admin/users/pending`）
- [x] ユーザー承認API（`POST /api/admin/users/[id]/approve`）
- [x] 承認待ちユーザー削除API（`POST /api/admin/users/[id]/reject`）
- [x] 承認待ちユーザー一覧画面（ユーザー管理画面に「承認待ち」タブを追加）
- [x] ダッシュボードに承認待ちユーザー数を表示

**ステータス**: ✅ **完了**

---

## 優先度: 中（注文機能完了後）

### 注文機能の実装

#### 1. 注文画面の作成

- [x] `app/(user)/orders/new/page.tsx` を作成
- [ ] URL パラメータ `date` から注文日を取得
- [ ] 注文日のバリデーション（過去の日付、締切時刻チェック）
- [ ] 有効なメニュー一覧の取得（`vendors.is_active = true`、`menu_items.is_active = true`）
- [ ] メニュー選択 UI（業者別にグループ化）
- [ ] 数量入力 UI（1 以上の整数）
- [ ] 注文確定ボタン

#### 2. 注文作成 API

- [ ] `app/api/orders/route.ts` を作成（POST）
- [ ] リクエストボディのバリデーション（`menu_id`、`order_date`、`quantity`）
- [ ] 締切時刻チェック（`is_before_cutoff` 関数を使用）
- [ ] 価格 ID 取得（`get_menu_price_id` 関数を使用）
- [ ] 注文作成（`orders` テーブルに INSERT）
- [ ] 重複チェック（UNIQUE 制約による）
- [ ] 監査ログ記録（`audit_logs` テーブルに INSERT）
- [ ] エラーハンドリング

#### 3. 注文履歴画面

- [ ] `app/(user)/orders/page.tsx` を作成
- [ ] ユーザーの注文一覧取得（`orders` テーブル、`status = 'ordered'`）
- [ ] メニュー・業者情報の取得
- [ ] 注文一覧の表示（日付、メニュー名、数量、価格）
- [ ] キャンセル機能（`status = 'cancelled'` に更新）
- [ ] キャンセル API（`app/api/orders/[id]/route.ts` の PATCH）

---

## 優先度: 中（注文機能完了後）

### 管理者機能の実装

#### 4. カレンダー管理画面

- [x] `app/admin/calendar/page.tsx` を作成
- [x] 月間カレンダー表示（管理者用）
- [x] 日付クリックで注文可能日の設定
- [x] `is_available` の切り替え
- [x] `deadline_time` の設定
- [x] `note` の入力
- [x] 更新 API（`app/api/admin/calendar/route.ts` の PUT）
- [x] 複数日選択機能（一括編集）
- [x] 備考入力欄の追加
- [x] 月一括編集機能
- [x] システム設定からの設定読み込み

**ステータス**: ✅ **完了**

#### 5. 業者管理画面

- [x] `app/admin/vendors/page.tsx` を作成
- [x] 業者一覧表示
- [x] 業者追加フォーム
- [x] 業者編集フォーム
- [x] 業者削除機能（`is_active = false` に更新）
- [x] CRUD API（`app/api/admin/vendors/route.ts`）

**ステータス**: ✅ **完了**

#### 6. メニュー管理画面

- [x] `app/admin/menus/page.tsx` を作成
- [x] メニュー一覧表示（業者別にグループ化）
- [x] メニュー追加フォーム（業者選択）
- [x] メニュー編集フォーム
- [x] メニュー削除機能（`is_active = false` に更新）
- [x] CRUD API（`app/api/admin/menus/route.ts`）

**ステータス**: ✅ **完了**

#### 7. 価格管理画面

- [x] `app/admin/prices/page.tsx` を作成
- [x] 価格履歴一覧表示（メニュー別）
- [x] 価格追加フォーム（`start_date`、`end_date`、`price`）
- [x] 価格期間の重複チェック
- [x] 価格編集フォーム
- [x] CRUD API（`app/api/admin/prices/route.ts`）

**ステータス**: ✅ **完了**

#### 8. 集計・CSV 出力画面

- [x] `app/admin/reports/page.tsx` を作成
- [x] 締日期間の選択（`closing_periods` テーブルから取得）
- [x] 集計データの取得（`orders` テーブル、`status = 'ordered'`）
- [x] 集計結果の表示（日付、ユーザー、メニュー、数量、価格、小計）
- [x] CSV 出力機能（`app/api/admin/reports/csv/route.ts`）
- [x] CSV ファイルのダウンロード
- [x] 業者とユーザーでの絞り込み機能
- [x] 代理注文の視覚表示（背景色、ボーダー、バッジ）
- [x] 締日期間選択のコンパクト化（セレクトボックス化）

**ステータス**: ✅ **完了**

#### 9. システム設定画面

- [x] `system_settings` テーブルの作成
- [x] `app/admin/settings/page.tsx` を作成
- [x] デフォルト締切時刻の設定
- [x] 締め日の設定（1〜31 日、月末締め対応）
- [x] 最大注文可能日数の設定（1〜365 日）
- [x] 曜日ごとのデフォルト設定（月一括編集で使用）
- [x] システム設定 API（`GET/PUT /api/admin/settings`）

**ステータス**: ✅ **完了**

#### 10. ユーザー管理画面

- [x] `app/admin/users/page.tsx` を作成
- [x] ユーザー一覧表示（社員コード、氏名、メール、権限、入社日、退職日、状態）
- [x] ユーザー編集フォーム
- [x] ユーザー削除機能（`is_active = false` に設定）
- [x] CRUD API（`app/api/admin/users/route.ts`）

**ステータス**: ✅ **完了**

**注意事項:**

- 新規ユーザー作成は、Supabase Auth との連携が必要なため、認証画面から新規登録を行い、その後この画面で情報を編集する

---

## 優先度: 中（管理者機能完了後）

### 自動注文機能の実装

#### 9. 自動注文設定画面

- [x] `app/(user)/settings/auto-order/page.tsx` の実装
- [x] テンプレート一覧表示
- [x] テンプレート追加フォーム（`menu_id`、`quantity`、`day_of_week`）
- [x] テンプレート編集フォーム
- [x] テンプレート削除機能
- [x] メニュー選択機能（業者別にグループ化）
- [x] 重複チェック機能（同じ曜日に複数のテンプレートを設定できない）

#### 10. 自動注文実行 API

- [x] `app/api/auto-order/run/route.ts` を作成（POST）
- [x] 対象日の判定（翌営業日、`is_available = true` の最初の日）
- [x] 有効なユーザーの取得（`is_active = true`）
- [x] テンプレートの取得（`day_of_week` が一致するもの、または毎日テンプレート）
- [x] 既存注文のチェック（既に注文がある場合はスキップ）
- [x] 注文作成処理
- [x] 実行履歴の記録（`auto_order_runs`、`auto_order_run_items`）
- [x] エラーハンドリング（各ユーザーごとにエラーを記録）

#### 11. 自動注文スケジューラー

- [x] Vercel Cron Jobs の設定（`vercel.json`）
- [x] 毎日 10:00 JST に自動実行
- [x] 認証機能（Vercel Cron Jobs 対応）

**ステータス**: ✅ **完了**

詳細は `docs/自動注文機能の実装.md` を参照してください。

---

## 優先度: 低（主要機能完了後）

### 監査ログ機能

#### 12. ログ記録の実装

- [x] 注文作成時のログ記録（`app/api/orders/route.ts`）
- [x] 注文更新時のログ記録（`app/api/orders/[id]/route.ts`）
- [x] 注文キャンセル時のログ記録（`app/api/orders/[id]/route.ts`）
- [x] 価格作成・更新・削除時のログ記録（`app/api/admin/prices/route.ts`, `app/api/admin/prices/[id]/route.ts`）
- [x] 業者作成・更新・削除時のログ記録（`app/api/admin/vendors/route.ts`, `app/api/admin/vendors/[id]/route.ts`）
- [x] メニュー作成・更新・削除時のログ記録（`app/api/admin/menus/route.ts`, `app/api/admin/menus/[id]/route.ts`）
- [x] カレンダー設定更新時のログ記録（`app/api/admin/calendar/route.ts`）
- [x] ユーザー更新・削除時のログ記録（`app/api/admin/users/[id]/route.ts`）
- [x] システム設定更新時のログ記録（`app/api/admin/settings/route.ts`）
- [x] 自動注文実行時のログ記録（`app/api/auto-order/run/route.ts`）

#### 13. ログ閲覧画面

- [x] `app/admin/logs/page.tsx` を作成
- [x] ログ一覧表示（`audit_logs` テーブル）
- [x] ログ検索・フィルタ機能（アクション種別、対象テーブル、日付範囲）
- [x] ページネーション（50 件ずつ表示）

**ステータス**: ✅ **完了**

---

## 優先度: 低（将来の拡張）

### 複数業者対応

#### 14. 業者別の休業日管理

- [ ] `vendor_holidays` テーブルの作成
- [ ] 業者別の休業日設定画面
- [ ] 注文可能日の判定ロジックの更新（少なくとも 1 社が営業していれば OK）

### UI/UX 改善

#### 15. レスポンシブデザインの改善

- [ ] スマートフォン向けの UI 最適化
- [ ] タブレット向けの UI 最適化

#### 16. エラーハンドリングの強化

- [ ] ユーザーフレンドリーなエラーメッセージ
- [ ] エラー時のリトライ機能

---

## 技術的負債・リファクタリング

### コード品質

#### 17. 型定義の整理

- [ ] `lib/database.types.ts` の最新化
- [ ] カスタム型の定義（`types/` フォルダ）

#### 18. エラーハンドリングの統一

- [ ] エラーハンドリング用のユーティリティ関数
- [ ] エラーレスポンスの統一フォーマット

#### 19. テストの追加

- [ ] 単体テスト（ヘルパー関数、API Route）
- [ ] 統合テスト（認証フロー、注文フロー）
- [ ] E2E テスト（主要シナリオ）

---

## 優先度: 低（将来の拡張）

### PDF 出力機能

#### PDF 出力機能の実装

- [x] PDF 生成 API（`app/api/admin/orders/today/pdf/route.ts`）の実装
- [x] 業者ごとの注文書 PDF 生成（A4 サイズ）
- [x] 注文明細の表示（何を何食）
- [x] 注文一覧画面に PDF 出力ボタンの追加
- [x] PDF 生成エラーの修正（実行時に確実にフォントファイルをコピー）
- [x] PDF デザインの発注書形式への変更（青いバナーヘッダー、業者名、送信者情報、合計食数表示）
- [x] 明細のフォントサイズ拡大（10pt → 14pt）と数量の中央寄せ
- [x] 会社マスター機能の実装（system_settings テーブルに会社情報カラムを追加）

**ステータス**: ✅ **完了**

**注意事項:**

- `pdfkit`を使用して PDF 生成を実装
- 日本語フォントのサポートが限定的なため、必要に応じて日本語フォントを埋め込む必要がある
- 本番環境での PDF 生成エラー対策は`docs/本番環境PDF生成エラー対策チェックリスト.md`を参照

---

## 注意事項

- 各タスクは、`SPEC.md` と `DECISIONS.md` を参照して実装すること
- 実装完了後は、`PROGRESS.md` を更新すること
- 仕様変更が必要な場合は、`DECISIONS.md` と `CHANGELOG.md` に追記すること
