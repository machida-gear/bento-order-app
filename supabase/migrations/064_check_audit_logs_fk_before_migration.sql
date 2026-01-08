-- ============================================================
-- マイグレーション実行前の確認SQL
-- 
-- 目的: audit_logs.actor_id の外部キー制約の現在の状態を確認
-- 用途: 064_fix_audit_logs_actor_id_fk_set_null.sql 実行前に実行
-- 
-- 実行方法:
-- 1. Supabase SQL Editorで実行
-- 2. 結果を確認して、問題がないことを確認
-- 3. 問題がなければ 064_fix_audit_logs_actor_id_fk_set_null.sql を実行
-- ============================================================

-- ============================================================
-- 1. 外部キー制約名の確認
-- ============================================================

SELECT 
    '=== audit_logs.actor_id の外部キー制約一覧 ===' AS section;

SELECT 
    conname AS "制約名",
    pg_get_constraintdef(oid) AS "定義",
    CASE 
        WHEN pg_get_constraintdef(oid) LIKE '%ON DELETE SET NULL%' THEN '✅ 既に ON DELETE SET NULL'
        WHEN pg_get_constraintdef(oid) LIKE '%ON DELETE RESTRICT%' THEN '⚠️ ON DELETE RESTRICT（変更が必要）'
        WHEN pg_get_constraintdef(oid) LIKE '%ON DELETE CASCADE%' THEN '❌ ON DELETE CASCADE（変更が必要）'
        WHEN pg_get_constraintdef(oid) LIKE '%ON DELETE NO ACTION%' THEN '⚠️ ON DELETE NO ACTION（変更が必要）'
        ELSE '⚠️ ON DELETE 動作が未指定（デフォルト: RESTRICT相当）'
    END AS "状態"
FROM pg_constraint
WHERE contype = 'f'
  AND conrelid = 'audit_logs'::regclass
  AND conkey @> ARRAY(SELECT attnum 
                      FROM pg_attribute 
                      WHERE attrelid = 'audit_logs'::regclass 
                        AND attname = 'actor_id');

-- 外部キー制約が見つからない場合
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE contype = 'f'
              AND conrelid = 'audit_logs'::regclass
              AND conkey @> ARRAY(SELECT attnum 
                                  FROM pg_attribute 
                                  WHERE attrelid = 'audit_logs'::regclass 
                                    AND attname = 'actor_id')
        ) THEN '✅ 外部キー制約が見つかりました（上記を確認）'
        ELSE '❌ 外部キー制約が見つかりません。audit_logs.actor_id が auth.users(id) を参照しているか確認してください。'
    END AS "確認結果";

-- ============================================================
-- 2. actor_id カラムのNULL許可状態の確認
-- ============================================================

SELECT 
    '=== actor_id カラムのNULL許可状態 ===' AS section;

SELECT 
    column_name AS "カラム名",
    data_type AS "データ型",
    is_nullable AS "NULL許可",
    CASE 
        WHEN is_nullable = 'YES' THEN '✅ NULL許可（変更不要）'
        ELSE '⚠️ NOT NULL（マイグレーションで自動的に NULL 許可に変更されます）'
    END AS "状態"
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'audit_logs'
  AND column_name = 'actor_id';

-- ============================================================
-- 3. 整合性チェック（孤児レコードの確認）
-- ============================================================

SELECT 
    '=== 整合性チェック（孤児レコード） ===' AS section;

SELECT 
    count(*) AS "孤児レコード数",
    CASE 
        WHEN count(*) = 0 THEN '✅ 問題なし（孤児レコードは見つかりませんでした）'
        ELSE '⚠️ ' || count(*)::text || ' 件の孤児レコード（auth.usersに存在しないactor_id）が見つかりました。'
    END AS "状態",
    CASE 
        WHEN count(*) > 0 THEN '以下のSQLを実行して修正してください:' || E'\n' ||
            'UPDATE audit_logs al' || E'\n' ||
            'SET actor_id = NULL' || E'\n' ||
            'WHERE actor_id IS NOT NULL' || E'\n' ||
            '  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = al.actor_id);'
        ELSE NULL
    END AS "修正SQL（必要な場合）"
FROM audit_logs al
LEFT JOIN auth.users u ON u.id = al.actor_id
WHERE al.actor_id IS NOT NULL AND u.id IS NULL;

-- 孤児レコードの詳細（該当する場合）
SELECT 
    '=== 孤児レコードの詳細（該当する場合） ===' AS section;

SELECT 
    al.id AS "audit_log_id",
    al.actor_id AS "存在しないactor_id",
    al.action AS "アクション",
    al.created_at AS "作成日時"
FROM audit_logs al
LEFT JOIN auth.users u ON u.id = al.actor_id
WHERE al.actor_id IS NOT NULL AND u.id IS NULL
ORDER BY al.created_at DESC
LIMIT 10;

-- ============================================================
-- 4. 現在の監査ログ件数（参考情報）
-- ============================================================

SELECT 
    '=== 現在の監査ログ件数（参考情報） ===' AS section;

SELECT 
    count(*) AS "全件数",
    count(actor_id) AS "actor_idが設定されている件数",
    count(*) - count(actor_id) AS "actor_idがNULLの件数"
FROM audit_logs;

-- ============================================================
-- 5. マイグレーション実行の推奨事項
-- ============================================================

SELECT 
    '=== マイグレーション実行の推奨事項 ===' AS section;

SELECT 
    CASE 
        WHEN NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE contype = 'f'
              AND conrelid = 'audit_logs'::regclass
              AND conkey @> ARRAY(SELECT attnum 
                                  FROM pg_attribute 
                                  WHERE attrelid = 'audit_logs'::regclass 
                                    AND attname = 'actor_id')
        ) THEN 
            '❌ 外部キー制約が見つかりません。audit_logs.actor_id が auth.users(id) を参照しているか確認してください。'
        WHEN EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE contype = 'f'
              AND conrelid = 'audit_logs'::regclass
              AND conkey @> ARRAY(SELECT attnum 
                                  FROM pg_attribute 
                                  WHERE attrelid = 'audit_logs'::regclass 
                                    AND attname = 'actor_id')
              AND pg_get_constraintdef(oid) LIKE '%ON DELETE SET NULL%'
        ) THEN 
            '✅ 既に ON DELETE SET NULL が設定されています。このマイグレーションは不要です。'
        WHEN EXISTS (
            SELECT 1 FROM audit_logs al
            LEFT JOIN auth.users u ON u.id = al.actor_id
            WHERE al.actor_id IS NOT NULL AND u.id IS NULL
        ) THEN 
            '⚠️ 孤児レコードが見つかりました。上記の「修正SQL」を実行してから、マイグレーションを実行してください。'
        ELSE 
            '✅ 問題ありません。064_fix_audit_logs_actor_id_fk_set_null.sql を実行してください。'
    END AS "推奨事項";
