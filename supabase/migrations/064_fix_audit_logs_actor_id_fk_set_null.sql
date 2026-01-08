-- ============================================================
-- audit_logs.actor_id の外部キー制約を ON DELETE SET NULL に変更
-- 
-- 目的: Authユーザー削除時に、audit_logsのactor_idをNULLにして
--       監査ログを保持したままユーザーを削除可能にする
-- 
-- 前提条件:
-- - audit_logs.actor_id が auth.users(id) を参照している外部キー制約が存在すること
-- 
-- 実行前の確認:
-- 1. このマイグレーション実行前に、以下の確認SQLを実行して
--    外部キー制約名を確認してください:
-- 
--    SELECT conname, pg_get_constraintdef(oid) as def
--    FROM pg_constraint
--    WHERE contype='f'
--      AND conrelid='audit_logs'::regclass
--      AND conkey::int[] @> ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='audit_logs'::regclass AND attname='actor_id')];
-- 
-- 2. 既存データの整合性を確認:
--    SELECT count(*) as orphan_actor_ids
--    FROM audit_logs al
--    LEFT JOIN auth.users u ON u.id = al.actor_id
--    WHERE al.actor_id IS NOT NULL AND u.id IS NULL;
-- 
--    もし orphan_actor_ids > 0 の場合、以下のSQLで修正してからこのマイグレーションを実行:
--    UPDATE audit_logs al
--    SET actor_id = NULL
--    WHERE actor_id IS NOT NULL
--      AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = al.actor_id);
-- ============================================================

-- ============================================================
-- ステップ1: 現在の外部キー制約の確認
-- ============================================================

DO $$
DECLARE
    v_constraint_name TEXT;
    v_actor_id_nullable BOOLEAN;
BEGIN
    -- actor_id カラムに紐づく外部キー制約名を取得
    SELECT conname INTO v_constraint_name
    FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid = 'audit_logs'::regclass
      AND conkey @> ARRAY(SELECT attnum 
                          FROM pg_attribute 
                          WHERE attrelid = 'audit_logs'::regclass 
                            AND attname = 'actor_id')
    LIMIT 1;

    -- actor_id カラムが NULL 許可かどうかを確認
    SELECT is_nullable = 'YES' INTO v_actor_id_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audit_logs'
      AND column_name = 'actor_id';

    -- 外部キー制約が見つからない場合は警告
    IF v_constraint_name IS NULL THEN
        RAISE WARNING 'audit_logs.actor_id に紐づく外部キー制約が見つかりません。このマイグレーションはスキップされます。';
        RETURN;
    END IF;

    RAISE NOTICE '発見された外部キー制約名: %', v_constraint_name;
    RAISE NOTICE 'actor_id カラムのNULL許可状態: %', CASE WHEN v_actor_id_nullable THEN 'NULL許可' ELSE 'NOT NULL' END;

    -- ============================================================
    -- ステップ2: actor_id カラムを NULL 許可にする（必要なら）
    -- ============================================================

    IF NOT v_actor_id_nullable THEN
        RAISE NOTICE 'actor_id カラムを NULL 許可に変更します...';
        ALTER TABLE audit_logs ALTER COLUMN actor_id DROP NOT NULL;
        RAISE NOTICE 'actor_id カラムを NULL 許可に変更しました。';
    ELSE
        RAISE NOTICE 'actor_id カラムは既に NULL 許可です。スキップします。';
    END IF;

    -- ============================================================
    -- ステップ3: 既存の外部キー制約を削除
    -- ============================================================

    RAISE NOTICE '外部キー制約 % を削除します...', v_constraint_name;
    EXECUTE format('ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
    RAISE NOTICE '外部キー制約 % を削除しました。', v_constraint_name;

    -- ============================================================
    -- ステップ4: 新しい外部キー制約を ON DELETE SET NULL で作成
    -- ============================================================

    RAISE NOTICE '新しい外部キー制約（ON DELETE SET NULL）を作成します...';
    ALTER TABLE audit_logs
        ADD CONSTRAINT audit_logs_actor_id_fkey
        FOREIGN KEY (actor_id) 
        REFERENCES auth.users(id) 
        ON DELETE SET NULL;
    RAISE NOTICE '新しい外部キー制約を作成しました。';

    -- ============================================================
    -- ステップ5: 整合性チェック（孤児レコードの確認）
    -- ============================================================

    DECLARE
        v_orphan_count INTEGER;
    BEGIN
        SELECT count(*) INTO v_orphan_count
        FROM audit_logs al
        LEFT JOIN auth.users u ON u.id = al.actor_id
        WHERE al.actor_id IS NOT NULL AND u.id IS NULL;

        IF v_orphan_count > 0 THEN
            RAISE WARNING '整合性チェック: % 件の孤児レコード（auth.usersに存在しないactor_id）が見つかりました。', v_orphan_count;
            RAISE WARNING '以下のSQLを実行して修正してください:';
            RAISE WARNING 'UPDATE audit_logs al SET actor_id = NULL WHERE actor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = al.actor_id);';
        ELSE
            RAISE NOTICE '整合性チェック: 問題なし（孤児レコードは見つかりませんでした）。';
        END IF;
    END;

    RAISE NOTICE 'マイグレーションが正常に完了しました。';
END $$;

-- ============================================================
-- 確認用クエリ（実行後の状態確認）
-- ============================================================

-- 外部キー制約の確認
SELECT 
    '=== 外部キー制約の確認 ===' AS section;

SELECT 
    conname AS "制約名",
    pg_get_constraintdef(oid) AS "定義",
    CASE 
        WHEN pg_get_constraintdef(oid) LIKE '%ON DELETE SET NULL%' THEN '✅ ON DELETE SET NULL'
        WHEN pg_get_constraintdef(oid) LIKE '%ON DELETE RESTRICT%' THEN '⚠️ ON DELETE RESTRICT（変更が必要）'
        WHEN pg_get_constraintdef(oid) LIKE '%ON DELETE CASCADE%' THEN '❌ ON DELETE CASCADE（削除されないように注意）'
        ELSE '⚠️ ON DELETE 動作が未指定'
    END AS "状態"
FROM pg_constraint
WHERE contype = 'f'
  AND conrelid = 'audit_logs'::regclass
  AND conkey @> ARRAY(SELECT attnum 
                      FROM pg_attribute 
                      WHERE attrelid = 'audit_logs'::regclass 
                        AND attname = 'actor_id');

-- actor_id カラムのNULL許可状態の確認
SELECT 
    '=== actor_id カラムのNULL許可状態 ===' AS section;

SELECT 
    column_name AS "カラム名",
    is_nullable AS "NULL許可",
    CASE 
        WHEN is_nullable = 'YES' THEN '✅ NULL許可'
        ELSE '❌ NOT NULL（変更が必要）'
    END AS "状態"
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'audit_logs'
  AND column_name = 'actor_id';

-- 整合性チェック（孤児レコードの確認）
SELECT 
    '=== 整合性チェック（孤児レコード） ===' AS section;

SELECT 
    count(*) AS "孤児レコード数",
    CASE 
        WHEN count(*) = 0 THEN '✅ 問題なし'
        ELSE '⚠️ ' || count(*)::text || ' 件の孤児レコードが見つかりました。修正が必要です。'
    END AS "状態"
FROM audit_logs al
LEFT JOIN auth.users u ON u.id = al.actor_id
WHERE al.actor_id IS NOT NULL AND u.id IS NULL;
