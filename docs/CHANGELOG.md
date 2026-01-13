# 変更履歴

このドキュメントでは、お弁当注文 Web アプリケーションの仕様や方針の変更履歴を時系列で記載します。

> 📖 **関連ドキュメント**: [README.md](./README.md) - すべてのドキュメントへの参照

---

## 2026-01-13（認証・パスワードリセット改善 / 注文履歴の過去キャンセル防止）

### 認証（通常ログインが進まない問題の修正）

- **問題**: ログインボタン押下後に「ログイン中…」のまま進まず、画面遷移できない
- **原因**: Supabase のクライアント設定（auth関連の上書き）により、ブラウザ側とサーバー/ミドルウェア側でセッションが不整合になり、遷移先で未認証扱いになっていた
- **解決策**:
  - Supabase SSR のデフォルト設定（cookie名等）に合わせ、独自のauth設定上書きを撤回

### パスワードリセット（URLスキャナ対策 / OTPコード入力方式）

- **問題**: メールのリンクが自動スキャンされ、ワンタイムトークンが消費され `otp_expired` / `Email link is invalid or has expired` になる
- **解決策**:
  - **OTPコード入力方式**を採用（`verifyOtp(type: 'recovery')`）
  - **OTP桁数を8桁**（Supabaseの Email OTP Length）に合わせてUIとバリデーションを更新
  - メールテンプレートに `{{ .Token }}`（OTPコード）を表示する運用を推奨

### 注文履歴（過去注文のキャンセル防止）

- **問題**: 注文履歴から過去の注文をキャンセルできてしまう
- **原因**: 本番環境（UTC）とJSTのズレ、および `order_date` の形式（ISO文字列混在）により、UI判定とサーバー判定が不正確になっていた
- **解決策**:
  - **UI側**: `order_date` を必ず `YYYY-MM-DD` に正規化してから締切/過去判定・`order_calendar`参照を行い、過去注文にはキャンセルボタンを表示しない
  - **API側**: キャンセルAPIで **JST基準の「過去日」** を拒否（サーバーでも確実にブロック）

### 修正ファイル

- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `lib/supabase/middleware.ts`
- `app/(auth)/login/page.tsx`
- `components/orders-history-client.tsx`
- `app/api/orders/[id]/route.ts`

### 自動注文（手動実行で500になる問題の調査・修正）

- **問題**: 手動実行時に `auto_order_runs.status` の制約違反（`running` が許可されず 23514）
- **対応**: 実行履歴の `status` を環境差分に耐えるように見直し、進行状況/エラーは `log_details` に記録するように修正

---

## 2026-01-11（レポート画面改善・注文履歴ページの締日期間集計機能追加・開発環境改善）

### レポート・CSV出力画面の改善

- **締日期間リストが更新されない問題を修正**: 来月の期間も含めるように変更（来月1ヶ月＋過去12ヶ月）
- **締日期間の表示形式を短縮**: `2025年12月11日～2026年1月10日（2025-12-11～2026-01-10）` → `2025年12月11日～2026年1月10日`
- **スマホ表示の改善**: ラベルを短くし、「～」の前後のスペースを削除して折り返しを改善

---

## 2026-01-11（注文履歴ページの締日期間集計機能追加・開発環境改善）

### 追加機能

- 注文履歴ページで、締日期間で区切って注文を集計・表示する機能を追加
- 「先月」「今月」「来月」の切り替えボタンを追加（デフォルトは「今月」）
- システム設定の締日を基準に締日期間を自動計算

### 修正

- **期間ボタンで表示が切り替わらない問題を修正**: 締日期間の計算ロジックを修正し、正しく期間を切り替えられるように
- **注文履歴が表示されない問題を修正**: データ取得範囲を「先月から来月」までに拡大
- **「先月」ボタンを追加**: 順番を「先月」「今月」「来月」に変更
- **先月・来月の期間計算が間違っている問題を修正**: 期間計算を「開始月」基準から「終了月」基準に変更
- **注文履歴が表示されない問題を修正**: `order_date`がDateオブジェクトの場合も正しくYYYY-MM-DD形式に変換してフィルタリング

### 開発環境の改善

#### ロックファイル問題の修正

- **問題**: `npm run dev` を複数回実行すると `Unable to acquire lock` エラーが発生
- **原因**: バックグラウンドで開発サーバーを起動した際、正常に終了せずロックファイルが残る
- **解決策**:
  - `scripts/copy-fonts.js` にロックファイル削除機能を追加
  - `scripts/kill-nextjs-quiet.ps1` スクリプトを作成（既存のNext.jsプロセスを終了）
  - `package.json` に `kill-nextjs:quiet` スクリプトを追加

#### DATABASE_URL 環境変数の設定

- **問題**: 注文履歴ページで `DATABASE_URL` 環境変数が未設定のためエラー発生
- **解決策**: `.env.local` に `DATABASE_URL` を追加（ポート6543、`?pgbouncer=true` 必須）
- **IPv6接続問題**: Supabase が IPv6 アドレスのみを返す場合、Session Pooler の接続文字列を使用

### 修正ファイル

- `scripts/copy-fonts.js` - ロックファイル削除機能を追加
- `scripts/kill-nextjs-quiet.ps1` - 新規作成（Next.jsプロセス終了スクリプト）
- `lib/database/pool.ts` - `DATABASE_URL` がオプショナルに（未設定時は `null` を返す）
- `lib/database/query.ts` - `DATABASE_URL` 未設定時のエラーハンドリング追加
- `package.json` - `kill-nextjs:quiet` スクリプトを追加

### 関連ドキュメント

- [注文履歴締日期間表示とロックファイル問題修正.md](./注文履歴締日期間表示とロックファイル問題修正.md) - 詳細な実装内容とトラブルシューティング
- [環境変数設定手順.md](./環境変数設定手順.md) - DATABASE_URL の設定方法

### 実装内容

#### 1. 締日期間の計算ロジック

- システム設定の`closing_day`を取得
- 現在の日付に基づいて、現在の締日期間と次の締日期間を計算
- 締日期間の計算方法：
  - 月末締め（`closing_day`が`null`）: 月の1日から月末まで
  - 指定日締め（例：10日締め）: 前月の締日+1日から当月の締日まで

#### 2. 注文履歴ページの改善

- サーバーコンポーネント（`app/(user)/orders/page.tsx`）:
  - `searchParams`から期間タイプ（"current"または"next"）を取得（デフォルトは"current"）
  - システム設定から締日を取得
  - 現在の締日期間と次の締日期間を計算
  - 選択された期間に基づいて注文を取得

- クライアントコンポーネント（`components/orders-history-client.tsx`）:
  - 「今月」「来月」の切り替えボタンを表示
  - 選択された期間の注文をフィルタリングして表示
  - 期間のラベルを表示（例：2025年12月11日 ～ 2026年1月10日）
  - 選択された期間の合計金額を表示

#### 3. 新しいAPI

- `GET /api/user/closing-period`: ユーザー向け締日期間取得API（現在未使用、将来の拡張用）

### 修正ファイル

- `app/(user)/orders/page.tsx`:
  - 締日期間計算ロジックを追加
  - `searchParams`を使用して期間切り替えに対応
  - クライアントコンポーネントにデータを渡すように変更

- `components/orders-history-client.tsx`（新規作成）:
  - 「今月」「来月」の切り替えUIを実装
  - 選択された期間の注文をフィルタリングして表示
  - 期間ラベルと合計金額を表示

- `app/api/user/closing-period/route.ts`（新規作成）:
  - ユーザー向け締日期間取得API（将来の拡張用）

### 確認事項

- ✅ 注文履歴ページで、締日期間で区切って注文が表示される
- ✅ 「今月」「来月」の切り替えボタンが表示される
- ✅ デフォルトで「今月」（現在の締日期間）が表示される
- ✅ 期間のラベルが正しく表示される
- ✅ 選択された期間の合計金額が正しく計算される
- ✅ 期間を切り替えたとき、URLが更新される（`?period=current`または`?period=next`）

### 注意事項

- **締日期間の計算**: システム設定の`closing_day`を基準に計算されます。月末締めの場合は`null`、指定日締めの場合は1〜31の数値が設定されます。
- **次の期間の計算**: 次の期間は、現在の期間の終了日の翌日から始まる期間として計算されます。
- **デフォルト表示**: ページを開いたときは、現在の日付が含まれる締日期間（「今月」）がデフォルトで表示されます。

---

## 2026-01-XX（注文履歴ページのフッターメニュー重なり問題修正）

### 問題

- 注文履歴ページで、一番下の注文明細がフッターメニュー（カレンダー、注文履歴、自動注文）の下に隠れてしまう
- 注文明細をスクロールしたとき、一番下の明細がフッターメニューと重なって表示される
- フッターメニューが固定表示（`fixed bottom-0`）のため、コンテンツの下部に十分な余白が確保されていなかった

### 原因

- ユーザー用レイアウト（`app/(user)/layout.tsx`）の`main`タグの`pb-2`（8px）が小さすぎた
- フッターメニューの高さは`h-16`（64px）であるため、8pxの余白では不十分だった
- 注文履歴ページだけでなく、すべてのユーザーページで同様の問題が発生する可能性があった

### 解決策

ユーザー用レイアウトの`main`タグの下部余白を`pb-2`（8px）から`pb-24`（96px）に変更しました。

- フッターメニューの高さ（64px）に加えて、32pxの余白を確保
- すべてのユーザーページ（カレンダー、注文履歴、自動注文設定など）で、フッターメニューとコンテンツが重ならなくなる

#### 修正ファイル

- `app/(user)/layout.tsx`:
  - `main`タグの`pb-2`を`pb-24`に変更

### 確認事項

- ✅ 注文履歴ページで、一番下の注文明細がフッターメニューの上に表示される
- ✅ 注文明細をスクロールしたとき、一番下の明細がフッターメニューと重ならない
- ✅ 他のユーザーページ（カレンダー、自動注文設定など）でも同様に問題が解決される

### 注意事項

- **固定フッターの余白**: 固定位置（`fixed`）のフッターメニューを使用する場合、コンテンツの下部に十分な余白を確保する必要があります。
- **モバイル対応**: フッターメニューの`pb-safe`クラスにより、iOSの安全領域も考慮されています。

---

## 2026-01-XX（注文更新時の制約違反エラー修正）

### 問題

- 同日の注文を取り消したり変更したりを何度か繰り返していると、注文変更時に「duplicate key value violates unique constraint "unique_order_per_day"」というエラーが発生
- HTTPステータス：500 Internal Server Error

### 原因

1. **データベースのUNIQUE制約**:
   - `orders`テーブルには`UNIQUE(user_id, menu_id, order_date, status)`制約が定義されている
   - 同じユーザーが同じ日に同じメニューで同じステータスの注文を複数作成することはできない

2. **注文更新処理の問題**:
   - 注文作成時（POST）では、キャンセル済みの注文を削除してからINSERTする処理が実装されていた
   - しかし、注文更新時（PUT）では、キャンセル済みの注文を削除する処理が**なかった**
   - 同じユーザー・同じ日付・同じメニューでキャンセル済みの注文が残っている状態で更新しようとすると、制約違反が発生する可能性がある

### 解決策

注文更新処理（PUT）で、**更新前にキャンセル済みの注文を削除する処理を追加**しました。

- 更新対象の注文以外で、同じユーザー・同じ日付・同じメニューでキャンセル済みの注文を削除
- トランザクション内で実行されるため、原子性が保証される
- 注文作成処理と同様のロジックを実装

#### 修正ファイル

- `app/api/orders/[id]/route.ts`:
  - 注文更新処理（PUT）に、キャンセル済み注文の削除処理を追加
  - 更新対象の注文以外で、同じユーザー・同じ日付・同じメニューでキャンセル済みの注文を削除

### 確認事項

- ✅ 同日の注文を取り消したり変更したりを繰り返しても、エラーが発生しない
- ✅ 更新対象の注文自体は削除されない
- ✅ トランザクション内で処理が実行されるため、原子性が保証される

### 注意事項

- **キャンセル済み注文の削除**: キャンセル済みの注文は、新しい注文を作成する際や既存の注文を更新する際に自動的に削除されます。これは、データベースの制約違反を防ぐためです。
- **監査ログ**: 削除されたキャンセル済み注文に関する監査ログは、注文作成・更新時の監査ログに記録されます。

### 関連ドキュメント

- [注文更新時の制約違反エラー修正.md](./注文更新時の制約違反エラー修正.md) - 詳細な実装説明

---

## 2026-01-XX（カレンダーページリサイズ問題修正）

### 問題

- 本番環境のみ、カレンダーを表示した瞬間（月を切り替えたタイミング）に、セルや注文可のボタンが大きく表示され、次の瞬間少し小さくリサイズされている感じの挙動が発生
- ローカル環境では問題なく動作していたが、本番環境でのみ発生

### 原因

1. **空のカレンダーと実際のカレンダーでスタイルが異なる**:
   - 空のカレンダー（`isMounted`が`false`の間）にはpaddingがなく、実際のカレンダーには`p-1.5 sm:p-2 md:p-2`のpaddingがある
   - これにより、空のカレンダーから実際のカレンダーに切り替わる際に、レイアウトが再計算され、リサイズが発生していた

2. **`isMounted`更新タイミングの問題**:
   - `isMounted`が`false`から`true`に変わる際に、即座にレンダリングが切り替わり、レイアウトの再計算が発生していた
   - ブラウザのレンダリングサイクルと同期していないため、ちらつきが発生していた

### 解決策

#### 1. 空のカレンダーにpaddingを追加

- 空のカレンダーと実際のカレンダーで同じスタイルを使用するように修正
- 空のカレンダーのセルにも`p-1.5 sm:p-2 md:p-2`のpaddingを追加

#### 2. `requestAnimationFrame`で`isMounted`更新を遅延

- `isMounted`が`false`から`true`に変わる際に、`requestAnimationFrame`を使用して次のフレームで`setIsMounted(true)`を呼び出すように変更
- これにより、ブラウザのレンダリングサイクルと同期し、レイアウトの再計算を防ぐ

#### 修正ファイル

- `components/calendar-grid.tsx`:
  - 空のカレンダーのセルに`p-1.5 sm:p-2 md:p-2`のpaddingを追加
  - `useEffect`内で`setIsMounted(true)`を`requestAnimationFrame`でラップ

### 確認事項

- ✅ 本番環境で、月を切り替えた際にリサイズが発生しない
- ✅ 空のカレンダーと実際のカレンダーで同じスタイルが適用される
- ✅ レイアウトの再計算が発生しない

### 注意事項

- **`requestAnimationFrame`の使用**: ブラウザのレンダリングサイクルと同期することで、レイアウトの再計算を防ぐことができます
- **スタイルの統一**: 空のカレンダーと実際のカレンダーで同じスタイルを使用することで、レイアウトシフトを防ぐことができます

---

## 2026-01-XX（新規注文画面に締切時間表示機能追加）

### 追加機能

- 新規注文画面（`/orders/new`）に、その日のお弁当の締切時間を表示
- 注文者が締切時間を確認できるように改善
- すべての日付で締切時間を表示（以前は今日のみ表示していた）

### 実装内容

- `app/(user)/orders/new/page.tsx`:
  - ヘッダー部分で、`deadline_time`が存在する場合は常に表示
  - 表示テキストを「締切:」から「締切時間:」に変更してより明確に
  - `font-medium`を追加して視認性を向上

### 修正ファイル

- `app/(user)/orders/new/page.tsx`:
  - `isToday`の条件を削除し、すべての日付で締切時間を表示
  - 表示テキストを「締切時間:」に変更
  - `font-medium`を追加

### 確認事項

- ✅ 新規注文画面で、すべての日付の締切時間が表示される
- ✅ 締切時間が存在しない日付では表示されない
- ✅ 表示テキストが「締切時間:」になっている

---

## 2026-01-XX（カレンダーページ13日セル表示問題とHydration Mismatch再発修正）

### 問題

1. **13日のセルがグレーアウトされる問題**:
   - 本日は1月9日で、まだ締切日時がきていない12日、14日の注文は注文変更ができる
   - しかし、13日は注文変更ができない（グレーアウトして変更可が非表示）
   - ローカル環境では正しく表示されているが、本番環境では表示されない

2. **React error #418（Hydration Mismatch）の再発**:
   - カレンダーページでReact error #418が再発
   - サーバー側とクライアント側で生成されるHTMLが一致しない

### 原因

1. **13日のセルがグレーアウトされる問題の原因**:
   - 本番環境では`order.order_date`がDateオブジェクトとして取得されていた
   - `String(order.order_date)`が`"Tue Jan 13 2026 09:00:00 GMT+0900 (日本標準時)"`のような形式になり、`split('T')[0].split(' ')[0]`で`"Tue"`になっていた
   - その結果、`orderDateStr`が`"Tue"`になり、`todayStr`（`"2026-01-09"`）と比較して`"Tue" < "2026-01-09"`が`true`になり、`canEditOrderValue`が`false`になっていた
   - ローカル環境では`order.order_date`が文字列として取得されていたため、問題が発生していなかった

2. **React error #418の再発の原因**:
   - `useState`の初期値で`localStorage`にアクセスしていたため、サーバー側（`localStorage`が存在しない）とクライアント側（`localStorage`から値を取得できる）で初期HTMLが異なっていた
   - これにより、hydration mismatchが発生していた

### 解決策

#### 1. 13日のセルがグレーアウトされる問題の解決策

- `order.order_date`がDateオブジェクトの場合、`getFullYear()`、`getMonth()`、`getDate()`を使用して`YYYY-MM-DD`形式に変換
- 文字列の場合は既存の処理を維持
- その他の場合は一度Dateオブジェクトに変換してから`YYYY-MM-DD`形式に変換
- TypeScriptの型エラーを回避するため、型アサーションを使用して`string | Date`として扱う

#### 2. React error #418の再発の解決策

- `useState`の初期値を`null`に統一（サーバー側とクライアント側で同じ初期HTMLを生成）
- `localStorage`からの復元は`useEffect`内でのみ実行

#### 修正ファイル

- `components/calendar-grid.tsx`:
  - `order.order_date`がDateオブジェクトの場合の処理を追加
  - `useState`の初期値から`localStorage`へのアクセスを削除
  - 型アサーションを使用して`instanceof Date`チェックを可能に

### 確認事項

- ✅ 13日のセルが正しく表示される（`orderDateStr`が`"2026-01-13"`になり、`canEditOrderValue`が`true`になる）
- ✅ React error #418が解消される
- ✅ 12日、13日、14日の注文が正しく変更可能になる

### 注意事項

- **環境による型の違い**: 本番環境とローカル環境で`order.order_date`の型が異なる可能性があるため、両方のケースに対応する必要があります
- **型アサーションの使用**: TypeScriptの型定義では`order.order_date`が`string`として定義されているため、実行時にDateオブジェクトになる可能性がある場合は、型アサーションを使用する必要があります
- **Hydration Mismatchの防止**: `useState`の初期値でブラウザAPI（`localStorage`など）にアクセスしないようにすることで、サーバー側とクライアント側で同じ初期HTMLを生成できます

---

## 2026-01-XX（カレンダーページ過去注文・ちらつき問題修正）

### 問題

1. **過去の注文がクリックできる問題**:
   - 締切時間を過ぎた過去の注文（1月4日、1月5日、1月9日など）をクリックできてしまう
   - クリックすると一瞬画面が切り替わり、元に戻る不具合
   - ただし、1月6日の注文のみグレーアウトされており、クリックできない状態になっていた
   - その他の過去の注文は「変更可」と表示され、グレーになっておらず、クリックできてしまう

2. **月変更時の画面ちらつき**:
   - 月を変更すると一度カレンダーが非表示になり、再表示してリサイズしているような挙動
   - カレンダーが一瞬消えてから表示されるため、ユーザー体験が悪い

### 原因

1. **過去の注文がクリックできる問題の原因**:
   - `CalendarCell`コンポーネント内（行726）で、既に削除された`canEditOrder()`関数を呼び出していた
   - `shouldBeGray: true`（グレーアウトすべき）と計算されているが、`canEdit`が`true`のためリンクが表示されていた
   - `CalendarGrid`で計算した`canEditOrderValue`が`CalendarCell`にpropsとして渡されていたが、`CalendarCell`内で別途`canEditOrder()`を呼び出していたため、正しい値が使われていなかった

2. **月変更時のちらつきの原因**:
   - 年月が変更されると、親コンポーネントがサーバー側で再レンダリングされ、`CalendarGrid`コンポーネントも新しいインスタンスが作成される
   - コンポーネントが再マウントされると、`useState`の値（`today`、`now`、`isMounted`）がリセットされる
   - `useEffect`が実行されるまで`isMounted`が`false`のままのため、空のカレンダーが表示される

### 解決策

#### 1. 過去の注文がクリックできる問題の解決策

- `CalendarCell`コンポーネント内の削除済み`canEditOrder()`呼び出しを削除
- `shouldBeGray`と`canEditOrderValue`を直接チェックするように変更
- `shouldBeGray`が`true`の場合は`canEdit`を`false`にする

#### 2. 月変更時のちらつきの解決策

- `localStorage`から初期値を復元する処理を追加
- `getInitialToday()`と`getInitialNow()`関数を作成し、`useState`の初期値を`localStorage`から取得
- `useEffect`内で`today`と`now`を`localStorage`に保存
- 年月が変更されたときに、`localStorage`から値を復元する処理を追加

#### 修正ファイル

- `components/calendar-grid.tsx`:
  - `CalendarCell`内の削除済み`canEditOrder()`呼び出しを削除
  - `shouldBeGray`と`canEditOrderValue`を直接チェックするように変更
  - `localStorage`から初期値を復元する処理を追加
  - `localStorage`への値の保存処理を追加
  - 年月変更時の値復元処理を追加

### 確認事項

- ✅ 過去の注文（1月4日、1月5日、1月9日など）がグレーアウトされている
- ✅ 過去の注文をクリックできない（アラートが表示される）
- ✅ 月を変更したときに、カレンダーがちらつかない
- ✅ `localStorage`から値を復元できている
- ✅ `isMounted`が`true`になり、空のカレンダーが表示されない

### 注意事項

- **`localStorage`の使用**: `localStorage`はすべてのモダンブラウザでサポートされていますが、プライベートモードでは使用できない場合があります。エラーハンドリングを適切に行う必要があります
- **データの有効期限**: 保存された値が今日の日付でない場合（1日以上古い場合）は、新規作成するようにしています
- **コンポーネントの再マウント**: Next.js App Routerでは、URLパラメータが変更されるとサーバー側で再レンダリングされるため、クライアントコンポーネントも再マウントされます。`localStorage`を使用することで、状態を保持できます

---

## 2026-01-XX（カレンダーページの全日付グレーアウト問題修正）

### 問題

- カレンダーページのHydration Mismatchエラー修正後、本番環境でカレンダーが正常に表示されるようになったが、すべての日付がグレーアウトしており、注文ボタンが表示されない
- 注文可能日（16日まで）でも注文ボタンが表示されない
- コンソールログで`hasOrderDay: false`、`isAvailable: false`が確認される

### 原因

1. **`orderDaysMap`にデータが入っていない**: サーバー側で取得した`orderDays`データが`orderDaysMapObj`に正しくマッピングされていない
2. **`target_date`のフォーマット不一致**: データベースから取得した`target_date`の形式（Dateオブジェクト、タイムスタンプ付き文字列など）と、カレンダーグリッドで使用する`YYYY-MM-DD`形式が一致していなかった
3. **キーマッピングの失敗**: `orderDaysMapObj`の作成時に、`target_date`をそのままキーとして使用していたため、フォーマットが異なる場合にマッピングが失敗していた

### 解決策

#### 1. `target_date`のフォーマット正規化

- `app/(user)/calendar/page.tsx`: `orderDaysMapObj`作成時に、`target_date`を`YYYY-MM-DD`形式に正規化する処理を追加
- Dateオブジェクト、タイムスタンプ付き文字列、その他の形式に対応

#### 2. デバッグログの追加

- サーバー側のデータ取得状況を確認するログを追加
- `orderDays`の取得数、サンプルデータ、`orderDaysMapObj`のキー形式を確認できるように

#### 修正ファイル

- `app/(user)/calendar/page.tsx`:
  - `orderDaysMapObj`作成時の`target_date`フォーマット正規化処理を追加
  - サーバー側データ取得のデバッグログを追加
  - 日付範囲計算のログを追加

### 確認事項

- ✅ 本番環境でカレンダーページが正常に表示される
- ✅ 注文可能日に注文ボタンが表示される
- ✅ `orderDaysMap`にデータが正しく入る
- ✅ `target_date`のフォーマットが`YYYY-MM-DD`形式で統一される

### 注意事項

- **日付フォーマットの統一**: データベースから取得した日付データは、形式が異なる可能性があるため、使用前に`YYYY-MM-DD`形式に正規化する必要があります
- **キーマッピングの重要性**: マップ型のデータ構造を使用する場合、キーの形式が一致していることが重要です。フォーマット不一致は、データが正しく取得できない原因になります

---

## 2026-01-XX（カレンダーページのHydration Mismatchエラー修正）

### 問題

- 注文カレンダーがローカル環境では正常に動作するが、デプロイした本番環境では正しく動かない
- コンソールにReact error #418（hydration mismatch）エラーが発生
- エラーメッセージ: `Uncaught Error: Minified React error #418`

### 原因

1. **サーバーとクライアントでの日付計算の不一致**: `CalendarGrid`コンポーネント内で`new Date()`を直接使用していたため、サーバー側（UTC）とクライアント側（ローカルタイムゾーン）で異なる日付が計算されていた
2. **Hydration Mismatch**: サーバー側で生成されたHTMLとクライアント側で生成されたHTMLが一致せず、Reactのhydration処理でエラーが発生
3. **タイムゾーンの違い**: サーバー側はUTC、クライアント側はJST（またはユーザーのローカルタイムゾーン）で実行されるため、`new Date()`の結果が異なる

### 解決策

#### 1. クライアント側でのみ日付を計算

- `components/calendar-grid.tsx`: `useState`と`useEffect`を使用して、クライアント側でのみ`today`と`now`を計算するように変更
- サーバー側レンダリング時は`null`を返し、クライアント側でマウント後に日付を設定

#### 2. サーバー側レンダリング時のフォールバック

- `isMounted`フラグを使用して、クライアント側でマウントされるまで空のカレンダーを表示
- これにより、サーバーとクライアントで同じHTMLが生成され、hydration mismatchを防止

#### 3. CalendarCellコンポーネントへのprops追加

- `today`と`now`をpropsとして渡すように変更
- `CalendarCell`内の`new Date()`呼び出しを削除し、propsから受け取るように変更

#### 4. nullチェックの追加

- `canOrder`関数内で`now`を使用する際のnullチェックを追加

#### 修正ファイル

- `components/calendar-grid.tsx`:
  - `useState`と`useEffect`を使用してクライアント側でのみ日付を計算
  - サーバー側レンダリング時のフォールバック処理を追加
  - `CalendarCell`コンポーネントに`today`と`now`をpropsとして渡すように変更
  - `CalendarCell`内の`new Date()`呼び出しを削除

### 確認事項

- ✅ カレンダーページが正常に表示される（ローカル環境・本番環境）
- ✅ React error #418（hydration mismatch）エラーが解消される
- ✅ サーバーとクライアントで同じHTMLが生成される
- ✅ 日付計算がクライアント側のタイムゾーンで正しく実行される

### 注意事項

- **Hydration Mismatchの防止**: サーバーとクライアントで異なる結果を返す可能性がある処理（`new Date()`など）は、クライアント側でのみ実行する必要があります
- **useEffectの使用**: クライアント側でのみ実行する処理は`useEffect`内で実行し、`isMounted`フラグで制御します
- **フォールバックUI**: サーバー側レンダリング時は、クライアント側でマウントされるまで空の状態を表示することで、hydration mismatchを防止します

---

## 2026-01-XX（カレンダーページのMap型シリアライズ問題とビルドエラー修正）

### 問題

- カレンダーページが動かなくなってしまった
- タップもできないし、注文可能日の注文ボタンも表示されない
- 唯一表示月の表示のみ変更できる
- ローカルでは動くが、デプロイした本番環境では動かない
- ビルド時にTypeScript型エラーが発生
- `useSearchParams()`がSuspenseバウンダリでラップされていないエラー

### 原因

1. **Map型のシリアライズ問題**: Next.jsでは、サーバーコンポーネントからクライアントコンポーネントに渡すpropsはシリアライズ可能である必要があります。`Map`型はシリアライズできないため、クライアントコンポーネントに正しく渡されていませんでした。
2. **TypeScript型推論エラー**: `targetProfileResult.data`の型が正しく推論されず、`never`型として推論されていました。
3. **useSearchParams Suspenseバウンダリ**: Next.js 16では、`useSearchParams()`を使用するコンポーネントは`Suspense`バウンダリでラップする必要があります。

### 解決策

#### 1. Map型をオブジェクトに変換

- `app/(user)/calendar/page.tsx`: `Map`型を通常のオブジェクト（`Record<string, T>`）に変換
- `components/calendar-grid.tsx`: `Map`型とオブジェクト型の両方に対応するようにアクセス方法を修正
- オブジェクトアクセスの安全化: try-catchでエラーハンドリングを追加

#### 2. TypeScript型エラーの修正

- `app/(user)/calendar/page.tsx`: `targetProfileResult`の型を明示的に指定
- 型アサーションを使用して、`{ data: { id: string; full_name: string; is_active: boolean } | null; error: any }`の型を明示

#### 3. useSearchParams Suspenseバウンダリの対応

- `app/(auth)/login/page.tsx`: `useSearchParams()`を使用するコンポーネント（`LoginPageContent`）を`Suspense`でラップ
- フォールバックUIを追加（「読み込み中...」表示）

#### 4. エラーハンドリングとログの追加

- `components/calendar-grid.tsx`: 本番環境でも動作するデバッグログを追加
- オブジェクトアクセス時のエラーハンドリングを強化
- ブラウザのコンソールに詳細なログを出力

#### 修正ファイル

- `app/(user)/calendar/page.tsx`:
  - `Map`型を`Record<string, T>`型に変換
  - `targetProfileResult`の型を明示的に指定
- `components/calendar-grid.tsx`:
  - `Map`型とオブジェクト型の両方に対応するアクセス方法を実装
  - エラーハンドリングとログを追加
- `app/(auth)/login/page.tsx`:
  - `useSearchParams()`を使用するコンポーネントを`Suspense`でラップ
  - `LoginPageContent`コンポーネントに分離

### 確認事項

- ✅ カレンダーページが正常に表示される
- ✅ 注文可能日の「注文可」ボタンが表示される
- ✅ 「注文可」ボタンをクリックして注文ページに遷移できる
- ✅ ビルドが成功する（TypeScriptエラーなし）
- ✅ 本番環境でも正常に動作する
- ✅ ログインページが正常に表示される（Suspenseバウンダリ対応）

### 注意事項

- **Next.jsのシリアライズ制限**: サーバーコンポーネントからクライアントコンポーネントに渡すpropsは、JSONシリアライズ可能である必要があります（`Map`型、`Set`型、関数などは渡せません）
- **useSearchParams Suspense要件**: Next.js 16では、`useSearchParams()`を使用するコンポーネントは必ず`Suspense`バウンダリでラップする必要があります
- **デバッグログ**: 本番環境でもデバッグログが出力されるため、必要に応じて削除または条件付きにしてください

---

## 2026-01-XX（カレンダーページのDATABASE_URL未設定時のフォールバック対応）

### 問題

- カレンダーページが動かなくなってしまった
- `DATABASE_URL`環境変数が設定されていない場合、`queryDatabase`関数がエラーを投げてカレンダーページが表示できない

### 原因

- `lib/utils/database.ts`の`getDatabaseUrl()`関数が、`DATABASE_URL`環境変数が設定されていない場合にエラーを投げる
- カレンダーページ（`app/(user)/calendar/page.tsx`）で`queryDatabase`を使用しており、`DATABASE_URL`が設定されていない場合にエラーが発生
- Transaction connection (6543)はオプション機能だが、フォールバック処理が実装されていなかった

### 解決策

`DATABASE_URL`環境変数が設定されていない場合でも、通常のSupabaseクライアントを使用してカレンダーページが動作するようにフォールバック処理を追加しました。

#### 1. プロフィール取得のフォールバック処理

- `DATABASE_URL`が設定されている場合: Transaction connectionを使用してプロフィールを取得
- `DATABASE_URL`が設定されていない場合: Supabaseクライアントを使用してプロフィールを取得
- 管理者権限チェックと対象ユーザーの判定を、どちらの場合でも正しく実行

#### 2. カレンダー・注文データ取得のフォールバック処理

- `DATABASE_URL`が設定されている場合: Transaction connectionを使用してカレンダー・注文データを取得
- `DATABASE_URL`が設定されていない場合: Supabaseクライアントを使用してカレンダー・注文データを取得
- 管理者モードの場合も正しく動作（対象ユーザーの注文を取得）

#### 3. メニューデータ取得のフォールバック処理

- `DATABASE_URL`が設定されている場合: Transaction connectionを使用してメニュー・業者情報を取得
- `DATABASE_URL`が設定されていない場合: Supabaseクライアントを使用してメニュー・業者情報を取得
- `BigInt`ではなく文字列配列を使用（Supabaseクライアントの互換性のため）

#### 4. 実装詳細

- `getDatabaseUrlOptional()`関数を使用して、`DATABASE_URL`が設定されているかチェック
- 三項演算子を使用して、設定されている場合とされていない場合で処理を分岐
- フォールバック処理内でも、管理者モードの判定を正しく実行（`targetUserId`を計算してから注文データを取得）

#### 修正ファイル

- `app/(user)/calendar/page.tsx`:
  - `getDatabaseUrlOptional`をインポート
  - `hasDatabaseUrl`変数を追加（`DATABASE_URL`の設定チェック）
  - プロフィール取得処理にフォールバックを追加
  - カレンダー・注文データ取得処理にフォールバックを追加
  - メニューデータ取得処理にフォールバックを追加
  - 管理者モードの判定をフォールバック処理内でも実行

### 確認事項

- ✅ `DATABASE_URL`が設定されていない場合でもカレンダーページが表示される
- ✅ 注文データが正しく表示される
- ✅ 管理者モードが正しく動作する
- ✅ 通常のSupabaseクライアントを使用してもパフォーマンスに大きな影響がない
- ✅ `DATABASE_URL`が設定されている場合は、Transaction connection (6543)を使用してパフォーマンスが向上する

### 注意事項

- **Transaction connection (6543)の推奨**: `DATABASE_URL`を設定すると、Transaction connection (6543)を使用してパフォーマンスが向上します
- **設定方法**: `env.example`を参照して、`DATABASE_URL`環境変数を設定してください
- **フォールバック動作**: `DATABASE_URL`が設定されていない場合でも、通常のSupabaseクライアントを使用して正常に動作します

---

## 2026-01-XX（パスワードリセット機能の実装とフッターの変更）

### パスワードリセット機能の実装

#### 問題

- パスワードリセットメールが届き、リンクをクリックしても、ログイン画面にリダイレクトされるだけでパスワードのリセットができない
- メール内のリンクから新しいパスワードを設定する機能が実装されていなかった

#### 解決策

Supabaseのパスワードリセットフローに従って、メール内のリンクから新しいパスワードを設定する機能を実装しました。

1. **URLハッシュからのトークン検出**
   - Supabaseのパスワードリセットリンクは、URLハッシュに`#access_token=...&type=recovery`を含みます
   - `useEffect`フックを使用して、ページ読み込み時にURLハッシュをチェック
   - `type=recovery`と`access_token`が存在する場合、パスワード更新モードに切り替え

2. **パスワード更新フォームの追加**
   - 新しいパスワード入力欄（6文字以上）
   - パスワード確認入力欄
   - バリデーション（パスワードとパスワード確認の一致確認）
   - エラーメッセージの日本語化

3. **パスワード更新処理**
   - `supabase.auth.updateUser({ password: newPassword })`でパスワードを更新
   - 更新成功後、成功メッセージを表示
   - 3秒後にログイン画面に自動リダイレクト

#### 修正ファイル

- `app/(auth)/login/page.tsx`: パスワードリセット機能の実装
  - `useSearchParams`と`useEffect`をインポート
  - `newPassword`、`confirmPassword`、`isUpdatePassword`ステートを追加
  - URLハッシュからトークンを検出する`useEffect`フックを追加
  - `handleUpdatePassword`関数を追加
  - パスワード更新フォームを追加
  - パスワード更新モードの表示制御を追加

### フッターの変更

#### 実装内容

- フッターのテキストを「© 2026 お弁当注文システム」から「© 2026 MACHIDA GEAR」に変更
- タイトル（「お弁当注文システム」）は変更なし

#### 修正ファイル

- `app/(auth)/login/page.tsx`: フッターのテキストを変更

### 確認事項

- ✅ パスワードリセットメールが正しく送信される
- ✅ メール内のリンクをクリックすると、パスワード更新フォームが表示される
- ✅ 新しいパスワードとパスワード確認を入力してパスワードを更新できる
- ✅ パスワードは6文字以上で入力される必要がある
- ✅ パスワードとパスワード確認が一致しない場合はエラーが表示される
- ✅ パスワード更新成功後、ログイン画面に自動リダイレクトされる
- ✅ エラーメッセージが日本語で表示される
- ✅ フッターが「© 2026 MACHIDA GEAR」に変更されている

### Supabaseメールテンプレートの設定方法

#### 実装内容

Supabaseのメールテンプレートでは、`{{ .ConfirmationURL }}`という変数が使用されます。この変数は**自動的に生成される**ため、手動で設定する必要はありません。

#### メールテンプレートの設定

1. **Supabase Dashboardでの確認・編集**
   - Supabase Dashboard > Authentication > Email Templates > Reset Password
   - テンプレート例: `<p><a href="{{ .ConfirmationURL }}">お弁当注文システムのパスワードをリセット</a></p>`
   - `{{ .ConfirmationURL }}`はそのまま使用（変更不要）

2. **必要な設定**
   - Supabase Dashboard > Authentication > URL Configuration:
     - **Site URL**: 本番環境のURL（例: `https://bento-order-app-blond.vercel.app`）
     - **Redirect URLs**: 本番環境のURLを追加（例: `https://bento-order-app-blond.vercel.app/**`）
   - 環境変数: `NEXT_PUBLIC_SITE_URL`を本番環境のURLに設定

3. **動作の仕組み**
   - コード側（`app/(auth)/login/page.tsx`）で`redirectTo`パラメータを指定
   - Supabaseが`{{ .ConfirmationURL }}`を自動生成（`https://[PROJECT-ID].supabase.co/auth/v1/verify?token=...&type=recovery&redirect_to=[redirectUrl]`の形式）
   - メール内のリンクに`{{ .ConfirmationURL }}`が含まれる
   - ユーザーがリンクをクリックすると、Supabaseの認証サーバーでトークンを検証後、`/login?reset=true`にリダイレクト

#### 修正ファイル

- `docs/パスワードリセット機能の実装.md`: メールテンプレート設定方法を追加
- `docs/環境変数設定手順.md`: Supabaseメールテンプレート設定方法を追加

### ドキュメントの追加

- `docs/パスワードリセット機能の実装.md`: 実装内容の詳細を記録（メールテンプレート設定方法を含む）

---

## 2026-01-XX（型エラー修正と招待コード使用回数リセット機能の修正）

### 問題

- Vercelデプロイ時にTypeScriptの型エラーが発生してビルドが失敗する
- 招待コード管理画面でリセットボタンを押しても使用回数がリセットされない

### 原因

1. **型エラーの原因**
   - `app/(user)/calendar/page.tsx`: `calendarError` と `ordersError` が常に `null` として定義されており、TypeScriptが型推論で `never` 型として判定
   - `app/api/auth/signup/route.ts`: `authError` の重複チェックがあり、型推論で問題が発生

2. **招待コードリセット機能の原因**
   - API側で招待コードが**変更された場合のみ**使用回数をリセットする仕様になっていた
   - リセットボタンは現在のコードをそのまま送信するため、変更がないと判定されてリセットされなかった

### 解決策

#### 1. 型エラーの修正

- **`app/(user)/calendar/page.tsx`**: `queryDatabase` の戻り値の型を明示的に定義（`Error | null`）
- **`app/(user)/calendar/page.tsx`**: エラーメッセージ表示時に型アサーションを使用
- **`app/api/auth/signup/route.ts`**: 冗長な `authError` チェック（149-152行目）を削除

#### 2. 招待コード使用回数リセット機能の修正

- **`app/api/admin/invitation-code/route.ts`**: `reset_usage_count` パラメータを追加
- **`app/api/admin/invitation-code/route.ts`**: `reset_usage_count === true` の場合、招待コードが変更されていなくても使用回数をリセット
- **`app/admin/invitation-code/page.tsx`**: リセットボタン押下時に `reset_usage_count: true` をリクエストに含める

### 修正ファイル

- `app/(user)/calendar/page.tsx`: 型定義の明示化
- `app/api/auth/signup/route.ts`: 冗長なエラーチェックの削除
- `app/admin/invitation-code/page.tsx`: リセットリクエストの修正
- `app/api/admin/invitation-code/route.ts`: `reset_usage_count` パラメータの追加

### 確認事項

- ✅ TypeScriptのビルドが成功する
- ✅ 招待コード使用回数のリセットボタンが正常に動作する
- ✅ デプロイが正常に完了する

---

## 2026-01-XX（新規ユーザー登録時のメッセージ改善とaudit_logs.actor_id外部キー制約修正）

### 新規ユーザー登録時のメッセージ改善

#### 問題

- 新規ユーザー登録時に「管理者の承認をお待ちください」というメッセージが表示されるが、メール確認が必要であることが明示されていない
- ユーザーがメール内のリンクをクリックして確認する必要があることが伝わらない

#### 解決策

- 登録完了メッセージに「確認メールを送信しましたので、メール内のリンクをクリックしてメールアドレスの確認を完了してください」という文言を追加
- メール確認 → 管理者承認の順序を明確に表示

#### 修正ファイル

- `app/(auth)/login/page.tsx`: 登録完了メッセージの改善
- `app/api/auth/signup/route.ts`: APIレスポンスメッセージの改善

### audit_logs.actor_id 外部キー制約修正：ユーザー削除時の監査ログ保持

### 問題

- Supabase Authユーザー削除時に「Failed to delete selected users: Database error deleting user」エラーが発生
- 監査ログが残っているユーザーを削除できない

### 原因

- `audit_logs.actor_id` が `auth.users(id)` を参照している外部キー制約が `ON DELETE RESTRICT`（デフォルト）になっていた
- 監査ログが残っているユーザーを削除しようとすると、データベースが削除を拒否していた

### 解決策

外部キー制約を `ON DELETE SET NULL` に変更することで、ユーザー削除時に：
- 監査ログは**削除されない**（保持される）
- `actor_id` は自動的に **NULL** になる
- ユーザー削除時にエラーが発生しない

### 実装内容

1. **マイグレーションファイルの作成**
   - `064_check_audit_logs_fk_before_migration.sql`: 実行前の確認SQL
   - `064_fix_audit_logs_actor_id_fk_set_null.sql`: メインのマイグレーションSQL
   - `064_verify_audit_logs_fk_after_migration.sql`: 実行後の確認SQL
   - `064_README_audit_logs_fk_fix.md`: 実行手順ドキュメント

2. **技術的な修正**
   - 外部キー制約の自動検出機能
   - `actor_id` カラムを NULL 許可に変更（必要なら）
   - 外部キー制約を `ON DELETE SET NULL` に変更
   - 型エラーの修正（`conkey::int[]` → `conkey`）

### マイグレーションファイル

- `supabase/migrations/064_check_audit_logs_fk_before_migration.sql`: 実行前の確認SQL
- `supabase/migrations/064_fix_audit_logs_actor_id_fk_set_null.sql`: メインのマイグレーションSQL
- `supabase/migrations/064_verify_audit_logs_fk_after_migration.sql`: 実行後の確認SQL
- `supabase/migrations/064_README_audit_logs_fk_fix.md`: 実行手順ドキュメント

### 確認事項

- ✅ 外部キー制約が `ON DELETE SET NULL` になっている
- ✅ `actor_id` カラムが NULL 許可になっている
- ✅ 整合性チェックで問題がない（孤児レコードがない）

### ドキュメントの追加

- `docs/audit_logs外部キー制約修正_ユーザー削除時の監査ログ保持.md`: 実装内容の詳細を記録

---

## 2026-01-XX（メール確認URLの問題修正とエラーメッセージ改善）

### 問題

- 新規ユーザー登録時に送信されるメール内のリンクがローカルアドレス（`http://localhost:3000`）になってしまう
- メール確認前のログインができない（Supabase Authのデフォルト動作）
- メール確認URLが正しく本番環境のURLにならない

### 原因

1. **環境変数の未設定**: `NEXT_PUBLIC_SITE_URL`がVercelで設定されていない、または誤った値が設定されていた
2. **Supabase Dashboardの設定不備**: Site URLが本番環境のURLに設定されていない
3. **フォールバックロジックの問題**: `request.nextUrl.origin`を使用していたため、サーバーサイドで実行時にリクエストのオリジンがローカルになる可能性があった
4. **エラーメッセージの不明確さ**: メール確認が必要であることが明確に伝わっていなかった

### 解決策

#### 1. メール確認URL生成ロジックの改善

- `app/api/auth/signup/route.ts`を修正
- `NEXT_PUBLIC_SITE_URL`が設定されていない場合に警告ログを出力
- メール確認URLの生成を明確化（`NEXT_PUBLIC_SITE_URL`を優先、未設定時はフォールバック）

#### 2. エラーメッセージの改善

- `app/(auth)/login/page.tsx`のエラーメッセージを改善
- 「メールアドレスが確認されていません」というエラーメッセージに、メール確認の方法を追加
- メール内のリンクをクリックして確認する必要があることを明記

#### 3. ドキュメントの更新

- `docs/環境変数設定手順.md`に以下を追加：
  - Supabase Dashboardの設定手順（Site URL、Redirect URLs）
  - メール確認前のログインについての説明
  - メール確認を無効化する方法（開発環境のみ）

### 修正ファイル

- `app/api/auth/signup/route.ts`: メール確認URL生成ロジックの改善、警告ログの追加
- `app/(auth)/login/page.tsx`: エラーメッセージの改善（メール確認方法の明記）
- `docs/環境変数設定手順.md`: Supabase Dashboardの設定手順追加、メール確認についての説明追加

### 設定手順

#### Vercelの環境変数設定

```
NEXT_PUBLIC_SITE_URL=https://bento-order-app-blond.vercel.app
```

設定後、必ず再デプロイしてください。

#### Supabase Dashboardの設定

1. Supabase Dashboardにログイン
2. 左メニューから「Authentication」を選択
3. 「URL Configuration」セクションを開く
4. 「Site URL」を本番環境のURLに設定（例: `https://bento-order-app-blond.vercel.app`）
5. 「Redirect URLs」に本番環境のURLを追加（例: `https://bento-order-app-blond.vercel.app/**`）
6. 設定を保存

### メール確認前のログインについて

**重要**: Supabase Authのデフォルト動作では、メール確認が必要です。

- メール確認前はログインできません（これは仕様です）
- 登録時に送信されたメール内のリンクをクリックしてメールアドレスを確認してください
- メール確認後、ログインできるようになります
- 開発環境でメール確認を無効化したい場合は、Supabase Dashboard > Authentication > Settings > 「Enable email confirmations」のチェックを外す（本番環境では推奨しません）

### 確認事項

- ✅ Vercelの環境変数で`NEXT_PUBLIC_SITE_URL`が設定されているか
- ✅ Supabase Dashboardの「Site URL」が本番環境のURLに設定されているか
- ✅ Supabase Dashboardの「Redirect URLs」に本番環境のURLが追加されているか
- ✅ 環境変数変更後、Vercelで再デプロイしたか

### 注意事項

- `NEXT_PUBLIC_`プレフィックスが付いた環境変数はブラウザに公開されるため、Vercelで警告アイコンが表示されますが、`NEXT_PUBLIC_SITE_URL`は公開サイトのURLなので問題ありません
- 機密情報（`SUPABASE_SERVICE_ROLE_KEY`、`AUTO_ORDER_SECRET`など）には`NEXT_PUBLIC_`プレフィックスを付けないでください

---

## 2026-01-XX（Transaction接続対応：注文機能の最適化）

### 実装内容

Transaction connection (6543)を使用して、注文関連の機能を最適化しました。複数のクエリを同じ接続で実行することで、パフォーマンスが向上し、トランザクション保証によりデータ整合性が確保されます。

### 対応した機能

1. **注文カレンダー** (`app/(user)/calendar/page.tsx`)
   - プロフィール取得、カレンダーデータ取得、注文データ取得、システム設定取得を`queryDatabase`で統合
   - メニュー・業者情報の取得も`queryDatabase`を使用（JOINで効率化）

2. **新規注文API** (`app/api/orders/route.ts`)
   - プロフィール取得、システム設定・カレンダー情報取得を`transaction`で統合
   - 注文作成処理全体を`transaction`で実行（既存注文チェック、キャンセル済み注文削除、メニュー確認、価格取得、注文作成、監査ログ記録）

3. **注文変更API** (`app/api/orders/[id]/route.ts`)
   - PUT（更新）とPATCH（キャンセル）の両方を`transaction`に対応
   - プロフィール取得、注文確認、カレンダー情報取得、更新/キャンセル処理、監査ログ記録を`transaction`で統合

4. **注文履歴画面** (`app/(user)/orders/page.tsx`)
   - 注文データとカレンダー情報を`queryDatabase`で統合
   - JOINを使用して、`menu_items`と`vendors`の情報を一度のクエリで取得

### 改善点

- **パフォーマンス向上**: 複数のクエリを1つの接続で実行し、接続確立のオーバーヘッドを削減
- **トランザクション保証**: 注文作成・更新・キャンセル処理をトランザクション内で実行し、データ整合性を確保
- **JOINクエリの最適化**: SQL JOINを使用して、Supabaseのネストしたクエリと同等のデータを効率的に取得
- **エラーハンドリング**: 適切なステータスコードとエラーメッセージを返却

### 修正ファイル

- `app/(user)/calendar/page.tsx`: Transaction connection対応
- `app/api/orders/route.ts`: Transaction connection対応（トランザクション使用）
- `app/api/orders/[id]/route.ts`: Transaction connection対応（トランザクション使用）
- `app/(user)/orders/page.tsx`: Transaction connection対応

### 確認事項

- ✅ 注文カレンダーが正常に表示される
- ✅ 新規注文が正常に作成される
- ✅ 注文変更が正常に動作する
- ✅ 注文キャンセルが正常に動作する
- ✅ 注文履歴が正常に表示される
- ✅ トランザクション保証により、データ整合性が確保される

### ドキュメントの追加

- `docs/Transaction接続対応_注文機能の最適化.md`: 実装内容の詳細を記録

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
     [key: string]: any;
   } | null;
   ```

### 結果

- すべての TypeScript 型エラーを解消
- Vercel へのデプロイが成功
- ビルドが正常に完了

> 📖 **詳細**: [Next.js16 型エラー修正と Vercel デプロイ対応.md](./Next.js16型エラー修正とVercelデプロイ対応.md)

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

### ユーザー別合計金額 CSV 出力機能の追加

#### 実装内容

- レポート・CSV 出力画面から、締日期間中のユーザーごとの合計金額の CSV をダウンロードできる機能を追加
- 「ユーザー別合計 CSV」ダウンロードボタンを追加（「明細 CSV」ボタンと並べて表示）
- ユーザーごとに集計した合計金額を CSV 形式で出力
- 社員コード順にソートして表示
- 合計行は含めない（ユーザーごとの合計のみ）

#### 実装詳細

1. **新しい API エンドポイントの作成**

   - `app/api/admin/reports/csv-by-user/route.ts` を作成
   - ユーザーごとに集計した合計金額を CSV 形式で出力
   - 既存の CSV API と同様に、フィルタ（業者・ユーザー）に対応

2. **レポート画面の更新**
   - 「ユーザー別合計 CSV」ダウンロードボタンを追加
   - 既存の「明細 CSV」ボタンと並べて表示（青色で区別）

#### CSV 出力形式

```
社員コード,氏名,合計金額
0001,"山田 太郎",15000
0002,"佐藤 花子",12000
```

- 社員コード順にソート
- 合計行は含めない
- UTF-8 BOM 付き（Excel で正しく開ける）
- フィルタ（業者・ユーザー）に対応

#### 修正ファイル

- `app/api/admin/reports/csv-by-user/route.ts`: ユーザー別合計金額 CSV 出力 API（新規作成）
- `app/admin/reports/page.tsx`: 「ユーザー別合計 CSV」ダウンロードボタンの追加

### PDF 生成・CSV 出力時の監査ログ記録機能の追加

#### 実装内容

- PDF 生成時に監査ログを記録する機能を追加
- CSV 出力（明細・ユーザー別合計）時に監査ログを記録する機能を追加
- すべての出力操作を監査ログに記録することで、操作履歴を追跡可能に

#### 実装詳細

1. **PDF 生成 API の監査ログ記録**

   - `app/api/admin/orders/today/pdf/route.ts` に監査ログ記録を追加
   - アクション: `pdf.generate`
   - 記録内容:
     - 日付
     - 業者 ID・業者名
     - 合計食数
     - 注文件数

2. **CSV 出力 API（明細）の監査ログ記録**

   - `app/api/admin/reports/csv/route.ts` に監査ログ記録を追加
   - アクション: `csv.download`
   - 記録内容:
     - 開始日・終了日
     - 業者 ID（フィルタ適用時）
     - ユーザー ID（フィルタ適用時）
     - 注文件数

3. **CSV 出力 API（ユーザー別合計）の監査ログ記録**
   - `app/api/admin/reports/csv-by-user/route.ts` に監査ログ記録を追加
   - アクション: `csv.download.by_user`
   - 記録内容:
     - 開始日・終了日
     - 業者 ID（フィルタ適用時）
     - ユーザー ID（フィルタ適用時）
     - ユーザー数

#### 監査ログの記録項目

- `actor_id`: 実行ユーザー ID
- `action`: アクション種別（`pdf.generate`, `csv.download`, `csv.download.by_user`）
- `target_table`: `orders`
- `target_id`: `null`（集計操作のため）
- `details`: 詳細情報（JSONB 形式）
- `ip_address`: 実行元 IP アドレス

#### 修正ファイル

- `app/api/admin/orders/today/pdf/route.ts`: 監査ログ記録を追加
- `app/api/admin/reports/csv/route.ts`: 監査ログ記録を追加
- `app/api/admin/reports/csv-by-user/route.ts`: 監査ログ記録を追加

#### 確認事項

- ✅ PDF 生成時に監査ログが記録される
- ✅ CSV 出力（明細）時に監査ログが記録される
- ✅ CSV 出力（ユーザー別合計）時に監査ログが記録される
- ✅ 操作ログ閲覧画面（`/admin/logs`）で確認可能

---

## 2025-01-XX（PDF 生成時の監査ログ記録機能の修正）

### 問題

- PDF 生成時に監査ログが記録されない
- エラー: `TypeError: headers is not a function`

### 原因

- `headers()`関数の呼び出し方法が誤っていた
- Next.js 16 では`request.headers`から直接取得する必要がある

### 解決策

- `request.headers`から直接 IP アドレスを取得する方法に変更
- `doc.on('end')`の重複を削除

### 修正ファイル

- `app/api/admin/orders/today/pdf/route.ts`: `headers()`関数の呼び出しを削除し、`request.headers`から直接取得

### 確認事項

- ✅ PDF 生成時に監査ログが正しく記録される
- ✅ 操作ログ閲覧画面（`/admin/logs`）で確認可能

---

## 2025-01-XX（新規登録制限機能の実装）

### 実装内容

社員のみが新規登録できるようにする制限機能を実装しました。

1. **招待コード方式**

   - 4 桁の数字の招待コードを必須にする
   - 使用回数制限機能（1〜9999 回、または無制限）
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
- `app/api/admin/invitation-code/route.ts`: 招待コード管理 API（新規作成）
- `app/api/admin/employee-codes/route.ts`: 社員コードマスター管理 API（新規作成）
- `app/api/admin/employee-codes/[id]/route.ts`: 社員コードマスター管理 API（個別）（新規作成）
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

- ✅ 招待コードが 4 桁の数字で生成される
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

- `app/api/admin/users/[id]/route.ts`の PUT メソッドを修正
- 社員コード変更時に`employee_codes`テーブルを更新
- 変更前の社員コードを取得して、変更時に解放処理を実行
- 新しい社員コードが`employee_codes`テーブルに存在する場合、未登録のみ許可

#### 注意事項

- 社員コード変更時、過去の注文データは`user_id`で参照しているため整合性は保たれる
- CSV/PDF 出力では、その時点の`profiles`テーブルの社員コードが表示される（過去の注文でも現在の社員コードが表示される）
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

1. **承認待ちユーザー一覧取得 API** (`GET /api/admin/users/pending`)

   - `is_active = false`のユーザー一覧を取得
   - 登録日時順（新しい順）で表示

2. **ユーザー承認 API** (`POST /api/admin/users/[id]/approve`)

   - 承認待ちユーザーを承認（`is_active = true`に設定）
   - 社員コードの重複チェックを実行
   - 監査ログに記録（`user.approve`アクション）

3. **承認待ちユーザー削除 API** (`POST /api/admin/users/[id]/reject`)

   - 承認待ちユーザーを物理削除
   - 削除前に、関連する注文、自動注文設定、自動注文テンプレートを削除
   - `employee_codes`テーブルで社員コードを解放
   - Supabase Auth のユーザーを削除
   - `profiles`テーブルのレコードを削除
   - 監査ログに記録（`user.reject`アクション）

4. **UI 実装**
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
- `app/api/admin/users/pending/route.ts`: 承認待ちユーザー一覧取得 API（新規作成）
- `app/api/admin/users/[id]/approve/route.ts`: ユーザー承認 API（新規作成）
- `app/api/admin/users/[id]/reject/route.ts`: 承認待ちユーザー削除 API（新規作成）
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

- 承認待ちユーザーが 1 名いるのに、ダッシュボードの承認待ちが 0 人と表示される
- 承認後、アクティブユーザーが増加せず、承認前と同じ人数のまま

#### 原因

- ダッシュボードで通常の Supabase クライアント（`createClient()`）を使用していたため、RLS ポリシーの影響で全ユーザーを取得できなかった
- 承認待ちユーザーの条件が不適切（`is_active = false`のみで、退職者も含まれていた）

#### 解決策

1. **Service Role Key の使用**

   - ダッシュボードで`supabaseAdmin`（Service Role Key）を使用して RLS をバイパス
   - アクティブユーザー数と承認待ちユーザー数を正しく取得

2. **承認待ちユーザー数の条件修正**
   - 以前: `is_active = false`のみ（退職者も含まれていた）
   - 修正後: `is_active = false` かつ `left_date`が未設定または未来の日付

#### 修正ファイル

- `app/admin/page.tsx`: Service Role Key を使用、承認待ちユーザー数の条件を修正
- `app/api/admin/users/pending/route.ts`: 承認待ちユーザーの条件を修正

#### 確認事項

- ✅ ダッシュボードで承認待ちユーザー数が正しく表示される
- ✅ 承認後にアクティブユーザー数が増加する

### ユーザー管理画面の有効/無効切り替え表示機能

#### 実装内容

ユーザー管理画面を「有効なユーザー」「無効なユーザー」「承認待ち」の 3 つのタブに分割。

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

#### UI 改善

- 各タブにユーザー数を表示（例: 「有効なユーザー (10)」）
- 無効なユーザーの行をグレーアウト表示して視認性を向上
- 退職者が多くても有効なユーザーをすぐに確認可能

#### 修正ファイル

- `app/admin/users/page.tsx`: タブ切り替え機能を 3 つに分割、表示ロジックを改善

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

2. **ユーザー削除 API の改善**

   - 削除時に注文データの存在をチェック
   - 注文データがある場合、警告ログを出力
   - API のコメントを更新し、論理削除のみであることを明確化

3. **ドキュメントの追加**
   - `docs/ユーザー削除と注文データ保護.md`: ユーザー削除と注文データ保護の仕組みを説明

#### 修正ファイル

- `app/api/admin/users/[id]/route.ts`: 注文データチェックと警告ログを追加
- `supabase/migrations/061_check_orders_user_id_fk_constraint.sql`: 外部キー制約確認用 SQL（新規作成）
- `supabase/migrations/062_fix_orders_user_id_fk_to_restrict.sql`: 外部キー制約修正用 SQL（新規作成）
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

1. **削除 API が`left_date`を設定していなかった**

   - 削除時に`is_active = false`のみ設定し、`left_date`を設定していなかった
   - そのため、削除されたユーザーが承認待ち条件（`is_active = false` かつ `left_date`が未設定または未来）に一致していた

2. **承認待ち API の条件が不適切**

   - 承認待ち条件が`left_date >= 今日`（以上）だったため、今日の日付も含まれていた
   - 削除時に今日の日付を設定しても、承認待ちリストに含まれてしまっていた

3. **フロントエンドの即時反映が不十分**
   - 削除後に`fetchPendingUsers()`を呼び出していなかったため、承認待ちリストが即座に更新されなかった

### 解決策

1. **削除 API で`left_date`を今日の日付に設定**

   - 削除時に`is_active = false`と`left_date = 今日の日付`を同時に設定
   - これにより、削除されたユーザーは無効なユーザーリストに表示される

2. **承認待ち API の条件を修正**

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

- 社員コードマスターは社員コード変更機能で内部的に使用されているため、テーブルと API は維持
- ただし、管理者が手動でマスターを管理する必要性は低い（自動更新されるため）

### 管理者メニューからの社員コードマスター項目の削除

#### 実装内容

- 管理者メニュー（`components/admin-nav.tsx`）から「社員コードマスター」メニュー項目を削除
- 管理画面や API は残す（社員コード変更機能で内部的に使用されるため）
- 直接 URL（`/admin/employee-codes`）でアクセスすることは可能

#### 修正ファイル

- `components/admin-nav.tsx`: 「社員コードマスター」メニュー項目を削除（35 行目）

### 注文の締切時刻チェック動作の確認

#### 確認内容

注文作業中に締切時刻を過ぎた場合の動作を確認。

#### 確認結果

1. **注文作成（POST /api/orders）**

   - 締切時刻を過ぎている場合: 「締切時刻を過ぎています」というエラーが返され、注文は作成されない
   - チェックは注文確定ボタンを押した時点（API 呼び出し時点）で実行される

2. **注文変更（PUT /api/orders/[id]）**

   - 締切時刻を過ぎている場合: 「締切時刻を過ぎているため、注文を変更できません」というエラーが返される
   - チェックは変更確定ボタンを押した時点（API 呼び出し時点）で実行される

3. **注文キャンセル（PATCH /api/orders/[id]）**
   - 締切時刻を過ぎている場合: 「最終の確定処理で時間を過ぎているためキャンセルできません」というエラーが返される
   - チェックはキャンセルボタンを押した時点（API 呼び出し時点）で実行される

#### 重要なポイント

- すべての処理で、締切時刻のチェックは処理実行時点（API 呼び出し時点）で行われる
- 画面を開いた時点ではなく、確定・変更・キャンセルボタンを押した時点で判定される
- サーバー側の現在時刻（`new Date()`）を使用するため、クライアント側の時刻改ざんの影響を受けない
- 作業中に締切時刻を過ぎても、確定処理の時点でチェックされるため、締切時刻を過ぎた操作は実行されない

#### 確認ファイル

- `app/api/orders/route.ts`: 注文作成時の締切時刻チェック（177-191 行目）
- `app/api/orders/[id]/route.ts`: 注文変更時の締切時刻チェック（131-149 行目）、注文キャンセル時の締切時刻チェック（387-422 行目）

---

## 2026-01-02（環境変数設定手順の詳細化とログイン問題の解決）

### 環境変数設定手順の詳細化

#### 実装内容

- `.env.local`ファイルの作成手順をステップバイステップで詳細化
- Supabase Dashboard からの値取得手順を追加
- 環境変数の確認方法を追加
- 使用されている環境変数の完全なリストを追加

#### 追加内容

1. **`.env.local`ファイルの作成手順**

   - PowerShell でのコピー方法
   - 手動での作成方法
   - ファイルの保存方法

2. **Supabase の値取得手順**

   - Supabase Dashboard へのアクセス方法
   - Project Settings > API からの値取得方法
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
- ✅ Supabase Dashboard からの値取得手順が記載されている
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

   - 文字数に制限はない（推奨は 64 文字程度）
   - 開発環境なら簡単な文字列でも可（例: `dev-secret-key-12345`）
   - 本番環境では推測されにくいランダムな文字列を推奨

3. **PDF 生成関連の環境変数について**
   - PDF 生成関連の環境変数（`PDF_SENDER_*`）は**オプション**（不要）
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

- 注文関連のコンポーネントと API に多数の`console.log`と`console.error`が残っていた
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

3. **`app/api/orders/route.ts`（注文作成 API）**

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

4. **`app/api/orders/[id]/route.ts`（注文更新・キャンセル API）**

   - `console.log('=== Cancel Order Request ===')` を削除
   - `console.log('Raw params:', ...)` を削除
   - `console.log('Parsed orderId:', ...)` を削除
   - `console.error('Invalid orderId:', ...)` を削除
   - `console.log('Attempting to cancel order:', ...)` を削除
   - `console.log('Update result:', ...)` を削除
   - `console.error('Order cancel error:', ...)` を削除
   - `console.error('Error details:', ...)` を削除
   - `console.error('Audit log insert error:', ...)` を削除（2 箇所）
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

- **Jest + React Testing Library のセットアップ**
  - Jest と React Testing Library をインストール
  - `jest.config.mjs`と`jest.setup.mjs`を作成
  - `package.json`にテストスクリプトを追加（`test`, `test:watch`, `test:coverage`）

#### 実装ファイル

- `jest.config.mjs`: Jest 設定ファイル
- `jest.setup.mjs`: Jest セットアップファイル（環境変数のモック、Next.js のモック）
- `package.json`: テストスクリプトの追加

### エラーハンドリングの統一

#### 実装内容

1. **エラーハンドリング用ユーティリティ関数の作成**

   - `lib/utils/errors.ts`: エラーハンドリング用ユーティリティ関数
     - `ApiError`クラス: カスタムエラークラス
     - 各種エラーレスポンス生成関数（`unauthorizedResponse`, `forbiddenResponse`, `notFoundResponse`, `validationErrorResponse`, `internalErrorResponse`）
     - `createErrorResponse`: エラーレスポンス生成ヘルパー関数

2. **API Route 用ヘルパー関数の作成**
   - `lib/utils/api-helpers.ts`: API Route 用ヘルパー関数
     - `getAuthenticatedUser`: 認証済みユーザー取得
     - `checkAdminPermission`: 管理者権限チェック
     - `requireAdmin`: 管理者権限必須チェック
     - `parseRequestBody`: リクエストボディのパース
     - `checkUserActive`: ユーザーのアクティブ状態チェック
     - `validateDateNotPast`: 日付バリデーション（過去の日付チェック）
     - `validateQuantity`: 数量バリデーション

#### 実装ファイル

- `lib/utils/errors.ts`: エラーハンドリングユーティリティ関数（新規作成）
- `lib/utils/api-helpers.ts`: API Route 用ヘルパー関数（新規作成）

### 型定義の整理

#### 実装内容

- `lib/utils/types.ts`: 共通型定義
  - `ApiResponse`: API レスポンスの基本型
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
  - テスト結果: 9 件すべて通過

#### 実装ファイル

- `lib/utils/api-helpers.test.ts`: バリデーション関数のテスト（新規作成）

### ドキュメントの追加

#### 実装内容

- `docs/TESTING.md`: テストガイド

  - テスト環境の説明
  - テストの実行方法
  - テストの種類（ユニットテスト、コンポーネントテスト、API Route テスト）
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

### .gitignore の更新

- `.gitignore`に`.cursor/`ディレクトリを追加（デバッグログを除外）

#### 修正ファイル

- `.gitignore`: `.cursor/`ディレクトリを追加

### 確認事項

- ✅ Jest と React Testing Library が正常に動作する
- ✅ バリデーション関数のテストが 9 件すべて通過
- ✅ エラーハンドリングユーティリティ関数が作成された
- ✅ 型定義が整理された
- ✅ テストドキュメントが追加された

### 今後の課題

- API Route の統合テストの実装（モックを使用）
- コンポーネントテストの追加
- E2E テストのセットアップ（Playwright または Cypress）
- エラーハンドリングユーティリティを既存 API Route に適用

---

## 2026-01-02（Vercel Cron Jobs 制限対応：Cron Jobs の統合）

### 問題

- Vercel の無料プランでは、チームあたり最大 2 つの Cron Jobs しか作成できない
- 既に他のプロジェクトで 2 つの Cron Jobs を使用していたため、このプロジェクトで 2 つの Cron Jobs を作成しようとしてデプロイエラーが発生
- エラーメッセージ: `Your plan allows your team to create up to 2 Cron Jobs. Your team currently has 2, and this project is attempting to create 2 more, exceeding your team's limit.`

### 解決策

**2 つの Cron Jobs を 1 つに統合**

1. **退職済みユーザー無効化処理を自動注文実行 API に統合**

   - 退職済みユーザーの無効化処理を`/api/auto-order/run`内で実行するように変更
   - 自動注文実行の前に退職済みユーザーを無効化
   - エラーが発生しても自動注文処理は続行（ログに記録）

2. **`vercel.json`から Cron Job を削除**
   - `/api/admin/users/deactivate-expired`の Cron Job 設定を削除
   - `/api/auto-order/run`の Cron Job のみ残す（1 つに統合）

### 変更の影響

- **退職済みユーザー無効化の実行タイミング**: 毎日 0:00 JST → 毎日 10:00 JST（自動注文実行時）
- **実行頻度**: 1 日 1 回（自動注文実行時）
- **`/api/admin/users/deactivate-expired`**: API は残しており、手動実行やテストで使用可能

### 修正ファイル

- `app/api/auto-order/run/route.ts`: 退職済みユーザー無効化処理を追加
- `vercel.json`: Cron Job 設定を 1 つに削減

### 確認事項

- ✅ Vercel の Cron Jobs 制限を回避（1 つの Cron Job のみ使用）
- ✅ 退職済みユーザー無効化処理が自動注文実行時に実行される
- ✅ デプロイエラーが解消される

---

## 2026-01-03（カレンダー UI 改善とログイン機能改善）

### カレンダー画面の UI 改善

#### 問題

- 注文がある月は日付セルのサイズが縦に伸びてしまう
- スマホの画面上にカレンダーが収まらず下が切れてしまう

#### 解決策

- 「（クリックで変更）」のテキストを「変更可」に短縮
- 括弧を外して文字数を削減し、改行を防止
- セルのサイズが変わらないように改善

#### 修正ファイル

- `components/calendar-grid.tsx`: テキストを「変更可」に変更

### ログイン画面の UI 改善

#### ローディング表示の追加

- ログインボタンにローディングスピナーアイコンを追加
- ログイン処理中は「ログイン中...」と表示
- エラーでログインできなかった場合は「ログイン」の表示に戻す
- ボタンをグレーアウトして無効化

#### エラーメッセージの日本語化

- Supabase のエラーメッセージを日本語に変換する関数を追加
- `"Invalid login credentials"` → `"メールアドレスまたはパスワードが正しくありません"`
- ログイン機能とパスワードリセット機能のエラーメッセージを日本語化

#### 修正ファイル

- `app/(auth)/login/page.tsx`: ローディング表示追加、エラーメッセージ日本語化関数の追加

### メール確認 URL の修正

#### 問題

- 新規登録時のメール内の確認 URL がローカル URL になってしまう
- デプロイした環境でサインアップしてもローカルの URL が表示される

#### 解決策

1. **環境変数の追加**

   - `NEXT_PUBLIC_SITE_URL`環境変数を追加
   - 本番環境: `https://bento-order-app-blond.vercel.app`
   - 開発環境: 設定不要（デフォルトで `http://localhost:3000` が使用される）

2. **コードの修正**

   - `app/api/auth/signup/route.ts`: 環境変数から URL を取得
   - `app/(auth)/login/page.tsx`: パスワードリセット機能でも環境変数を使用

3. **Supabase Dashboard の設定**
   - Authentication → URL Configuration → Site URL を本番環境の URL に設定
   - Redirect URLs に本番環境の URL を追加

#### 修正ファイル

- `app/api/auth/signup/route.ts`: `NEXT_PUBLIC_SITE_URL`環境変数の使用
- `app/(auth)/login/page.tsx`: `NEXT_PUBLIC_SITE_URL`環境変数の使用
- `env.example`: `NEXT_PUBLIC_SITE_URL`の説明を追加
- `docs/環境変数設定手順.md`: Supabase Dashboard の設定手順を追加

### 確認事項

- ✅ カレンダーのセルサイズが注文の有無に関わらず一定
- ✅ スマホでカレンダーが画面に収まる
- ✅ ログイン処理中にローディングスピナーが表示される
- ✅ エラー時にログインボタンのテキストが「ログイン」に戻る
- ✅ ログインエラーメッセージが日本語で表示される
- ✅ メール内の確認 URL が本番環境の URL になる

---

## 2026-01-03（サインアップ API のエラーメッセージ日本語化と自動注文処理の修正）

### サインアップ API のエラーメッセージ日本語化

#### 実装内容

- **エラーメッセージ日本語化関数の追加**

  - `lib/utils/errors.ts`に`translateAuthError`関数を追加
  - Supabase Auth のエラーメッセージを日本語に変換する関数
  - メールアドレス無効エラー（`Email address "xxx" is invalid`）に対応

- **サインアップ API での日本語化**
  - `app/api/auth/signup/route.ts`で`translateAuthError`関数を使用
  - エラーレスポンスで日本語化したメッセージを返すように変更

#### 対応したエラーメッセージ

- `Email address "xxx" is invalid` → 「メールアドレスの形式が正しくありません。メールアドレスを確認してください」
- `Invalid email` → 「メールアドレスの形式が正しくありません」
- `Invalid login credentials` → 「メールアドレスまたはパスワードが正しくありません」
- その他の Supabase Auth エラーも日本語化

#### 修正ファイル

- `lib/utils/errors.ts`: `translateAuthError`関数を追加
- `app/api/auth/signup/route.ts`: 日本語化関数を使用

#### 確認事項

- ✅ サインアップ時のエラーメッセージが日本語で表示される
- ✅ メールアドレス形式エラーが分かりやすく表示される

### 登録成功後のセッション更新

#### 問題

- ユーザー登録後にログイン画面に戻ってログインしようとしても、メールアドレスが未登録のようなエラーが出てログインできない
- 一度アプリを終了して再度起動するとログインできるようになる

#### 解決策

- 登録成功後に`router.refresh()`を呼び出すように修正
- Supabase クライアントのセッション状態を更新するためにページをリフレッシュ

#### 修正ファイル

- `app/(auth)/login/page.tsx`: 登録成功後に`router.refresh()`を追加

#### 確認事項

- ✅ 登録後にアプリを再起動しなくても、すぐにログインを試みられるようになる
- ✅ セッション状態が正しく更新される

### 自動注文処理の問題修正

#### 問題

- 締切時間を過ぎても、翌日の注文が入らなかった
- Vercel Cron Jobs のスケジュールが UTC 基準で設定されていた
- 日付計算ロジックが不正確だった

#### 解決策

1. **Vercel Cron Jobs のスケジュール修正**

   - `vercel.json`のスケジュールを`"0 10 * * *"`（UTC 10:00）から`"0 1 * * *"`（UTC 01:00）に変更
   - JST 10:00 に実行されるように修正（JST = UTC+9 時間）

2. **`.single()`のエラー修正**

   - `order_calendar`テーブルにレコードが存在しない場合、`.single()`がエラーを返す問題を修正
   - `.maybeSingle()`に変更して、レコードが存在しない場合もエラーを回避

3. **日付計算ロジックの改善**

   - JST 時刻の日付計算を正確に行うように修正
   - `Intl.DateTimeFormat`を使用して、JST 時刻で正確に日付を計算
   - `toLocaleString`を使用していた不正確な方法から改善

4. **未定義変数の修正**
   - `jstNow`変数が定義されていない問題を修正
   - `now`を使用するように変更

#### 修正ファイル

- `vercel.json`: Cron Jobs のスケジュールを UTC 01:00 に変更
- `app/api/auto-order/run/route.ts`: 日付計算ロジックの改善、`.maybeSingle()`の使用、未定義変数の修正

#### 確認事項

- ✅ 自動注文処理が JST 10:00 に正しく実行される
- ✅ 翌営業日の注文が正しく作成される
- ✅ 日付計算が JST 基準で正確に行われる

---

## 2026-01-05（自動注文 API のデバッグログ追加とコード修正）

### 自動注文 API のデバッグ機能強化

#### 問題

- 自動注文が動作しない問題が発生
- エラーの原因を特定するためのログが不足していた

#### 解決策

1. **デバッグログの追加**

   - API 呼び出し時の認証状態をログ出力（`isVercelCron`）
   - 今日の日付（JST）をログ出力
   - 対象日（翌営業日）をログ出力
   - 有効なユーザー数をログ出力
   - 実行結果（作成数、スキップ数、エラー数）をログ出力
   - エラー発生時の詳細ログ（エラーメッセージ、スタックトレース）を出力

2. **`.order()`メソッドの修正**
   - `nullsFirst`オプションを削除（Supabase の JavaScript クライアントでの互換性の問題を回避）
   - `.order('day_of_week', { ascending: true })`のみを使用

#### 修正ファイル

- `app/api/auto-order/run/route.ts`: デバッグログ追加、`.order()`メソッドの`nullsFirst`オプション削除

#### 確認事項

- ✅ デバッグログが追加され、問題の特定が容易になった
- ✅ Vercel のログで実行状況を確認できるようになった

### Vercel の無料プランでの Cron Jobs 動作確認

#### 確認内容

- Vercel の無料プラン（Hobby プラン）でも Cron Jobs は利用可能
- 制限: チームあたり最大 2 つの Cron Jobs
- 現在のプロジェクトでは 1 つの Cron Job のみ使用（制限内）
- クライアントからのトリガーなしでバックグラウンド実行が可能

#### 注意事項

- 商用利用は無料プランでは不可（Hobby プランの利用規約に準拠）
- 実行時間の制限あり（月間 100 時間）
- Cron Jobs の数に制限あり（チームあたり最大 2 つ）

---

## 2026-01-XX（管理者による過去の注文入力・削除機能の実装と管理者モード判定の改善）

### 実装内容

後日注文データに間違いがわかったときの対応として、管理者のみ過去の注文を入力・削除できる機能を実装しました。また、管理者モードの判定ロジックを改善し、管理者が管理画面から自分のカレンダーを開く場合も管理者モードで動作するようにしました。

#### 過去の注文入力機能

- **管理者モードのみ過去の日付に注文可能**: 注文作成 API で、管理者モード（`user_id`パラメータが指定されている場合）の場合は過去の日付チェックをスキップ
- **制限の緩和**: 管理者モードは最大注文可能日数の制限、注文可能日チェック、締切時刻チェックをスキップ
- **一般ユーザーは従来どおり**: 一般ユーザーは従来どおりの制限を維持
- **管理者がユーザー画面から開く場合**: 管理者でもユーザー画面からカレンダーを開く場合は通常の範囲での変更のみ許可

#### 注文削除機能

- **注文削除 API の追加**: `DELETE /api/orders/[id]` エンドポイントを追加（管理者のみ）
- **物理削除**: 注文を物理削除（`status = 'canceled'`への変更ではなく、レコード自体を削除）
- **監査ログ記録**: 削除操作を監査ログに記録（`order.delete.admin`アクション）
- **注文一覧画面に削除ボタン追加**: 管理者が注文一覧画面から直接削除可能

#### 締切時刻を過ぎた注文のキャンセル制限

- **一般ユーザーは締切時刻を過ぎた注文をキャンセル不可**: 注文履歴画面でキャンセルボタンを非表示、API でもキャンセル不可
- **管理者は締切時刻を過ぎた注文もキャンセル可能**: 運用上の柔軟性のため

#### 管理者モード判定ロジックの改善

- **管理者モードの定義**: `user_id`パラメータが指定されている場合のみ管理者モード（管理者権限がある場合のみ許可）
- **管理者が管理画面から自分のカレンダーを開く場合**: 管理者モードで動作（過去の日付にも注文可能）
- **管理者がユーザー画面からカレンダーを開く場合**: ユーザーモードで動作（通常の範囲での変更のみ）
- **カレンダー画面の改善**: 管理者モードの場合、過去の日付も選択可能
- **注文作成画面の改善**: 管理者モードの場合、過去の日付でも注文作成可能

### 修正ファイル

- `app/api/orders/route.ts`: 管理者モードの場合は過去の日付チェック、最大注文可能日数チェック、注文可能日チェック、締切時刻チェックをスキップ
- `app/api/orders/[id]/route.ts`:
  - 一般ユーザーの場合は締切時刻を過ぎた注文をキャンセル不可に修正
  - DELETE メソッドを追加（管理者のみ、注文の物理削除）
- `app/(user)/orders/page.tsx`: `isAfterDeadline`関数を改善
- `app/(user)/calendar/page.tsx`: 管理者モード判定ロジックを改善（`isAdminMode`を追加）
- `app/(user)/orders/new/page.tsx`: 管理者モード判定ロジックを改善（`isAdminMode`を追加）
- `components/calendar-grid.tsx`: 管理者モード判定ロジックを改善（`isAdminMode`プロパティを追加、過去の日付も選択可能に）
- `app/admin/orders/today/page.tsx`: 削除ボタンを追加
- `app/admin/orders/today/delete-order-button.tsx`: 削除ボタンコンポーネント（新規作成）

### 確認事項

- ✅ 管理者が過去の日付に注文を作成できる（管理者モードの場合のみ）
- ✅ 管理者が注文を物理削除できる
- ✅ 一般ユーザーは締切時刻を過ぎた注文をキャンセルできない
- ✅ 管理者は締切時刻を過ぎた注文もキャンセル可能
- ✅ 削除操作が監査ログに記録される
- ✅ 管理者が管理画面から自分のカレンダーを開く場合も管理者モードで動作
- ✅ 管理者がユーザー画面からカレンダーを開く場合はユーザーモードで動作

---

## 2026-01-XX（UI 改善、タイムゾーン問題修正、データベース接続最適化）

### 実装内容

UI の改善、タイムゾーン問題の修正、データベース接続の最適化を実施しました。

#### UI 改善

- **ログイン画面の年表記更新**: フッターの「© 2024 お弁当注文システム」を「© 2026 お弁当注文システム」に変更

#### パスワードリセットメールのリンク問題修正

- **問題**: パスワードリセットメールのリンクがローカル URL（`http://localhost:3000`）になってしまう
- **原因**: `NEXT_PUBLIC_SITE_URL`環境変数が設定されていない場合、`window.location.origin`が使用されていた
- **解決策**:
  - コードを改善し、`NEXT_PUBLIC_SITE_URL`が設定されていない場合の警告を追加
  - `env.example`に詳細な説明を追加
  - Vercel と Supabase Dashboard の両方で設定が必要であることを明記

#### タイムゾーン問題の修正

- **問題**: 本番環境（UTC）とローカル環境（JST）で、注文履歴画面の締切時刻判定が異なっていた
- **原因**: `isAfterDeadline`関数で、UTC と JST の混在による日付・時刻の比較が正しく行われていなかった
- **解決策**:
  - `app/(user)/orders/page.tsx`の`isAfterDeadline`関数を修正
  - JST（UTC+9）で統一して日付と時刻を比較するように変更
  - 本番環境とローカル環境で同じ動作になることを確認

#### データベース接続の最適化

- **DATABASE_URL ユーティリティの追加**:

  - `lib/utils/database.ts`を作成
  - `getDatabaseUrl()`と`getDatabaseUrlOptional()`関数を追加
  - サーバーサイドでのみ使用可能な環境変数の安全な取得を実装

- **Transaction connection (6543)のサポート追加**:
  - `pg`ライブラリをインストール
  - `lib/database/pool.ts`: 接続プールの管理（Transaction connection 使用）
  - `lib/database/query.ts`: クエリヘルパー関数（`queryDatabase()`、`transaction()`）
  - `docs/Transaction接続の使用方法.md`: 使用方法の詳細ドキュメント
  - 接続プールを活用することで、パフォーマンスが向上（特に複数のクエリを実行する場合）

### 修正ファイル

- `app/(auth)/login/page.tsx`:
  - 年表記を 2026 に更新
  - パスワードリセットメールのリンク生成ロジックを改善
- `app/(user)/orders/page.tsx`:
  - `isAfterDeadline`関数を修正（JST で統一）
- `lib/utils/database.ts`: DATABASE_URL 取得ユーティリティ（新規作成）
- `lib/database/pool.ts`: 接続プール管理（新規作成）
- `lib/database/query.ts`: クエリヘルパー関数（新規作成）
- `env.example`: DATABASE_URL の説明を追加・更新
- `package.json`: `pg`と`@types/pg`を追加

### 確認事項

- ✅ ログイン画面の年表記が 2026 に更新されている
- ✅ パスワードリセットメールのリンクが本番環境の URL になる（`NEXT_PUBLIC_SITE_URL`設定時）
- ✅ 本番環境とローカル環境で、注文履歴画面の締切時刻判定が同じ動作になる
- ✅ DATABASE_URL を安全に取得できる
- ✅ Transaction connection (6543)を使用したデータベース接続が可能

### 注意事項

- **パスワードリセットメール**: Vercel と Supabase Dashboard の両方で`NEXT_PUBLIC_SITE_URL`と Site URL を設定する必要があります
- **タイムゾーン**: すべての日付・時刻比較は JST（UTC+9）で統一されています
- **データベース接続**: Transaction connection (6543)はオプション機能です。既存の Supabase クライアントと併用できます

---

## 変更履歴の記録ルール

- 日付は `YYYY-MM-DD` 形式で記載
- 変更内容は簡潔に記述
- 仕様変更の場合は、`SPEC.md` と `DECISIONS.md` も更新すること
- 実装完了後は、`PROGRESS.md` も更新すること
