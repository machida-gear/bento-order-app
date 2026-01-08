# カレンダーページMap型シリアライズ問題の解決

## 問題の概要

カレンダーページが動かなくなってしまった。タップもできないし、注文可能日の注文ボタンも表示されない。唯一表示月の表示のみ変更できる。ローカルでは動くが、デプロイした本番環境では動かない。

## 原因

### 1. Map型のシリアライズ問題

Next.jsでは、サーバーコンポーネントからクライアントコンポーネントに渡すpropsは、JSONシリアライズ可能である必要があります。`Map`型はシリアライズできないため、クライアントコンポーネントに正しく渡されていませんでした。

**問題のコード**:
```typescript
// app/(user)/calendar/page.tsx
const orderDaysMap = new Map(
  (orderDays || []).map((day: any) => [day.target_date, day])
);
const ordersMap = new Map<string, (typeof ordersWithMenu)[0]>();

// ...

<CalendarGrid
  orderDaysMap={orderDaysMap}  // Map型はシリアライズできない
  ordersMap={ordersMap}        // Map型はシリアライズできない
  ...
/>
```

**症状**:
- ビルド時にはエラーが出ない
- 実行時に`orderDaysMap`や`ordersMap`が`undefined`になる
- カレンダーグリッドが正しく表示されない
- 注文可能日のボタンが表示されない

### 2. TypeScript型エラー

`targetProfileResult.data`の型が正しく推論されず、`never`型として推論されていました。

**問題のコード**:
```typescript
const targetProfileResult = await supabase
  .from("profiles")
  .select("id, full_name, is_active")
  .eq("id", params.user_id)
  .single();

if (targetProfileResult.data) {  // 型エラー: Property 'data' does not exist on type 'never'
  const profileData = targetProfileResult.data as { ... };
}
```

### 3. useSearchParams Suspenseバウンダリ

Next.js 16では、`useSearchParams()`を使用するコンポーネントは`Suspense`バウンダリでラップする必要があります。

**問題のコード**:
```typescript
// app/(auth)/login/page.tsx
export default function LoginPage() {
  const searchParams = useSearchParams();  // Suspenseバウンダリが必要
  // ...
}
```

**エラーメッセージ**:
```
useSearchParams() should be wrapped in a suspense boundary at page "/login"
```

## 解決策

### 1. Map型をオブジェクトに変換

`Map`型を通常のオブジェクト（`Record<string, T>`）に変換しました。

**修正後**:
```typescript
// app/(user)/calendar/page.tsx
// Map型はサーバーコンポーネントからクライアントコンポーネントに渡せないため、通常のオブジェクトに変換
const orderDaysMapObj: Record<string, any> = {};
(orderDays || []).forEach((day: any) => {
  orderDaysMapObj[day.target_date] = day;
});

const ordersMapObj: Record<string, (typeof ordersWithMenu)[0]> = {};
for (const order of ordersWithMenu) {
  const dateKey = /* 日付を文字列に変換 */;
  if (!ordersMapObj[dateKey]) {
    ordersMapObj[dateKey] = order;
  }
}

// ...

<CalendarGrid
  orderDaysMap={orderDaysMapObj}  // オブジェクト型（シリアライズ可能）
  ordersMap={ordersMapObj}        // オブジェクト型（シリアライズ可能）
  ...
/>
```

### 2. クライアントコンポーネントでMap型とオブジェクト型の両方に対応

`CalendarGrid`コンポーネントで、`Map`型とオブジェクト型の両方に対応するように修正しました。

**修正後**:
```typescript
// components/calendar-grid.tsx
interface CalendarGridProps {
  orderDaysMap: Map<string, OrderDay> | Record<string, OrderDay>;
  ordersMap: Map<string, Order> | Record<string, Order>;
  // ...
}

export default function CalendarGrid({ ... }: CalendarGridProps) {
  // ...

  // オブジェクト型の場合の安全なアクセス
  let orderDay: OrderDay | undefined;
  let order: Order | undefined;
  
  try {
    if (orderDaysMap instanceof Map) {
      orderDay = orderDaysMap.get(dateStr);
    } else if (orderDaysMap && typeof orderDaysMap === 'object' && !Array.isArray(orderDaysMap)) {
      orderDay = (orderDaysMap as Record<string, OrderDay>)[dateStr];
    }
  } catch (error) {
    console.error('Error accessing orderDaysMap:', error);
  }
  
  // 同様にordersMapも処理
}
```

### 3. TypeScript型エラーの修正

型アサーションを使用して、`targetProfileResult`の型を明示的に指定しました。

**修正後**:
```typescript
const targetProfileResult = await supabase
  .from("profiles")
  .select("id, full_name, is_active")
  .eq("id", params.user_id)
  .single() as { data: { id: string; full_name: string; is_active: boolean } | null; error: any };

if (targetProfileResult.data) {
  const profileData = targetProfileResult.data;
  // ...
}
```

### 4. useSearchParams Suspenseバウンダリの対応

`useSearchParams()`を使用するコンポーネントを`Suspense`でラップしました。

**修正後**:
```typescript
// app/(auth)/login/page.tsx
import { Suspense } from "react";

function LoginPageContent() {
  const searchParams = useSearchParams();
  // ...
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p>読み込み中...</p>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
```

### 5. エラーハンドリングとログの追加

本番環境での問題を特定しやすくするため、エラーハンドリングとデバッグログを追加しました。

**追加内容**:
- オブジェクトアクセス時のtry-catch
- 本番環境でも動作するデバッグログ（ブラウザのコンソールに出力）
- propsが正しく渡されているかの確認ログ

## 修正ファイル

- `app/(user)/calendar/page.tsx`:
  - `Map`型を`Record<string, T>`型に変換
  - `targetProfileResult`の型を明示的に指定（2箇所）
  
- `components/calendar-grid.tsx`:
  - `Map`型とオブジェクト型の両方に対応するアクセス方法を実装
  - エラーハンドリングとログを追加
  - propsの型定義を更新
  
- `app/(auth)/login/page.tsx`:
  - `useSearchParams()`を使用するコンポーネントを`Suspense`でラップ
  - `LoginPageContent`コンポーネントに分離
  - フォールバックUIを追加

## 確認事項

- ✅ カレンダーページが正常に表示される
- ✅ 注文可能日の「注文可」ボタンが表示される
- ✅ 「注文可」ボタンをクリックして注文ページに遷移できる
- ✅ ビルドが成功する（TypeScriptエラーなし）
- ✅ 本番環境でも正常に動作する
- ✅ ログインページが正常に表示される（Suspenseバウンダリ対応）

## 学んだこと

### Next.jsのシリアライズ制限

Next.jsでは、サーバーコンポーネントからクライアントコンポーネントに渡すpropsは、JSONシリアライズ可能である必要があります。

**シリアライズ可能な型**:
- `string`、`number`、`boolean`
- `null`、`undefined`
- 配列
- 通常のオブジェクト（プレーンオブジェクト）

**シリアライズ不可な型**:
- `Map`、`Set`
- `Date`（文字列に変換する必要がある）
- `Function`
- `RegExp`

### useSearchParams Suspense要件

Next.js 16では、`useSearchParams()`を使用するコンポーネントは必ず`Suspense`バウンダリでラップする必要があります。これにより、サーバーサイドレンダリング時にエラーが発生するのを防ぎます。

### デバッグの重要性

本番環境での問題を特定するためには、デバッグログが重要です。ブラウザのコンソールにログを出力することで、実行時の状態を確認できます。

## 関連ドキュメント

- [CHANGELOG.md](./CHANGELOG.md) - 変更履歴
- [DECISIONS.md](./DECISIONS.md) - 設計判断
- [PROGRESS.md](./PROGRESS.md) - 進捗状況
- [SPEC.md](./SPEC.md) - システム仕様書
