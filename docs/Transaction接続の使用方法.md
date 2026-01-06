# Transaction接続（6543）の使用方法

## 概要

SupabaseのTransaction connection（ポート6543）を使用することで、接続プールを活用し、パフォーマンスが向上します。

### 接続方法の比較

- **REST API経由（現在）**: `SUPABASE_SERVICE_ROLE_KEY`を使用してHTTP経由で接続
  - メリット: 実装が簡単、RLSが自動的に適用される
  - デメリット: 毎回HTTPリクエストが必要で、やや遅い

- **Direct connection (5432)**: 直接PostgreSQL接続
  - メリット: 高速
  - デメリット: 接続の確立に時間がかかる（ハンドシェイク）

- **Transaction connection (6543)**: 接続プーラー経由のPostgreSQL接続（推奨）
  - メリット: 接続プールを活用し、高速で効率的
  - デメリット: 実装がやや複雑

## 設定方法

### 1. Vercelでの環境変数設定

1. Vercelダッシュボードでプロジェクトを開く
2. 「Settings」→「Environment Variables」を開く
3. 以下の環境変数を追加：
   - **Key**: `DATABASE_URL`
   - **Value**: Supabase Dashboard > Project Settings > Database > Connection string > **Transaction** から取得
     - 形式: `postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true`
   - **Environment**: Production, Preview, Developmentすべてにチェック
4. 「Save」をクリック
5. 再デプロイを実行

### 2. Supabase Dashboardでの確認

1. Supabase Dashboardにログイン
2. プロジェクトを選択
3. 「Project Settings」→「Database」を開く
4. 「Connection string」セクションで「Transaction」を選択
5. 接続文字列をコピー（ポート6543を使用していることを確認）

## 使用方法

### 基本的なクエリ実行

```typescript
import { queryDatabase } from '@/lib/database/query';

// 単一のクエリを実行
const result = await queryDatabase(async (client) => {
  const { rows } = await client.query(
    'SELECT * FROM profiles WHERE id = $1',
    [userId]
  );
  return rows[0];
});
```

### 複数のクエリを実行

```typescript
import { queryDatabase } from '@/lib/database/query';

const result = await queryDatabase(async (client) => {
  // 複数のクエリを同じ接続で実行
  const { rows: profiles } = await client.query('SELECT * FROM profiles');
  const { rows: orders } = await client.query('SELECT * FROM orders');
  
  return { profiles, orders };
});
```

### トランザクションを使用

```typescript
import { transaction } from '@/lib/database/query';

const result = await transaction(async (client) => {
  // トランザクション内で複数の操作を実行
  await client.query('INSERT INTO orders (...) VALUES (...)');
  await client.query('UPDATE profiles SET ... WHERE ...');
  
  // エラーが発生した場合、自動的にROLLBACKされる
  return { success: true };
});
```

### 既存のSupabaseクライアントとの併用

現在のSupabaseクライアント（`supabaseAdmin`）と併用できます：

```typescript
import { supabaseAdmin } from '@/lib/supabase/admin';
import { queryDatabase } from '@/lib/database/query';

// パフォーマンスが重要なクエリは直接PostgreSQL接続を使用
const fastData = await queryDatabase(async (client) => {
  const { rows } = await client.query('SELECT * FROM orders WHERE ...');
  return rows;
});

// その他のクエリはSupabaseクライアントを使用
const { data } = await supabaseAdmin.from('profiles').select('*');
```

## 移行戦略

すべてのクエリを一度に置き換える必要はありません。段階的に移行できます：

1. **パフォーマンスが重要なクエリから移行**
   - 頻繁に実行されるクエリ
   - 大量のデータを扱うクエリ
   - 複雑なJOINを含むクエリ

2. **既存のSupabaseクライアントは維持**
   - シンプルなクエリはSupabaseクライアントのまま
   - 認証関連の処理はSupabaseクライアントを使用

3. **段階的なテスト**
   - 1つのAPI Routeから始める
   - 動作確認後、他のRouteに拡張

## 注意事項

- **サーバーサイドでのみ使用可能**: `DATABASE_URL`はクライアントサイドでは使用できません
- **RLSの適用**: 直接PostgreSQL接続では、Row Level Security（RLS）が自動的に適用されません。必要に応じて手動で実装してください
- **エラーハンドリング**: 接続エラーやタイムアウトに対する適切なエラーハンドリングを実装してください

## パフォーマンスの比較

Transaction connection (6543)を使用することで、以下のような改善が期待できます：

- **接続確立時間**: 接続プールにより、新規接続の確立が不要
- **レスポンス時間**: 特に複数のクエリを実行する場合、大幅に高速化
- **スループット**: 同時接続数の制限を効率的に管理

## トラブルシューティング

### 接続エラーが発生する場合

1. `DATABASE_URL`が正しく設定されているか確認
2. ポートが6543であることを確認（Transaction connection）
3. `pgbouncer=true`パラメータが含まれているか確認

### パフォーマンスが改善しない場合

1. 接続プールの設定を調整（`lib/database/pool.ts`）
2. クエリの最適化を検討
3. インデックスの確認

## 関連ファイル

- `lib/database/pool.ts`: 接続プールの管理
- `lib/database/query.ts`: クエリヘルパー関数
- `lib/utils/database.ts`: DATABASE_URLの取得ユーティリティ
