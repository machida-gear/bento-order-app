# テストガイド

このドキュメントでは、プロジェクトのテスト戦略とテストの書き方について説明します。

## テスト環境

- **テストフレームワーク**: Jest
- **React Testing Library**: コンポーネントテスト用
- **テスト環境**: jest-environment-jsdom

## テストの実行

```bash
# すべてのテストを実行
npm test

# ウォッチモードで実行
npm run test:watch

# カバレッジレポートを生成
npm run test:coverage
```

## テストの種類

### 1. ユニットテスト

個々の関数やユーティリティ関数のテストです。

#### 例: バリデーション関数のテスト

```typescript
// lib/utils/api-helpers.test.ts
import { validateQuantity } from './api-helpers'

describe('validateQuantity', () => {
  it('正の整数はエラーを投げない', () => {
    expect(() => validateQuantity(1)).not.toThrow()
  })

  it('0はエラーを投げる', () => {
    expect(() => validateQuantity(0)).toThrow(ApiError)
  })
})
```

### 2. コンポーネントテスト

Reactコンポーネントのテストです。React Testing Libraryを使用します。

#### セットアップ

コンポーネントテストは、Next.jsのApp Routerの特性を考慮して実装する必要があります。

```typescript
import { render, screen } from '@testing-library/react'
import Component from './Component'

describe('Component', () => {
  it('正しくレンダリングされる', () => {
    render(<Component />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })
})
```

### 3. API Routeテスト

API Routeのテストは、統合テストとして実装します。

#### 注意事項

- NextResponseはNode.js環境では直接テストできないため、統合テストとして実装します
- Supabaseクライアントはモックを使用します
- 実際のデータベースへの接続は行いません

#### モックの例

```typescript
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}))
```

## テストカバレッジ

現在、テストカバレッジの目標は設定していませんが、将来的には以下の目標を設定することを推奨します：

- **ステートメント**: 80%以上
- **ブランチ**: 70%以上
- **関数**: 80%以上
- **行**: 80%以上

## テストファイルの配置

テストファイルは、対象のファイルと同じディレクトリに配置します：

```
lib/
  utils/
    api-helpers.ts
    api-helpers.test.ts
    errors.ts
    errors.test.ts
```

または、`__tests__`ディレクトリに配置することもできます：

```
lib/
  utils/
    api-helpers.ts
    __tests__/
      api-helpers.test.ts
```

## ベストプラクティス

1. **テストは独立させる**: 各テストは他のテストに依存しないようにします
2. **アサーションは明確に**: テストの意図が明確になるようにアサーションを書きます
3. **モックは適切に**: 外部依存（データベース、APIなど）はモックを使用します
4. **エッジケースをテスト**: 正常系だけでなく、エラーハンドリングもテストします
5. **テスト名は説明的に**: テスト名から何をテストしているかが分かるようにします

## 今後の課題

- [ ] API Routeの統合テストの実装
- [ ] コンポーネントテストの追加
- [ ] E2Eテストのセットアップ（PlaywrightまたはCypress）
- [ ] CI/CDパイプラインでのテスト自動実行
