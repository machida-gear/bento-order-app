# プロジェクト進捗状況

このドキュメントでは、お弁当注文 Web アプリケーションの実装進捗をチェックリスト形式で記録します。

> 📖 **関連ドキュメント**: [README.md](./README.md) - すべてのドキュメントへの参照

---

## STEP1: DB DDL + RLS ポリシー

### データベーススキーマ

- [x] 13 テーブルの作成
- [x] ENUM 型の定義（user_role, order_status, auto_order_run_status）
- [x] 主キー・外部キー制約
- [x] UNIQUE 制約
- [x] CHECK 制約
- [x] インデックスの作成

### トリガー

- [x] `updated_at` カラムの自動更新トリガー（全テーブル）

### RLS ポリシー

- [x] 全テーブルで RLS 有効化
- [x] 一般ユーザー権限のポリシー作成
- [x] 管理者権限のポリシー作成

### ヘルパー関数

- [x] `get_menu_price_id(menu_id, order_date)` の実装
- [x] `get_cutoff_time(order_date)` の実装
- [x] `is_before_cutoff(order_date)` の実装

### テストデータ

- [x] テストデータの投入（開発環境用）

**ステータス**: ✅ **完了**

---

## STEP2: Next.js プロジェクト骨組み

### プロジェクト初期化

- [x] Next.js 16.1.1 (App Router) プロジェクトの作成
- [x] TypeScript 設定
- [x] Tailwind CSS 設定

### Supabase クライアント設定

- [x] `lib/supabase/client.ts` の作成（ブラウザ用）
- [x] `lib/supabase/server.ts` の作成（サーバー用）
- [x] `lib/supabase/middleware.ts` の作成（ミドルウェア用）
- [x] `lib/supabase/admin.ts` の作成（Service Role Key 用）
- [x] `lib/database.types.ts` の生成・更新

### 認証・ミドルウェア

- [x] Next.js Middleware の実装
- [x] 認証状態のチェック
- [x] 保護されたルートのリダイレクト
- [x] セッションリフレッシュ

### レイアウト

- [x] ルートレイアウト（`app/layout.tsx`）
- [x] ユーザー用レイアウト（`app/(user)/layout.tsx`）
- [x] 管理者用レイアウト（`app/(admin)/layout.tsx`）

### UI/UX 改善

- [x] カレンダー画面のセルサイズ最適化（スマホ対応）
- [x] ログイン画面のローディング表示追加
- [x] ログインエラーメッセージの日本語化
- [x] メール確認 URL の本番環境対応

### ナビゲーション

- [x] ユーザー用ナビゲーション（`components/user-nav.tsx`）
- [x] 管理者用ナビゲーション（`components/admin-nav.tsx`）

**ステータス**: ✅ **完了**

---

## STEP3: 認証 + ユーザープロフィール同期

### ログイン・新規登録

- [x] ログインページ（`app/(auth)/login/page.tsx`）
- [x] 新規登録機能
- [x] 社員コード・氏名の入力
- [x] バリデーション（社員コード 4 桁チェック）
- [x] ログイン処理中のローディング表示（スピナーアイコン）
- [x] ログインエラーメッセージの日本語化
- [x] メール確認 URL の本番環境対応（`NEXT_PUBLIC_SITE_URL`環境変数）
- [x] パスワードリセット機能（メール内リンクからのパスワード更新）
- [x] パスワード更新フォームの実装（新しいパスワード入力、パスワード確認入力）
- [x] URL ハッシュからのトークン検出機能
- [x] フッターの変更（「© 2026 MACHIDA GEAR」）

### ユーザープロフィール作成

- [x] 新規登録時のプロフィール自動作成（`app/api/auth/signup/route.ts`）
- [x] Service Role Key を使用した RLS バイパス
- [x] エラーハンドリング

### プロフィール同期

- [x] レイアウトでのプロフィール取得
- [x] 無効ユーザーのリダイレクト処理

**ステータス**: ✅ **完了**

---

## STEP4: カレンダー画面

### カレンダー表示

- [x] 月間カレンダーグリッドの実装（`components/calendar-grid.tsx`）
- [x] 注文可能日の表示
- [x] 注文済み日の表示（メニュー名、数量）
- [x] 注文変更可能日の表示（「変更可」表示）
- [x] 注文不可日のグレーアウト表示
- [x] 今日の日付の点滅表示
- [x] 月ナビゲーション（前月・次月）
- [x] セルサイズの最適化（注文の有無に関わらず一定、スマホ対応）

### データ取得

- [x] `order_calendar` テーブルからのデータ取得
- [x] `orders` テーブルからのデータ取得（ユーザー別）
- [x] メニュー・業者情報の取得
- [x] Transaction connection (6543)対応（パフォーマンス向上）
- [x] `DATABASE_URL`未設定時のフォールバック処理（通常の Supabase クライアントを使用）
- [x] Map 型のシリアライズ問題修正（オブジェクト型への変換）
- [x] エラーハンドリングとデバッグログの追加
- [x] Hydration Mismatch エラー修正（React error #418、サーバー・クライアント間の日付計算の不一致解決）
- [x] 全日付グレーアウト問題修正（`target_date`フォーマット正規化、`orderDaysMap`キーマッピング修正）
- [x] 過去注文クリック問題修正（削除済み`canEditOrder()`呼び出し削除、`shouldBeGray`と`canEditOrderValue`の直接チェック）
- [x] 月変更時の画面ちらつき修正（`localStorage`からの初期値復元、状態保持）
- [x] 13 日セル表示問題修正（`order.order_date`が Date オブジェクトの場合の処理追加、`YYYY-MM-DD`形式への変換）
- [x] Hydration Mismatch 再発修正（`useState`初期値から`localStorage`アクセス削除）
- [x] カレンダーリサイズ問題修正（空のカレンダーに padding 追加、`requestAnimationFrame`で`isMounted`更新を遅延）

### 注文可否判定

- [x] 過去の日付の判定
- [x] 締切時刻の判定
- [x] 注文可能日の判定
- [x] 過去注文の編集可否判定（`canEditOrderValue`の正しい計算と`CalendarCell`への渡し方修正）
- [x] `order.order_date`が Date オブジェクトの場合の処理（本番環境とローカル環境の型の違いに対応）

**ステータス**: ✅ **完了**

---

## STEP5: 注文機能

### 注文画面

- [x] 注文画面の作成（`app/(user)/orders/new/page.tsx`）
- [x] メニュー選択 UI（業者別にグループ化）
- [x] 数量入力
- [x] 注文確定処理
- [x] 注文日のバリデーション（過去の日付、締切時刻チェック）
- [x] 締切時間表示機能（すべての日付で締切時間を表示、注文者が締切時間を確認できるように改善）

### 注文 API

- [x] 注文作成 API（`app/api/orders/route.ts`）
- [x] 価格 ID 取得処理（`get_menu_price_id` 関数を使用）
- [x] 締切時刻チェック
- [x] エラーハンドリング
- [x] 監査ログ記録
- [x] 同日の重複注文チェック
- [x] Transaction connection (6543)対応（トランザクション保証、パフォーマンス向上）

### 注文履歴

- [x] 注文履歴画面（`app/(user)/orders/page.tsx`）
- [x] 注文一覧表示
- [x] キャンセル機能
- [x] キャンセル API（`app/api/orders/[id]/route.ts`）
- [x] Transaction connection (6543)対応（パフォーマンス向上）

### 注文変更機能

- [x] 注文編集画面（`app/(user)/orders/[id]/edit/page.tsx`）
- [x] 注文編集フォーム（`components/order-edit-form.tsx`）
- [x] 注文更新時の制約違反エラー修正（キャンセル済み注文の削除処理を追加、`unique_order_per_day`制約違反を防止）
- [x] 注文更新 API（`PUT /api/orders/[id]`）
- [x] 締切時刻前の注文変更機能
- [x] 管理者による注文代理操作機能（注文作成・更新・キャンセル）
- [x] 管理者によるカレンダー画面の代理操作機能
- [x] 管理者による過去の日付への注文入力機能（管理者モードの場合のみ、後日注文データに間違いがわかったときの修正のため）
- [x] 管理者による注文削除機能（物理削除、`DELETE /api/orders/[id]`）
- [x] 注文一覧画面に削除ボタンの追加
- [x] 一般ユーザーは締切時刻を過ぎた注文をキャンセル不可
- [x] 管理者モード判定ロジックの改善（`user_id`パラメータが指定されている場合のみ管理者モード）
- [x] 管理者が管理画面から自分のカレンダーを開く場合も管理者モードで動作
- [x] 管理者がユーザー画面からカレンダーを開く場合はユーザーモードで動作
- [x] Transaction connection (6543)対応（トランザクション保証、パフォーマンス向上）

### カレンダーでの注文表示

- [x] 注文済み日にメニュー名と数量を表示
- [x] 注文がある日は「注文可」ボタンを非表示
- [x] 締切時刻前の注文はクリック可能で編集画面に遷移

**ステータス**: ✅ **完了**

---

## STEP6: 管理者機能

### カレンダー管理

- [x] カレンダー管理画面（`app/admin/calendar/page.tsx`）
- [x] 注文可能日の設定
- [x] 締切時刻の設定
- [x] 備考の入力
- [x] 複数日選択機能（一括編集）
- [x] 月一括編集機能
- [x] システム設定からの設定読み込み

### 業者・メニュー管理

- [x] 業者管理画面（`app/admin/vendors/page.tsx`）
- [x] メニュー管理画面（`app/admin/menus/page.tsx`）
- [x] 価格管理画面（`app/admin/prices/page.tsx`）

### 集計・CSV 出力

- [x] 集計画面（`app/admin/reports/page.tsx`）
- [x] CSV 出力機能（明細）
- [x] CSV 出力機能（ユーザー別合計金額）
- [x] 締日期間の選択（システム設定の締日を基準に自動計算）
- [x] システム設定の締日表示機能
- [x] 過去 12 ヶ月分の締日期間の自動計算機能
- [x] 集計データの表示（注文一覧、合計金額）
- [x] 業者とユーザーでの絞り込み機能
- [x] 代理注文の視覚表示（背景色、ボーダー、バッジ）
- [x] 締日期間選択のコンパクト化（セレクトボックス化）

### システム設定

- [x] システム設定テーブル（`system_settings`）の作成
- [x] システム設定画面（`app/admin/settings/page.tsx`）
- [x] デフォルト締切時刻の設定
- [x] 締め日の設定（1〜31 日、月末締め対応）
- [x] 最大注文可能日数の設定（1〜365 日）
- [x] 曜日ごとのデフォルト設定（月一括編集で使用）
- [x] 会社情報の設定（会社名、郵便番号、住所、電話番号、FAX 番号、メールアドレス）
- [x] システム設定 API（`GET/PUT /api/admin/settings`）

### ダッシュボード

- [x] 管理者ダッシュボード（`app/admin/page.tsx`）
- [x] 本日の注文数表示
- [x] アクティブユーザー数表示（Service Role Key 使用）
- [x] 承認待ちユーザー数表示（Service Role Key 使用、承認待ちユーザーの条件修正）
- [x] アクティブ業者数表示（Service Role Key 使用）
- [x] アクティブメニュー数表示（Service Role Key 使用）
- [x] ダッシュボードから各管理画面へのアクセス機能

### API 実装

- [x] カレンダー管理 API（`PUT /api/admin/calendar`）
- [x] 業者管理 API（`GET/POST /api/admin/vendors`, `PUT/DELETE /api/admin/vendors/[id]`）
- [x] メニュー管理 API（`GET/POST /api/admin/menus`, `PUT/DELETE /api/admin/menus/[id]`）
- [x] 価格管理 API（`GET/POST /api/admin/prices`, `PUT/DELETE /api/admin/prices/[id]`）
- [x] 価格管理 API の Service Role Key 使用（RLS バイパス）
- [x] 未来の価格改定設定機能（既存の有効価格の自動終了）
- [x] 価格編集時の上書き許可（重複チェック削除）
- [x] 価格編集時の自動調整機能（既存価格の終了日を自動設定）
- [x] 価格管理画面の業者別グループ化表示
- [x] 集計データ取得 API（`GET /api/admin/reports/summary`）
- [x] 集計データ取得 API の Service Role Key 使用（RLS バイパス、代理注文識別）
- [x] 集計データ取得 API のフィルタ機能（業者・ユーザー絞り込み）
- [x] CSV 出力 API（`GET /api/admin/reports/csv`）
- [x] CSV 出力 API（ユーザー別合計）（`GET /api/admin/reports/csv-by-user`）
- [x] 締日期間一覧取得 API（`GET /api/admin/closing-periods`）
- [x] システム設定 API（`GET/PUT /api/admin/settings`）
- [x] 会社情報の保存・取得機能（システム設定 API に追加）
- [x] PDF 出力 API（`GET /api/admin/orders/today/pdf`）
- [x] PDF 生成時の会社マスターからの情報取得機能
- [x] PDF 生成時の監査ログ記録機能
- [x] CSV 出力時の監査ログ記録機能（明細・ユーザー別合計）

### ルート構造の修正

- [x] ルートグループの衝突問題を解決（`app/(admin)` → `app/admin`）
- [x] 古い`app/(admin)`ディレクトリの削除

### ユーザー管理

- [x] ユーザー管理画面（`app/admin/users/page.tsx`）
- [x] ユーザー一覧表示（社員コード、氏名、メール、権限、入社日、退職日、状態）
- [x] ユーザー編集機能
- [x] ユーザー削除機能（`is_active = false`に設定）
- [x] ユーザー管理 API（`GET/POST /api/admin/users`, `PUT/DELETE /api/admin/users/[id]`）
- [x] パスワードリセット機能（管理者画面・ログインページ）
- [x] 退職日の自動無効化処理（自動注文実行 API に統合）
- [x] 注文 API でのユーザー状態チェック（`is_active`、退職日）
- [x] ユーザー管理 API の 403 エラー修正（Service Role Key 使用）
- [x] ユーザー管理画面からカレンダー画面へのアクセス機能
- [x] 「ダッシュボードに戻る」ボタンの追加
- [x] 有効/無効ユーザーの切り替え表示機能（3 つのタブ: 有効なユーザー、無効なユーザー、承認待ち）
- [x] ダッシュボードの承認待ちユーザー数・アクティブユーザー数の修正（Service Role Key 使用、承認待ちユーザーの条件修正）
- [x] ユーザー削除時の承認待ちリスト表示問題の修正（削除時に`left_date`を設定、承認待ち条件を`left_date >= 明日`に変更）

### 新規登録制限機能

- [x] 社員コードマスターテーブル（`employee_codes`）の作成
- [x] 招待コード機能の実装（4 桁の数字、使用回数制限付き）
- [x] 新規登録画面に招待コード入力欄を追加
- [x] 新規登録 API で招待コードと社員コードマスターのチェックを実装
- [x] 招待コード管理専用ページ（`app/admin/invitation-code/page.tsx`）
- [x] 招待コード管理 API（`GET/PUT /api/admin/invitation-code`）
- [x] 社員コードマスター管理画面（`app/admin/employee-codes/page.tsx`）
- [x] 社員コードマスター管理 API（`GET/POST /api/admin/employee-codes`, `PUT/DELETE /api/admin/employee-codes/[id]`）
- [x] システム設定画面から招待コード設定を削除
- [x] ナビゲーションに「招待コード管理」「社員コードマスター」メニューを追加
- [x] 管理者メニューから「社員コードマスター」メニュー項目を削除（社員コード変更機能で内部的に使用されるため、管理画面と API は維持）
- [x] PDF 生成時の監査ログ記録機能の修正（headers()関数のエラー修正）

### 新規登録方式の変更（承認方式への移行）

- [x] 社員コードマスター方式の廃止（新規登録時のチェックを削除）
- [x] 新規登録時は`is_active = false`（承認待ち）に設定
- [x] 新規登録時に監査ログに記録（`user.signup.pending`アクション）
- [x] ログイン時の承認待ちチェック機能
- [x] 承認待ちユーザー一覧取得 API（`GET /api/admin/users/pending`）
- [x] ユーザー承認 API（`POST /api/admin/users/[id]/approve`）
- [x] 承認待ちユーザー削除 API（`POST /api/admin/users/[id]/reject`）
- [x] 承認待ちユーザー一覧画面（ユーザー管理画面に「承認待ち」タブを追加）
- [x] ダッシュボードに承認待ちユーザー数を表示

### 社員コード変更機能

- [x] 社員コード変更機能の実装（`app/api/admin/users/[id]/route.ts`の PUT メソッド）
- [x] 変更時に古い社員コードを`employee_codes`テーブルで解放
- [x] 新しい社員コードを`employee_codes`テーブルでチェック（未登録のみ許可）
- [x] 監査ログに変更前後の社員コードを記録

### 注文一覧機能

- [x] 注文一覧画面（`app/admin/orders/today/page.tsx`）
- [x] 日付指定による注文一覧表示
- [x] 業者別・メニュー別にグループ化して表示
- [x] 注文時刻順（新しい順）で表示
- [x] 各業者・メニューの小計と全体の合計金額を表示
- [x] 日付選択カレンダー（注文がある日のみ選択可能）
- [x] 月ナビゲーション機能
- [x] ダッシュボードの「本日の注文」カードからアクセス可能
- [x] 管理画面メニューに「注文一覧」を追加
- [x] PDF 出力機能（業者ごとの注文書 PDF 生成）
- [x] PDF 生成時のフォントファイル問題の解決（Helvetica.afm エラーの解消）
- [x] PDF 生成時の日本語文字化け問題の解決（日本語フォントの埋め込み）
- [x] PDF 生成エラーの修正（実行時に確実にフォントファイルをコピー）
- [x] PDF デザインの発注書形式への変更（青いバナーヘッダー、業者名、送信者情報、合計食数表示）
- [x] 明細のフォントサイズ拡大（10pt → 14pt）と数量の中央寄せ
- [x] 会社マスター機能の実装（system_settings テーブルに会社情報カラムを追加）
- [x] 注文削除ボタンの追加（管理者のみ、物理削除）

**ステータス**: ✅ **完了**

**注意事項:**

- ✅ 操作ログ閲覧画面を実装（STEP6 の一部として完了）
- 新規ユーザー作成は、Supabase Auth との連携が必要なため、認証画面から新規登録を行い、その後この画面で情報を編集する
- 退職日の自動無効化は、自動注文実行 API（`/api/auto-order/run`）内で実行される（毎日 10:00 JST、自動注文実行時）

---

## STEP7: 自動注文機能

### 自動注文設定

- [x] 自動注文設定画面（`app/(user)/settings/auto-order/page.tsx`）
- [x] テンプレートの作成・編集・削除
- [x] メニュー選択機能（業者別にグループ化）
- [x] 数量設定
- [x] 曜日別テンプレート設定（日曜日〜土曜日、毎日）
- [x] 重複チェック（同じ曜日に複数のテンプレートを設定できない）
- [x] 毎日テンプレートと特定の曜日テンプレートの競合防止

### 自動注文実行

- [x] 自動注文実行 API（`app/api/auto-order/run/route.ts`）
- [x] 翌営業日の判定（`order_calendar`テーブルから`is_available = true`の最初の日を取得）
- [x] 既存注文のチェック（対象日に既に注文がある場合はスキップ）
- [x] テンプレートの適用（曜日別・毎日、優先順位: 特定の曜日 > 毎日）
- [x] 実行履歴の記録（`auto_order_runs`と`auto_order_run_items`テーブル）
- [x] エラーハンドリング（各ユーザーごとにエラーを記録）

### 自動注文スケジューラー

- [x] Vercel Cron Jobs の設定（`vercel.json`）
- [x] 毎日 10:00 JST に自動実行
- [x] 認証機能（Vercel Cron Jobs 対応、`x-vercel-cron`ヘッダーで自動認証）
- [x] 開発環境・手動実行時の認証（`AUTO_ORDER_SECRET`を使用）

**ステータス**: ✅ **完了**

**注意事項:**

- 本番環境デプロイ時は、`docs/本番環境デプロイ時のチェックリスト.md` を参照してください
- 環境変数の設定は本番環境デプロイ時に行います（`docs/環境変数設定手順.md` を参照）
- Vercel の Cron Jobs 制限を回避するため、退職済みユーザー無効化処理は自動注文実行 API に統合されています（実行タイミング: 毎日 10:00 JST）

---

## STEP8: 監査ログ

### ログ記録

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
- [x] PDF 生成時のログ記録（`app/api/admin/orders/today/pdf/route.ts`）
- [x] CSV 出力時のログ記録（`app/api/admin/reports/csv/route.ts`）
- [x] CSV 出力（ユーザー別合計）時のログ記録（`app/api/admin/reports/csv-by-user/route.ts`）

### ログ閲覧

- [x] 管理者用ログ閲覧画面（`app/admin/logs/page.tsx`）
- [x] ログ検索・フィルタ機能（アクション種別、対象テーブル、日付範囲）
- [x] ページネーション機能（50 件ずつ表示）

**ステータス**: ✅ **完了**

---

## テスト・品質保証

### テスト環境のセットアップ

- [x] Jest + React Testing Library のセットアップ
- [x] `jest.config.mjs`と`jest.setup.mjs`の作成
- [x] `package.json`にテストスクリプトの追加
- [x] テストドキュメントの追加（`docs/TESTING.md`, `README_TESTING.md`）

### 単体テスト

- [x] ヘルパー関数のテスト（バリデーション関数）
  - [x] `validateDateNotPast`のテスト
  - [x] `validateQuantity`のテスト
- [ ] API Route のテスト
- [ ] コンポーネントのテスト

### 統合テスト

- [ ] 認証フローのテスト
- [ ] 注文フローのテスト
- [ ] 自動注文フローのテスト

### E2E テスト

- [ ] ユーザーシナリオのテスト
- [ ] 管理者シナリオのテスト

### コード品質の向上

- [x] エラーハンドリング用ユーティリティ関数の作成
- [x] 型定義の整理（共通型定義）
- [ ] エラーハンドリングユーティリティを既存 API Route に適用

**ステータス**: ✅ **一部完了**（テスト環境のセットアップ、バリデーション関数のテスト、エラーハンドリングユーティリティ関数の作成、型定義の整理）

---

## ドキュメント

### 仕様書

- [x] SPEC.md の作成
- [x] DECISIONS.md の作成
- [x] PROGRESS.md の作成
- [x] TODO.md の作成
- [x] CHANGELOG.md の作成

### 開発ドキュメント

- [x] STEP1 実装完了報告
- [ ] API 仕様書
- [ ] データベース設計書

**ステータス**: ✅ **一部完了**

---

## まとめ

### 完了項目

- STEP1: DB DDL + RLS ポリシー ✅
- STEP2: Next.js プロジェクト骨組み ✅
- STEP3: 認証 + ユーザープロフィール同期 ✅（ローディング表示、エラーメッセージ日本語化、メール確認 URL 対応）
- STEP4: カレンダー画面 ✅（セルサイズ最適化、スマホ対応）
- STEP5: 注文機能 ✅
- STEP6: 管理者機能 ✅（カレンダー、業者、メニュー、価格、レポート、システム設定、ユーザー管理、注文一覧、PDF 出力、社員コードマスター管理、招待コード管理）
- STEP7: 自動注文機能 ✅
- STEP8: 監査ログ ✅（ログ記録、ログ閲覧）
- 新規登録制限機能 ✅（招待コード方式、社員コードマスター方式）
- 社員コード変更機能 ✅
- 新規登録方式の変更 ✅（承認方式への移行）
- 承認待ちユーザー管理機能 ✅（承認、削除（拒否））

### 進行中項目

- なし

### 未着手項目

- テスト・品質保証の一部（API Route テスト、コンポーネントテスト、統合テスト、E2E テスト） ⏳

### 次の優先タスク

詳細は `TODO.md` を参照してください。
