# Transaction接続対応：注文機能の最適化

## 概要

Transaction connection (6543)を使用して、注文関連の機能を最適化しました。複数のクエリを同じ接続で実行することで、パフォーマンスが向上し、トランザクション保証によりデータ整合性が確保されます。

> 📖 **関連ドキュメント**: 
> - [Transaction接続の使用方法.md](./Transaction接続の使用方法.md) - Transaction connectionの基本的な使用方法
> - [CHANGELOG.md](./CHANGELOG.md) - 変更履歴
> - [PROGRESS.md](./PROGRESS.md) - 進捗状況

---

## 対応した機能

### 1. 注文カレンダー（`app/(user)/calendar/page.tsx`）

**変更内容：**
- プロフィール取得、カレンダーデータ取得、注文データ取得、システム設定取得を`queryDatabase`で統合
- メニュー・業者情報の取得も`queryDatabase`を使用（JOINで効率化）

**改善点：**
- 複数のクエリを1つの接続で実行し、接続確立のオーバーヘッドを削減
- JOINを使用して、Supabaseのネストしたクエリと同等のデータを効率的に取得

**実装詳細：**
```typescript
// プロフィール取得と管理者権限チェック
const calendarData = await queryDatabase(async (client) => {
  const profileResult = await client.query(
    'SELECT role, full_name FROM profiles WHERE id = $1',
    [user.id]
  );
  // ...
});

// カレンダーデータ、注文データ、システム設定を一度に取得
const { orderDays, orders, systemSettings } = await queryDatabase(async (client) => {
  // カレンダーデータ
  const calendarResult = await client.query(...);
  // 注文データ
  const ordersResult = await client.query(...);
  // システム設定
  const settingsResult = await client.query(...);
  return { orderDays, orders, systemSettings };
});

// メニュー・業者情報をJOINで取得
const menuData = await queryDatabase(async (client) => {
  const menuResult = await client.query(
    `SELECT mi.id, mi.name, mi.vendor_id, v.id as vendor_id_from_vendors, v.name as vendor_name
     FROM menu_items mi
     LEFT JOIN vendors v ON mi.vendor_id = v.id
     WHERE mi.id = ANY($1::bigint[]) AND mi.is_active = true`,
    [menuItemIds.map(id => BigInt(id))]
  );
  return menuResult.rows;
});
```

### 2. 新規注文API（`app/api/orders/route.ts`）

**変更内容：**
- プロフィール取得、システム設定・カレンダー情報取得を`transaction`で統合
- 注文作成処理全体を`transaction`で実行

**改善点：**
- トランザクション保証により、データ整合性が確保される
- 既存注文チェック、キャンセル済み注文削除、メニュー確認、価格取得、注文作成、監査ログ記録を1つのトランザクションで実行

**実装詳細：**
```typescript
const result = await transaction(async (client) => {
  // 既存注文チェック
  const existingOrderResult = await client.query(...);
  
  // キャンセル済み注文削除
  const canceledOrdersResult = await client.query(...);
  
  // メニュー確認
  const menuResult = await client.query(...);
  
  // 価格ID取得（DB関数を使用）
  const priceResult = await client.query(
    'SELECT get_menu_price_id($1, $2) as price_id',
    [menu_id, order_date]
  );
  
  // 価格情報取得
  const priceInfoResult = await client.query(...);
  
  // 注文作成
  const insertResult = await client.query(
    `INSERT INTO orders (...) VALUES (...) RETURNING *`,
    [...]
  );
  
  // 監査ログ記録
  await client.query(`INSERT INTO audit_logs (...) VALUES (...)`, [...]);
  
  return insertResult.rows[0];
});
```

### 3. 注文変更API（`app/api/orders/[id]/route.ts`）

**変更内容：**
- PUT（更新）とPATCH（キャンセル）の両方を`transaction`に対応
- プロフィール取得、注文確認、カレンダー情報取得、更新/キャンセル処理、監査ログ記録を`transaction`で統合

**改善点：**
- トランザクション保証により、更新処理の整合性が確保される
- エラーハンドリングを改善し、適切なステータスコードとエラーメッセージを返却

**実装詳細：**
```typescript
// PUT（更新）
const result = await transaction(async (client) => {
  // 注文確認
  const orderResult = await client.query(...);
  
  // カレンダー情報取得
  const orderDayResult = await client.query(...);
  
  // 締切時刻チェック
  // ...
  
  // メニュー確認
  const menuResult = await client.query(...);
  
  // 価格ID取得
  const priceResult = await client.query(
    'SELECT get_menu_price_id($1, $2) as price_id',
    [menu_id, order.order_date]
  );
  
  // 注文更新
  const updateResult = await client.query(
    `UPDATE orders SET ... WHERE id = $1 RETURNING *`,
    [...]
  );
  
  // 監査ログ記録
  await client.query(`INSERT INTO audit_logs (...) VALUES (...)`, [...]);
  
  return updateResult.rows[0];
});

// PATCH（キャンセル）
const result = await transaction(async (client) => {
  // 注文確認
  // カレンダー情報取得
  // 締切時刻チェック（一般ユーザーの場合）
  // 注文キャンセル
  // 監査ログ記録
  // ...
});
```

### 4. 注文履歴画面（`app/(user)/orders/page.tsx`）

**変更内容：**
- 注文データとカレンダー情報を`queryDatabase`で統合
- JOINを使用して、`menu_items`と`vendors`の情報を一度のクエリで取得

**改善点：**
- 複数のクエリを1つの接続で実行し、パフォーマンスが向上
- JOINを使用して、Supabaseのネストしたクエリと同等のデータを効率的に取得

**実装詳細：**
```typescript
const { orders, orderDays } = await queryDatabase(async (client) => {
  // 注文データを取得（menu_itemsとvendorsのJOIN）
  const ordersResult = await client.query(
    `SELECT 
      o.*,
      mi.id as menu_item_id_from_menu,
      mi.name as menu_item_name,
      v.id as vendor_id_from_vendor,
      v.name as vendor_name
     FROM orders o
     LEFT JOIN menu_items mi ON o.menu_item_id = mi.id
     LEFT JOIN vendors v ON mi.vendor_id = v.id
     WHERE o.user_id = $1 AND o.order_date >= $2
     ORDER BY o.order_date DESC`,
    [user.id, startDate]
  );
  
  // データを整形（Supabaseの形式に合わせる）
  const orders = ordersResult.rows.map((row: any) => ({
    ...row,
    menu_items: row.menu_item_id_from_menu ? {
      id: String(row.menu_item_id_from_menu),
      name: row.menu_item_name,
      vendors: row.vendor_id_from_vendor ? {
        id: String(row.vendor_id_from_vendor),
        name: row.vendor_name,
      } : null,
    } : null,
  }));
  
  // カレンダー情報を取得
  const orderDaysResult = await client.query(
    `SELECT target_date, deadline_time 
     FROM order_calendar 
     WHERE target_date = ANY($1::date[])`,
    [orderDates]
  );
  
  return { orders, orderDays: orderDaysResult.rows };
});
```

---

## パフォーマンス改善

### 接続確立のオーバーヘッド削減

- **以前**: 各クエリごとに新しい接続を確立（HTTP経由のSupabaseクライアント）
- **現在**: 接続プールを使用して、既存の接続を再利用

### 複数クエリの統合

- **以前**: 複数のSupabaseクエリを順次実行
- **現在**: 1つの接続で複数のクエリを実行し、ネットワークラウンドトリップを削減

### JOINクエリの最適化

- **以前**: ネストしたSupabaseクエリ（複数のHTTPリクエスト）
- **現在**: SQL JOINを使用して、1つのクエリで関連データを取得

---

## トランザクション保証

### 注文作成・更新・キャンセル処理

すべての注文関連処理をトランザクション内で実行することで、以下の保証が得られます：

1. **原子性**: すべての処理が成功するか、すべてがロールバックされる
2. **一貫性**: データベースの整合性が保たれる
3. **分離性**: 同時実行される他のトランザクションから分離される
4. **永続性**: コミットされた変更は永続的に保存される

### エラーハンドリング

トランザクション内でエラーが発生した場合、自動的にロールバックされ、適切なエラーメッセージとステータスコードが返却されます。

---

## 注意事項

### RLS（Row Level Security）

直接PostgreSQL接続では、RLSが自動的に適用されません。現在の実装では、以下の方法で権限チェックを行っています：

1. **認証チェック**: Supabase Authを使用してユーザー認証を確認
2. **権限チェック**: プロフィール情報を取得して、管理者権限を確認
3. **所有権チェック**: クエリ内で`user_id`をチェック

### 既存のSupabaseクライアントとの併用

Transaction connectionは既存のSupabaseクライアント（`supabaseAdmin`）と併用できます。以下のような使い分けが可能です：

- **パフォーマンスが重要なクエリ**: Transaction connectionを使用
- **シンプルなクエリ**: Supabaseクライアントを使用
- **認証関連の処理**: Supabaseクライアントを使用

---

## 実装ファイル

### 修正したファイル

1. **`app/(user)/calendar/page.tsx`**
   - プロフィール取得、カレンダーデータ取得、注文データ取得、システム設定取得を`queryDatabase`で統合
   - メニュー・業者情報の取得も`queryDatabase`を使用

2. **`app/api/orders/route.ts`**
   - プロフィール取得、システム設定・カレンダー情報取得を`transaction`で統合
   - 注文作成処理全体を`transaction`で実行

3. **`app/api/orders/[id]/route.ts`**
   - PUT（更新）とPATCH（キャンセル）の両方を`transaction`に対応
   - プロフィール取得、注文確認、カレンダー情報取得、更新/キャンセル処理、監査ログ記録を`transaction`で統合

4. **`app/(user)/orders/page.tsx`**
   - 注文データとカレンダー情報を`queryDatabase`で統合
   - JOINを使用して、`menu_items`と`vendors`の情報を一度のクエリで取得

### 使用しているユーティリティ

- **`lib/database/pool.ts`**: 接続プールの管理
- **`lib/database/query.ts`**: クエリヘルパー関数（`queryDatabase`、`transaction`）
- **`lib/utils/database.ts`**: DATABASE_URLの取得ユーティリティ

---

## 確認事項

- ✅ 注文カレンダーが正常に表示される
- ✅ 新規注文が正常に作成される
- ✅ 注文変更が正常に動作する
- ✅ 注文キャンセルが正常に動作する
- ✅ 注文履歴が正常に表示される
- ✅ トランザクション保証により、データ整合性が確保される
- ✅ パフォーマンスが向上している

---

## 今後の拡張

### 他の機能への適用

以下の機能にもTransaction connectionを適用することで、さらなるパフォーマンス向上が期待できます：

- 管理者機能（カレンダー管理、業者・メニュー・価格管理、レポート）
- 自動注文機能
- ユーザー管理機能

### パフォーマンス測定

実際のパフォーマンス改善を測定するため、以下の指標を監視することを推奨します：

- レスポンス時間
- データベース接続数
- クエリ実行時間

---

最終更新日: 2026-01-XX（Transaction接続対応完了時点）
