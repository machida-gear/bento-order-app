-- ============================================================
-- マイグレーション実行後の動作確認SQL
-- 
-- 目的: audit_logs.actor_id の外部キー制約が正しく ON DELETE SET NULL に
--       変更されたことを確認し、実際にユーザー削除時の動作をテスト
-- 
-- 使用方法:
-- 1. 064_fix_audit_logs_actor_id_fk_set_null.sql 実行後に実行
-- 2. 結果を確認して、問題がないことを確認
-- 3. 実際のユーザー削除テストを行う場合は、下記の「動作確認テスト手順」を参照
-- ============================================================

-- ============================================================
-- 1. 外部キー制約の確認
-- ============================================================

SELECT 
    '=== 外部キー制約の確認 ===' AS section;

SELECT 
    conname AS "制約名",
    pg_get_constraintdef(oid) AS "定義",
    CASE 
        WHEN pg_get_constraintdef(oid) LIKE '%ON DELETE SET NULL%' THEN '✅ ON DELETE SET NULL（正常）'
        WHEN pg_get_constraintdef(oid) LIKE '%ON DELETE RESTRICT%' THEN '❌ ON DELETE RESTRICT（変更が必要）'
        WHEN pg_get_constraintdef(oid) LIKE '%ON DELETE CASCADE%' THEN '❌ ON DELETE CASCADE（変更が必要）'
        ELSE '⚠️ ON DELETE 動作が未指定'
    END AS "状態"
FROM pg_constraint
WHERE contype = 'f'
  AND conrelid = 'audit_logs'::regclass
  AND conkey @> ARRAY(SELECT attnum 
                      FROM pg_attribute 
                      WHERE attrelid = 'audit_logs'::regclass 
                        AND attname = 'actor_id');

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
        WHEN is_nullable = 'YES' THEN '✅ NULL許可（正常）'
        ELSE '❌ NOT NULL（変更が必要）'
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
        ELSE '⚠️ ' || count(*)::text || ' 件の孤児レコードが見つかりました。修正が必要です。'
    END AS "状態"
FROM audit_logs al
LEFT JOIN auth.users u ON u.id = al.actor_id
WHERE al.actor_id IS NOT NULL AND u.id IS NULL;

-- ============================================================
-- 4. 現在の監査ログの状態（参考情報）
-- ============================================================

SELECT 
    '=== 現在の監査ログの状態（参考情報） ===' AS section;

SELECT 
    count(*) AS "全件数",
    count(actor_id) AS "actor_idが設定されている件数",
    count(*) - count(actor_id) AS "actor_idがNULLの件数"
FROM audit_logs;

-- ============================================================
-- 5. 動作確認テスト手順（実際のユーザー削除テスト）
-- ============================================================

SELECT 
    '=== 動作確認テスト手順 ===' AS section;

-- テスト用のSQL（実際に実行する場合は、適切なユーザーUUIDに置き換える）
SELECT 
    '以下の手順で動作確認を行ってください:' || E'\n\n' ||
    '1. 削除前の確認（任意のユーザーUUIDを使用）:' || E'\n' ||
    '   SELECT count(*) FROM audit_logs WHERE actor_id = ''<ユーザーUUID>'';' || E'\n\n' ||
    '2. ユーザーを削除:' || E'\n' ||
    '   - Supabase Dashboard > Authentication > Users から削除' || E'\n' ||
    '   - または、管理APIから削除' || E'\n\n' ||
    '3. 削除後の確認:' || E'\n' ||
    '   SELECT count(*) FROM audit_logs WHERE actor_id = ''<ユーザーUUID>'';' || E'\n' ||
    '   → 結果が 0 になること（NULL化される）' || E'\n\n' ||
    '   SELECT count(*) FROM audit_logs WHERE actor_id IS NULL;' || E'\n' ||
    '   → 削除前より増加していること（監査ログが保持されている）' || E'\n\n' ||
    '4. 監査ログの詳細確認:' || E'\n' ||
    '   SELECT id, actor_id, action, created_at' || E'\n' ||
    '   FROM audit_logs' || E'\n' ||
    '   WHERE actor_id IS NULL' || E'\n' ||
    '   ORDER BY created_at DESC' || E'\n' ||
    '   LIMIT 10;' || E'\n' ||
    '   → actor_id が NULL になっているが、ログ自体は残っていることを確認' AS "手順";

-- ============================================================
-- 6. テスト用クエリ（実際のユーザーUUIDを使用して実行）
-- ============================================================

-- 注: 以下のクエリは、実際のユーザーUUIDに置き換えて実行してください

-- -- 削除前の確認（<ユーザーUUID> を実際のUUIDに置き換える）
-- SELECT 
--     count(*) AS "削除前の監査ログ件数",
--     array_agg(DISTINCT action ORDER BY action) AS "アクション一覧"
-- FROM audit_logs 
-- WHERE actor_id = '<ユーザーUUID>';

-- -- 削除後の確認（ユーザー削除後）
-- -- actor_id が NULL になっていることを確認
-- SELECT 
--     count(*) AS "削除後も残っている監査ログ件数（actor_id=NULL）",
--     array_agg(DISTINCT action ORDER BY action) AS "アクション一覧"
-- FROM audit_logs 
-- WHERE actor_id IS NULL 
--   AND created_at >= (SELECT min(created_at) FROM audit_logs WHERE actor_id = '<ユーザーUUID>')
--   AND created_at <= (SELECT max(created_at) FROM audit_logs WHERE actor_id = '<ユーザーUUID>');

-- ============================================================
-- 7. マイグレーション成功の確認
-- ============================================================

SELECT 
    '=== マイグレーション成功の確認 ===' AS section;

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
              AND pg_get_constraintdef(oid) LIKE '%ON DELETE SET NULL%'
        ) 
        AND EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'audit_logs'
              AND column_name = 'actor_id'
              AND is_nullable = 'YES'
        ) THEN 
            '✅ マイグレーションが正常に完了しました！' || E'\n' ||
            '   - 外部キー制約: ON DELETE SET NULL ✓' || E'\n' ||
            '   - actor_id カラム: NULL許可 ✓' || E'\n' ||
            '   これで、Authユーザーを削除しても監査ログは保持され、actor_id は NULL になります。'
        ELSE 
            '⚠️ マイグレーションが正常に完了していない可能性があります。上記の確認結果を確認してください。'
    END AS "確認結果";
