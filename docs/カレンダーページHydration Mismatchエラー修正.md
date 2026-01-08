# カレンダーページHydration Mismatchエラー修正

## 問題の概要

注文カレンダーがローカル環境では正常に動作するが、デプロイした本番環境では正しく動かない問題が発生しました。コンソールにReact error #418（hydration mismatch）エラーが表示されていました。

## 問題の詳細

### 症状

- ローカル環境では正常に動作
- 本番環境（Vercel）ではカレンダーが正しく表示されない
- ブラウザコンソールに以下のエラーが表示される：
  ```
  Uncaught Error: Minified React error #418
  ```

### 原因

1. **サーバーとクライアントでの日付計算の不一致**
   - `CalendarGrid`コンポーネント内で`new Date()`を直接使用していた
   - サーバー側（UTC）とクライアント側（ローカルタイムゾーン）で異なる日付が計算される
   - 例：サーバー側で`new Date()`がUTC 00:00を返す場合、クライアント側（JST）では09:00になる

2. **Hydration Mismatch**
   - サーバー側で生成されたHTMLとクライアント側で生成されたHTMLが一致しない
   - Reactのhydration処理で、サーバー側のHTMLとクライアント側のHTMLが一致しないとエラーが発生

3. **タイムゾーンの違い**
   - サーバー側はUTCで実行される
   - クライアント側はJST（またはユーザーのローカルタイムゾーン）で実行される
   - `new Date()`の結果が異なるため、日付計算が一致しない

## 解決策

### 1. クライアント側でのみ日付を計算

`CalendarGrid`コンポーネント内で`new Date()`を直接使用するのではなく、`useState`と`useEffect`を使用して、クライアント側でのみ日付を計算するように変更しました。

```typescript
// 修正前
const today = new Date();
const now = new Date();

// 修正後
const [today, setToday] = useState<Date | null>(null);
const [now, setNow] = useState<Date | null>(null);
const [isMounted, setIsMounted] = useState(false);

useEffect(() => {
  // クライアント側でのみ実行
  setIsMounted(true);
  const currentDate = new Date();
  setToday(currentDate);
  setNow(new Date());
}, []);
```

### 2. サーバー側レンダリング時のフォールバック

`isMounted`フラグを使用して、クライアント側でマウントされるまで空のカレンダーを表示するようにしました。これにより、サーバーとクライアントで同じHTMLが生成され、hydration mismatchを防止します。

```typescript
// サーバー側レンダリング時は空の状態を返す（hydration mismatchを防ぐ）
if (!isMounted || !today || !now) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-2 sm:p-3 md:p-2">
      {/* 空のカレンダー構造 */}
    </div>
  );
}
```

### 3. CalendarCellコンポーネントへのprops追加

`CalendarCell`コンポーネント内で`new Date()`を呼び出していた箇所を修正し、`today`と`now`をpropsとして渡すように変更しました。

```typescript
// 修正前
function CalendarCell({ ... }: CalendarCellProps) {
  const today = new Date();
  const now = new Date();
  // ...
}

// 修正後
interface CalendarCellProps {
  // ...
  today: Date;
  now: Date;
}

function CalendarCell({ today, now, ... }: CalendarCellProps) {
  // todayとnowをpropsから受け取る
}
```

### 4. nullチェックの追加

`canOrder`関数内で`now`を使用する際のnullチェックを追加しました。

```typescript
// 今日の場合、締切時刻をチェック
if (isToday(date) && orderDay.deadline_time && now) {
  const [hours, minutes] = orderDay.deadline_time.split(":").map(Number);
  const deadline = new Date(today);
  deadline.setHours(hours, minutes, 0, 0);

  if (now >= deadline) return false;
}
```

## 修正ファイル

- `components/calendar-grid.tsx`:
  - `useState`と`useEffect`を使用してクライアント側でのみ日付を計算
  - サーバー側レンダリング時のフォールバック処理を追加
  - `CalendarCell`コンポーネントに`today`と`now`をpropsとして渡すように変更
  - `CalendarCell`内の`new Date()`呼び出しを削除

## 確認事項

- ✅ カレンダーページが正常に表示される（ローカル環境・本番環境）
- ✅ React error #418（hydration mismatch）エラーが解消される
- ✅ サーバーとクライアントで同じHTMLが生成される
- ✅ 日付計算がクライアント側のタイムゾーンで正しく実行される

## 注意事項

### Hydration Mismatchの防止

- サーバーとクライアントで異なる結果を返す可能性がある処理（`new Date()`など）は、クライアント側でのみ実行する必要があります
- `useEffect`を使用して、クライアント側でのみ実行する処理を分離します

### useEffectの使用

- クライアント側でのみ実行する処理は`useEffect`内で実行し、`isMounted`フラグで制御します
- これにより、サーバー側レンダリング時とクライアント側レンダリング時で同じHTMLが生成されます

### フォールバックUI

- サーバー側レンダリング時は、クライアント側でマウントされるまで空の状態を表示することで、hydration mismatchを防止します
- 空の状態は、実際のカレンダーと同じ構造を持つ必要があります（同じクラス名、同じ要素数など）

## 関連ドキュメント

- [CHANGELOG.md](./CHANGELOG.md) - 変更履歴
- [カレンダーページMap型シリアライズ問題の解決.md](./カレンダーページMap型シリアライズ問題の解決.md) - 以前のMap型シリアライズ問題の解決
- [SPEC.md](./SPEC.md) - システム仕様書（サーバーコンポーネントとクライアントコンポーネントのprops渡し制限）

## 参考情報

- [React Error #418](https://react.dev/errors/418) - React公式ドキュメント
- [Next.js Hydration](https://nextjs.org/docs/messages/react-hydration-error) - Next.js公式ドキュメント
