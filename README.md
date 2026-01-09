# お弁当注文 Web アプリケーション

Next.js 16.1.1 (App Router) と Supabase を使用した社員向けお弁当注文システムです。

> 📖 **ドキュメント**: [docs/README.md](./docs/README.md) を参照してください。すべてのドキュメントへの参照と分類が記載されています。

---

## プロジェクト概要

このプロジェクトは、社員がお弁当を注文するための Web アプリケーションです。

### 主な機能

- ユーザー認証（ログイン・新規登録）
- 注文カレンダー（注文可能日の表示・注文作成）
- 注文管理（注文一覧・編集・キャンセル）
- 自動注文機能（曜日別パターン設定）
- 管理者機能（ユーザー管理・メニュー管理・価格管理・レポート）

### 技術スタック

- **フレームワーク**: Next.js 16.1.1 (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **データベース**: Supabase (PostgreSQL)
- **認証**: Supabase Auth
- **デプロイ**: Vercel

---

## ドキュメント

### 基本ドキュメント

- **[docs/README.md](./docs/README.md)** - すべてのドキュメントへの参照と分類
- **[docs/CHANGELOG.md](./docs/CHANGELOG.md)** - 変更履歴
- **[docs/DECISIONS.md](./docs/DECISIONS.md)** - 設計判断
- **[docs/PROGRESS.md](./docs/PROGRESS.md)** - 進捗状況
- **[docs/SPEC.md](./docs/SPEC.md)** - システム仕様書
- **[docs/TODO.md](./docs/TODO.md)** - 実装タスク一覧

### 最新の変更

- **[カレンダーページ13日セル表示問題修正.md](./docs/カレンダーページ13日セル表示問題修正.md)** - カレンダーページの13日セル表示問題修正（`order.order_date`がDateオブジェクトの場合の処理追加、Hydration Mismatch再発修正）
- **[カレンダーページ過去注文・ちらつき問題修正.md](./docs/カレンダーページ過去注文・ちらつき問題修正.md)** - カレンダーページの過去注文クリック・月変更時のちらつき問題修正（`canEditOrder()`削除、`shouldBeGray`チェック修正、`localStorage`による状態保持）
- **[カレンダーページ全日付グレーアウト問題修正.md](./docs/カレンダーページ全日付グレーアウト問題修正.md)** - カレンダーページの全日付グレーアウト問題修正（`target_date`フォーマット正規化）
- **[カレンダーページHydration Mismatchエラー修正.md](./docs/カレンダーページHydration Mismatchエラー修正.md)** - カレンダーページのHydration Mismatchエラー修正（React error #418）
- **[Next.js16型エラー修正とVercelデプロイ対応.md](./docs/Next.js16型エラー修正とVercelデプロイ対応.md)** - Next.js 16.1.1 の型エラー修正と Vercel デプロイ対応

---

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
