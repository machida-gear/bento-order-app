-- orders.user_id の外部キー制約を ON DELETE RESTRICT に変更
-- 
-- 目的: 注文データがあるユーザーを物理削除できないようにする
-- 理由: 会計・集計データを保護するため
-- 
-- 注意: 
-- - 現在の実装では既存ユーザーの削除は is_active=false にするだけなので問題ありません
-- - ただし、将来的に物理削除する可能性に備えて、データ保護のため RESTRICT に変更します
-- - 物理削除が必要な場合は、まず注文データを削除してからユーザーを削除する必要があります

-- ============================================================
-- STEP 1: 既存の外部キー制約を削除
-- ============================================================

DO $$
DECLARE
    v_constraint_name TEXT;
    v_table_name TEXT := 'orders';
    v_column_name TEXT := 'user_id';
BEGIN
    -- orders.user_id の外部キー制約名を取得
    SELECT 
        tc.constraint_name
    INTO 
        v_constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public'
        AND tc.table_name = v_table_name
        AND kcu.column_name = v_column_name
        AND tc.constraint_type = 'FOREIGN KEY'
    LIMIT 1;
    
    IF v_constraint_name IS NULL THEN
        RAISE NOTICE '⚠️ orders.user_id の外部キー制約が見つかりません。スキップします。';
        RETURN;
    END IF;
    
    RAISE NOTICE 'ℹ️ 既存の外部キー制約を削除: %', v_constraint_name;
    
    -- 既存の制約を削除
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', v_table_name, v_constraint_name);
    
    RAISE NOTICE '✅ 既存の外部キー制約を削除しました';
END $$;

-- ============================================================
-- STEP 2: ON DELETE RESTRICT の外部キー制約を追加
-- ============================================================

DO $$
DECLARE
    v_constraint_name TEXT := 'orders_user_id_fkey';
    v_table_name TEXT := 'orders';
    v_column_name TEXT := 'user_id';
    v_referenced_table TEXT := 'profiles';
    v_referenced_column TEXT := 'id';
BEGIN
    -- 既存の制約が存在しないことを確認
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'public' 
        AND table_name = v_table_name 
        AND constraint_name = v_constraint_name
    ) THEN
        RAISE NOTICE '⏭️ 外部キー制約 % は既に存在します。スキップします。', v_constraint_name;
        RETURN;
    END IF;
    
    -- profiles テーブルが存在することを確認
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = v_referenced_table
    ) THEN
        RAISE EXCEPTION 'profiles テーブルが見つかりません';
    END IF;
    
    -- ON DELETE RESTRICT の外部キー制約を追加
    EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(%I) ON DELETE RESTRICT',
        v_table_name,
        v_constraint_name,
        v_column_name,
        v_referenced_table,
        v_referenced_column
    );
    
    RAISE NOTICE '✅ 外部キー制約を追加しました: % (ON DELETE RESTRICT)', v_constraint_name;
    RAISE NOTICE 'ℹ️ これで、注文データがあるユーザーは物理削除できません';
    RAISE NOTICE 'ℹ️ ユーザーを無効化する場合は、is_active=false を使用してください';
    
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE '⏭️ 外部キー制約 % は既に存在します。', v_constraint_name;
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️ 外部キー制約の追加に失敗: %', SQLERRM;
        RAISE;
END $$;
