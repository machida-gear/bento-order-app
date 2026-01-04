# テスト実行ガイド

このプロジェクトでは、JestとReact Testing Libraryを使用してテストを実装しています。

## クイックスタート

```bash
# すべてのテストを実行
npm test

# ウォッチモードで実行（開発中に便利）
npm run test:watch

# カバレッジレポートを生成
npm run test:coverage
```

## テストの種類

### ユニットテスト

個々の関数やユーティリティ関数のテストです。

実行例：
```bash
npm test -- lib/utils/api-helpers.test.ts
```

### コンポーネントテスト

Reactコンポーネントのテストです（今後実装予定）。

### API Routeテスト

API Routeの統合テストです（今後実装予定）。

## 詳細

詳細な情報は、`docs/TESTING.md`を参照してください。
