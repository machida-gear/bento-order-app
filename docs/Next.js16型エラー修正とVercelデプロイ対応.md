# Next.js 16.1.1 型エラー修正と Vercel デプロイ対応

## 概要

Vercel へのデプロイ時に発生した TypeScript 型エラーを修正し、Next.js 16.1.1 の型システム変更に対応しました。

**実施日**: 2025-01-XX  
**対象バージョン**: Next.js 16.1.1  
**問題**: Vercel デプロイ時の TypeScript コンパイルエラー  
**解決**: 型アサーションの追加と `params`/`searchParams` の Promise 型対応

---

## 背景

### 発生した問題

Vercel へのデプロイ時に、以下のような TypeScript 型エラーが多数発生しました：

1. **`params` の型エラー**
   - Next.js 16.1.1 では `params` が `Promise<{ id: string }>` 型に変更
   - 従来の `{ params: { id: string } }` 型ではエラー

2. **`searchParams` の型エラー**
   - `searchParams` も `Promise` 型に変更
   - 直接アクセスすると型エラー

3. **Supabase クエリ結果の型エラー**
   - Supabase のクエリ結果が `never` 型として推論される
   - プロパティアクセス時に型エラー

### Next.js 16.1.1 の変更点

- **Route Handlers**: `params` が `Promise` 型に変更
- **Page Components**: `searchParams` が `Promise` 型に変更
- **型推論の厳格化**: より厳密な型チェック

---

## 修正内容

### 1. Route Handlers の `params` 対応

#### 修正前

```typescript
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const orderId = parseInt(params.id, 10);
  // ...
}
```

#### 修正後

```typescript
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await Promise.resolve(params);
  const orderId = parseInt(resolvedParams.id, 10);
  // ...
}
```

#### 修正対象ファイル

- `app/api/admin/employee-codes/[id]/route.ts`
- `app/api/orders/[id]/route.ts`
- その他の動的ルートの Route Handlers

---

### 2. Page Components の `searchParams` 対応

#### 修正前

```typescript
export default async function Page({
  searchParams,
}: {
  searchParams: { year?: string; month?: string };
}) {
  const year = searchParams.year;
  // ...
}
```

#### 修正後

```typescript
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = searchParams instanceof Promise 
    ? await searchParams 
    : searchParams;
  const year = params.year;
  // ...
}
```

#### 修正対象ファイル

- `app/(user)/calendar/page.tsx`
- `app/(user)/orders/new/page.tsx`
- `app/(user)/orders/[id]/edit/page.tsx`

---

### 3. Supabase クエリ結果の型アサーション

#### 問題

Supabase のクエリ結果が `never` 型として推論され、プロパティアクセス時にエラーが発生。

#### 解決方法

型アサーションを追加して、オブジェクトの構造を明示的に指定。

#### 修正パターン

```typescript
// 修正前
const { data: profile } = await supabase
  .from('profiles')
  .select('role, is_active')
  .single();

if (profile.role === 'admin') { // エラー: Property 'role' does not exist on type 'never'
  // ...
}

// 修正後
const { data: profile } = await supabase
  .from('profiles')
  .select('role, is_active')
  .single();

const profileTyped = profile as { 
  role?: string; 
  is_active?: boolean; 
  [key: string]: any 
} | null;

if (profileTyped?.role === 'admin') {
  // ...
}
```

---

## 修正されたファイル一覧

### API Routes (Route Handlers)

#### Admin API Routes

1. **`app/api/admin/employee-codes/[id]/route.ts`**
   - `params` を `Promise` 型に変更
   - `profile` の型アサーション追加
   - `existing` の型アサーション追加
   - `update` と `insert` 操作に型アサーション追加

2. **`app/api/admin/calendar/route.ts`**
   - `profile` の型アサーション追加
   - `upsert` 操作に型アサーション追加
   - `audit_logs.insert` に型アサーション追加

3. **`app/api/admin/closing-periods/route.ts`**
   - `profile` の型アサーション追加

4. **`app/api/admin/employee-codes/route.ts`**
   - `profile` の型アサーション追加
   - `insert` 操作に型アサーション追加
   - `audit_logs.insert` に型アサーション追加

5. **`app/api/admin/invitation-code/route.ts`**
   - `profile` の型アサーション追加
   - `data` の型アサーション追加
   - `currentSettings` の型アサーション追加
   - `update` と `audit_logs.insert` に型アサーション追加
   - `currentSettingsTyped` のスコープ問題を修正

6. **`app/api/admin/menus/[id]/route.ts`**
   - `profile` の型アサーション追加
   - `update` と `audit_logs.insert` に型アサーション追加
   - DELETE 時の `data` 型アサーション追加

7. **`app/api/admin/menus/route.ts`**
   - `profile` の型アサーション追加
   - `insert` 操作に型アサーション追加
   - `audit_logs.insert` に型アサーション追加
   - `supabaseAdmin` を使用するように変更

8. **`app/api/admin/orders/today/pdf/route.ts`**
   - `profile` の型アサーション追加
   - `companySettings` の型アサーション追加
   - `logData` の型アサーション追加
   - `pdfBuffer` を `any` にキャスト

9. **`app/api/admin/prices/[id]/route.ts`**
   - `profile` の型アサーション追加
   - `audit_logs.insert` に型アサーション追加

10. **`app/api/admin/prices/route.ts`**
    - `profile` の型アサーション追加
    - `audit_logs.insert` に型アサーション追加

11. **`app/api/admin/reports/csv-by-user/route.ts`**
    - `profile` の型アサーション追加
    - `period` の型アサーション追加

12. **`app/api/admin/reports/csv/route.ts`**
    - `profile` の型アサーション追加
    - `period` の型アサーション追加

13. **`app/api/admin/reports/summary/route.ts`**
    - `profile` の型アサーション追加
    - `period` の型アサーション追加

14. **`app/api/admin/users/[id]/approve/route.ts`**
    - `profile` の型アサーション統合
    - `targetUser` の型アサーション追加
    - `update` と `audit_logs.insert` に型アサーション追加

15. **`app/api/admin/users/[id]/reject/route.ts`**
    - `profile` の型アサーション統合
    - `targetUser` の型アサーション追加
    - `update` と `audit_logs.insert` に型アサーション追加

16. **`app/api/admin/users/[id]/route.ts`**
    - `params` を `Promise` 型に変更
    - `profile` の型アサーション統合
    - `currentUser` の型アサーション追加
    - `newEmployeeCodeMaster` と `oldEmployeeCodeMaster` の型アサーション追加
    - `update` と `audit_logs.insert` に型アサーション追加

17. **`app/api/admin/users/deactivate-expired/route.ts`**
    - `expiredUsers` の型アサーション追加
    - `update` 操作に型アサーション追加

18. **`app/api/admin/users/pending/route.ts`**
    - `profile` の型アサーション統合
    - `data` の型アサーション追加

19. **`app/api/admin/users/route.ts`**
    - `profile` の型アサーション統合

20. **`app/api/admin/vendors/[id]/route.ts`**
    - `update` 操作に型アサーション追加
    - DELETE 時の `data` 型アサーション追加

21. **`app/api/admin/vendors/route.ts`**
    - `insert` 操作に型アサーション追加
    - `audit_logs.insert` に型アサーション追加

#### Orders API Routes

22. **`app/api/orders/[id]/route.ts`**
    - `params` を `Promise` 型に変更
    - `orderDay` の型アサーション追加
    - `menu` の型アサーション追加
    - `priceInfo` の型アサーション追加
    - `currentProfile` の型アサーション追加
    - `order` の型アサーション追加
    - `update` と `audit_logs.insert` に型アサーション追加
    - `rpc` 呼び出しに型アサーション追加

23. **`app/api/orders/route.ts`**
    - `systemSettings` の型アサーション追加
    - `orderDay` の型アサーション追加
    - `menu` の型アサーション追加
    - `priceInfo` の型アサーション追加
    - `existingOrder` の型アサーション追加
    - `canceledOrders` の型アサーション追加
    - `orderedOrder` の型アサーション追加
    - `orderData` の型アサーション追加
    - `insert` と `audit_logs.insert` に型アサーション追加
    - `rpc` 呼び出しに型アサーション追加

### Page Components

24. **`app/(auth)/login/page.tsx`**
    - `profile` の型アサーション追加

25. **`app/(user)/layout.tsx`**
    - `profile` の型アサーション追加

26. **`app/(user)/calendar/page.tsx`**
    - `searchParams` を `Promise` 型に変更
    - `currentProfile` の型アサーション追加
    - `menuItems` の型アサーション追加
    - `orderDays` の型アサーション追加
    - `systemSettings` の型アサーション追加
    - `targetProfile` の型アサーション追加

27. **`app/(user)/orders/new/page.tsx`**
    - `searchParams` を `Promise` 型に変更
    - `currentProfile` の型アサーション追加
    - `systemSettings` の型アサーション追加
    - `orderDay` の型アサーション追加
    - `vendors` の型アサーション追加
    - `menuItems` の型アサーション追加

28. **`app/(user)/orders/[id]/edit/page.tsx`**
    - `params` を `Promise` 型に変更
    - `searchParams` を `Promise` 型に変更
    - `currentProfile` の型アサーション追加
    - `order` の型アサーション追加
    - `orderDay` の型アサーション追加
    - `vendors` の型アサーション追加
    - `menuItems` の型アサーション追加

29. **`app/admin/calendar/page.tsx`**
    - `systemSettings` の型アサーション追加
    - `orderDays` の型アサーション追加

30. **`app/admin/layout.tsx`**
    - `profile` の型アサーション追加

31. **`app/admin/logs/page.tsx`**
    - `profile` の型アサーション追加
    - `log` の型アサーション追加

32. **`app/admin/orders/today/page.tsx`**
    - `currentProfile` の型アサーション追加

33. **`app/admin/settings/page.tsx`**
    - `data` の型アサーション追加
    - `settings` の null チェック追加
    - `r` の型アサーション追加

### Utility Functions

34. **`lib/utils/api-helpers.ts`**
    - `profile` の型アサーション追加（`checkAdminPermission` 関数）
    - `profile` の型アサーション追加（`checkUserActive` 関数）

---

## 型アサーションのパターン

### 1. Profile オブジェクト

```typescript
const profileTyped = profile as { 
  role?: string; 
  is_active?: boolean; 
  left_date?: string | null; 
  [key: string]: any 
} | null;
```

### 2. Order オブジェクト

```typescript
const orderTyped = order as { 
  order_date?: string; 
  menu_item_id?: number; 
  quantity?: number; 
  user_id?: string; 
  [key: string]: any 
};
```

### 3. OrderDay オブジェクト

```typescript
const orderDayTyped = orderDay as { 
  is_available?: boolean; 
  deadline_time?: string | null; 
  [key: string]: any 
} | null;
```

### 4. SystemSettings オブジェクト

```typescript
const systemSettingsTyped = systemSettings as { 
  max_order_days_ahead?: number | null; 
  [key: string]: any 
} | null;
```

### 5. Supabase 操作の型アサーション

```typescript
// Insert
await (supabaseAdmin.from('table_name') as any).insert({ ... });

// Update
await (supabaseAdmin.from('table_name') as any).update({ ... });

// Upsert
await (supabaseAdmin.from('table_name') as any).upsert({ ... });

// RPC
await (supabaseAdmin.rpc as any)('function_name', { ... });
```

---

## エラー解決の流れ

### エラー 1: `params` の型エラー

```
Type error: Type '{ params: { id: string; }; }' is not assignable to type '{ params: Promise<{ id: string; }>; }'
```

**解決**: `params` の型を `Promise<{ id: string }>` に変更し、`await Promise.resolve(params)` で解決

### エラー 2: `searchParams` の型エラー

```
Type error: Type '{ searchParams: { year?: string; ... } }' does not satisfy the constraint 'PageProps'
```

**解決**: `searchParams` の型を `Promise<{ ... }>` に変更し、`instanceof Promise` でチェックして解決

### エラー 3: プロパティアクセスの型エラー

```
Type error: Property 'role' does not exist on type 'never'
```

**解決**: 型アサーションを追加してオブジェクトの構造を明示

### エラー 4: Supabase 操作の型エラー

```
Type error: Argument of type '{ ... }' is not assignable to parameter of type 'never'
```

**解決**: `as any` を使用して型チェックをバイパス

---

## ベストプラクティス

### 1. Promise 型の処理

```typescript
// 推奨: instanceof チェック
const params = searchParams instanceof Promise 
  ? await searchParams 
  : searchParams;

// または: Promise.resolve を使用
const resolvedParams = await Promise.resolve(params);
```

### 2. 型アサーションの一貫性

同じオブジェクト型に対しては、統一された型アサーションパターンを使用：

```typescript
// 統一されたパターン
type ProfileType = { 
  role?: string; 
  is_active?: boolean; 
  [key: string]: any 
} | null;

const profileTyped = profile as ProfileType;
```

### 3. Null チェック

型アサーション後も null チェックを実施：

```typescript
const profileTyped = profile as ProfileType;
if (!profileTyped || !profileTyped.is_active) {
  // エラーハンドリング
}
```

---

## テスト

### ビルドテスト

```bash
npm run build
```

すべての型エラーが解消され、ビルドが成功することを確認。

### デプロイテスト

Vercel へのデプロイが成功することを確認。

---

## 今後の対応

### 1. 型定義の改善

Supabase の型定義を改善し、型アサーションを減らす：

- `database.types.ts` の型定義を確認
- Supabase の型生成ツールを活用

### 2. 型安全性の向上

`as any` の使用を減らし、より具体的な型定義を使用：

```typescript
// 改善前
await (supabaseAdmin.from('table_name') as any).insert({ ... });

// 改善後（理想）
await supabaseAdmin.from('table_name').insert<TableInsert>({ ... });
```

### 3. コードレビュー

型アサーションの使用箇所をレビューし、より適切な型定義に置き換える。

---

## 関連ドキュメント

- [CHANGELOG.md](./CHANGELOG.md) - 変更履歴
- [DECISIONS.md](./DECISIONS.md) - 設計判断
- [PROGRESS.md](./PROGRESS.md) - 進捗状況

---

## まとめ

Next.js 16.1.1 の型システム変更に対応するため、以下の修正を実施：

1. **Route Handlers**: `params` を `Promise` 型に対応
2. **Page Components**: `searchParams` を `Promise` 型に対応
3. **型アサーション**: Supabase クエリ結果に型アサーションを追加
4. **Supabase 操作**: `insert`/`update`/`upsert` 操作に型アサーションを追加

**結果**: すべての型エラーを解消し、Vercel へのデプロイが成功。

---

最終更新日: 2025-01-XX
