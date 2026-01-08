# audit_logs.actor_id 外部キー制約修正：ユーザー削除時の監査ログ保持

## 概要

Supabase Authユーザー削除時に「Failed to delete selected users: Database error deleting user」エラーが発生する問題を解決しました。

`audit_logs.actor_id` が `auth.users(id)` を参照している外部キー制約を `ON DELETE SET NULL` に変更することで、ユーザー削除時に監査ログを保持したまま削除可能にしました。

## 問題の原因

- `audit_logs.actor_id` の外部キー制約が `ON DELETE RESTRICT`（デフォルト）になっていた
- 監査ログが残っているユーザーを削除しようとすると、データベースが削除を拒否していた
- エラーメッセージ: `Failed to delete selected users: Database error deleting user`

## 解決策

外部キー制約を `ON DELETE SET NULL` に変更することで、以下のように動作するようになりました：

- ✅ 監査ログは**削除されない**（保持される）
- ✅ ユーザー削除時、`actor_id` は自動的に **NULL** になる
- ✅ ユーザー削除時にエラーが発生しない

## 実装内容

### 作成したマイグレーションファイル

1. **`064_check_audit_logs_fk_before_migration.sql`** - 実行前の確認SQL
   - 外部キー制約の現在の状態を確認
   - `actor_id` カラムのNULL許可状態を確認
   - 孤児レコード（存在しない `actor_id`）の確認

2. **`064_fix_audit_logs_actor_id_fk_set_null.sql`** - メインのマイグレーションSQL
   - 外部キー制約名の自動検出
   - `actor_id` カラムを NULL 許可に変更（必要なら）
   - 外部キー制約を `ON DELETE SET NULL` に変更
   - 整合性チェックと確認クエリを含む

3. **`064_verify_audit_logs_fk_after_migration.sql`** - 実行後の確認SQL
   - マイグレーション成功の確認
   - 動作確認テスト手順

4. **`064_README_audit_logs_fk_fix.md`** - 実行手順ドキュメント
   - 詳細な実行手順
   - トラブルシューティング

### 技術的な修正

#### 型エラーの修正

初期実装で以下の型エラーが発生：

```
ERROR: operator does not exist: integer[] @> smallint[]
```

**原因**: `conkey` は `smallint[]` 型だが、`conkey::int[]` として `int[]` にキャストしていたため型の不一致が発生

**解決策**: `conkey::int[]` のキャストを削除し、`ARRAY(SELECT attnum ...)` 形式に変更して PostgreSQL に型推論を任せるように修正

**修正前**:
```sql
AND conkey::int[] @> ARRAY[(SELECT attnum ...)::smallint]
```

**修正後**:
```sql
AND conkey @> ARRAY(SELECT attnum ...)
```

## 実行手順

### ステップ1: 実行前の確認

**ファイル**: `supabase/migrations/064_check_audit_logs_fk_before_migration.sql`

Supabase SQL Editor で実行して、現在の状態を確認します。

**確認項目**:
- ✅ 外部キー制約が存在するか
- ✅ `actor_id` カラムが NULL 許可かどうか
- ✅ 孤児レコード（存在しない `actor_id`）がないか

**孤児レコードが見つかった場合**:
マイグレーション実行前に、以下を実行して修正してください：

```sql
UPDATE audit_logs al
SET actor_id = NULL
WHERE actor_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = al.actor_id);
```

### ステップ2: マイグレーション実行

**ファイル**: `supabase/migrations/064_fix_audit_logs_actor_id_fk_set_null.sql`

Supabase SQL Editor で実行します。

**実行内容**:
1. 外部キー制約名の自動検出
2. `actor_id` カラムを NULL 許可に変更（必要なら）
3. 既存の外部キー制約を削除
4. 新しい外部キー制約を `ON DELETE SET NULL` で作成
5. 整合性チェック（孤児レコードの確認）

**注意**: このマイグレーションは **冪等性** を持っています。複数回実行しても安全です。

### ステップ3: 実行後の確認

**ファイル**: `supabase/migrations/064_verify_audit_logs_fk_after_migration.sql`

Supabase SQL Editor で実行して、マイグレーションが正常に完了したことを確認します。

**確認項目**:
- ✅ 外部キー制約が `ON DELETE SET NULL` になっているか
- ✅ `actor_id` カラムが NULL 許可になっているか
- ✅ 孤児レコードがないか

### ステップ4: 動作確認テスト（オプション）

実際にユーザーを削除して、動作を確認します。

**手順**:

1. **削除前の確認**
   ```sql
   -- 削除するユーザーのUUIDを指定
   SELECT count(*) 
   FROM audit_logs 
   WHERE actor_id = '<ユーザーUUID>';
   ```

2. **ユーザーを削除**
   - Supabase Dashboard > Authentication > Users から削除
   - または、管理APIから削除

3. **削除後の確認**
   ```sql
   -- actor_id が NULL になっていることを確認
   SELECT count(*) 
   FROM audit_logs 
   WHERE actor_id = '<ユーザーUUID>';
   -- → 結果が 0 になる（NULL化される）
   
   -- 監査ログ自体は残っていることを確認
   SELECT count(*) 
   FROM audit_logs 
   WHERE actor_id IS NULL;
   -- → 削除前より増加している
   ```

4. **監査ログの詳細確認**
   ```sql
   SELECT id, actor_id, action, created_at
   FROM audit_logs
   WHERE actor_id IS NULL
   ORDER BY created_at DESC
   LIMIT 10;
   -- → actor_id が NULL になっているが、ログ自体は残っている
   ```

## 確認事項

マイグレーション実行後、以下を確認してください：

- ✅ 外部キー制約が `ON DELETE SET NULL` になっている
- ✅ `actor_id` カラムが NULL 許可になっている
- ✅ 整合性チェックで問題がない（孤児レコードがない）

## 注意事項

1. **監査ログは削除されません**
   - ユーザー削除時、監査ログの行自体は削除されません
   - `actor_id` のみ NULL になります

2. **既存データへの影響**
   - 既存の監査ログデータには影響しません
   - マイグレーション実行後、新しくユーザーを削除した場合のみ `actor_id` が NULL になります

3. **冪等性**
   - このマイグレーションは複数回実行しても安全です
   - 既に `ON DELETE SET NULL` が設定されている場合、適切に処理されます

4. **ロールバック**
   - ロールバックが必要な場合は、外部キー制約を `ON DELETE RESTRICT` に戻す必要があります
   - ただし、既に NULL になった `actor_id` は元に戻りません

## トラブルシューティング

### エラー: "constraint does not exist"

**原因**: 外部キー制約が見つからない

**対処**: 
- `064_check_audit_logs_fk_before_migration.sql` を実行して、外部キー制約が存在するか確認してください
- `audit_logs.actor_id` が実際に `auth.users(id)` を参照しているか確認してください

### エラー: "permission denied"

**原因**: 権限不足

**対処**: 
- Supabase Dashboard で実行している場合、管理者権限があるか確認してください
- SQL Editor で実行している場合、適切なロールで実行しているか確認してください

### 孤児レコードが見つかった

**原因**: `auth.users` に存在しない `actor_id` が `audit_logs` に含まれている

**対処**: 
マイグレーション実行前に、以下のSQLを実行して修正してください：

```sql
UPDATE audit_logs al
SET actor_id = NULL
WHERE actor_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = al.actor_id);
```

## 関連ファイル

- `supabase/migrations/064_check_audit_logs_fk_before_migration.sql` - 実行前の確認SQL
- `supabase/migrations/064_fix_audit_logs_actor_id_fk_set_null.sql` - メインのマイグレーションSQL
- `supabase/migrations/064_verify_audit_logs_fk_after_migration.sql` - 実行後の確認SQL
- `supabase/migrations/064_README_audit_logs_fk_fix.md` - 実行手順ドキュメント

## 関連ドキュメント

- [CHANGELOG.md](./CHANGELOG.md) - 変更履歴
- [DECISIONS.md](./DECISIONS.md) - 設計判断
- [SPEC.md](./SPEC.md) - システム仕様書
