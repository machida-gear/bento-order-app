-- orders.user_id の外部キー制約を確認するマイグレーション
-- 
-- 目的: orders.user_id が profiles.id を参照する際の ON DELETE 動作を確認
-- 問題: ON DELETE CASCADE の場合、ユーザーを物理削除すると注文データも消えてしまう
-- 解決策: ON DELETE RESTRICT に変更することで、注文データがあるユーザーは削除不可にする

-- ============================================================
-- STEP 1: 現在の外部キー制約を確認（結果を返すクエリ）
-- ============================================================

-- orders.user_id の外部キー制約を確認
SELECT 
    tc.constraint_name AS "制約名",
    tc.table_name AS "テーブル名",
    kcu.column_name AS "カラム名",
    ccu.table_name AS "参照テーブル名",
    ccu.column_name AS "参照カラム名",
    rc.delete_rule AS "ON DELETE 動作",
    CASE 
        WHEN rc.delete_rule = 'CASCADE' THEN 
            '❌ 問題: ユーザーを物理削除すると注文データも削除されます。会計・集計データが失われる可能性があります。'
        WHEN rc.delete_rule = 'RESTRICT' THEN 
            '✅ 安全: 注文データがあるユーザーは削除できません。データ保護されています。'
        WHEN rc.delete_rule = 'SET NULL' THEN 
            '⚠️ 注意: ユーザーを削除すると、user_idがNULLになります。'
        WHEN rc.delete_rule = 'NO ACTION' THEN 
            '⚠️ 注意: ユーザーを削除しようとするとエラーになります（RESTRICTと似た動作）。'
        ELSE 
            '⚠️ 未知の動作: ' || rc.delete_rule
    END AS "状態"
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc 
    ON tc.constraint_name = rc.constraint_name
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON rc.constraint_name = ccu.constraint_name
WHERE tc.table_schema = 'public'
    AND tc.table_name = 'orders'
    AND kcu.column_name = 'user_id'
    AND tc.constraint_type = 'FOREIGN KEY';

-- 制約が見つからない場合の確認用クエリ
-- 以下のクエリで結果が0行の場合は、外部キー制約が存在しません
SELECT 
    COUNT(*) AS "外部キー制約の数"
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc 
    ON tc.constraint_name = rc.constraint_name
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
    AND tc.table_name = 'orders'
    AND kcu.column_name = 'user_id'
    AND tc.constraint_type = 'FOREIGN KEY';
