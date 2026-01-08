# audit_logs.actor_id 外部キー制約修正手順

## 概要

`audit_logs.actor_id` が `auth.users(id)` を参照している外部キー制約を `ON DELETE SET NULL` に変更します。

これにより、Authユーザーを削除した際に：
- 監査ログは**保持**される（削除されない）
- `actor_id` は **NULL** になる

## 問題の原因

現在、`audit_logs.actor_id` の外部キー制約が `ON DELETE RESTRICT`（デフォルト）になっているため、監査ログが残っているユーザーを削除しようとすると、データベースが削除を拒否します。

エラーメッセージ：
```
Failed to delete selected users: Database error deleting user
```

## 解決方法

外部キー制約を `ON DELETE SET NULL` に変更することで、ユーザー削除時に `actor_id` が自動的に NULL になり、監査ログは保持されます。

## 実行手順

### ステップ1: 実行前の確認

**ファイル**: `064_check_audit_logs_fk_before_migration.sql`

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

**ファイル**: `064_fix_audit_logs_actor_id_fk_set_null.sql`

Supabase SQL Editor で実行します。

**実行内容**:
1. 外部キー制約名の自動検出
2. `actor_id` カラムを NULL 許可に変更（必要なら）
3. 既存の外部キー制約を削除
4. 新しい外部キー制約を `ON DELETE SET NULL` で作成
5. 整合性チェック（孤児レコードの確認）

**注意**: このマイグレーションは **冪等性** を持っています。複数回実行しても安全です。

### ステップ3: 実行後の確認

**ファイル**: `064_verify_audit_logs_fk_after_migration.sql`

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

## ファイル一覧

| ファイル名 | 説明 | 実行順序 |
|-----------|------|---------|
| `064_check_audit_logs_fk_before_migration.sql` | 実行前の確認SQL | 1 |
| `064_fix_audit_logs_actor_id_fk_set_null.sql` | マイグレーションSQL | 2 |
| `064_verify_audit_logs_fk_after_migration.sql` | 実行後の確認SQL | 3 |
| `064_README_audit_logs_fk_fix.md` | このドキュメント | - |

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

## 関連ドキュメント

- [Supabase Documentation - Foreign Keys](https://supabase.com/docs/guides/database/foreign-keys)
- [PostgreSQL Documentation - Foreign Keys](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK)
