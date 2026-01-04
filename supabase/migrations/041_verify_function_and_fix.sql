-- ============================================================
-- get_menu_price_id関数の確認と修正
-- ============================================================

-- 1. 現在の関数の定義を確認
SELECT 
    pg_get_functiondef(oid) AS function_definition
FROM pg_proc
WHERE proname = 'get_menu_price_id';

-- 2. 関数をテスト（メニューID=23、日付=2025-12-30）
-- エラーが発生する場合は、関数がmenu_idを使用している可能性が高い
DO $$
DECLARE
    v_result INTEGER;
    v_error TEXT;
BEGIN
    BEGIN
        v_result := get_menu_price_id(23, '2025-12-30'::DATE);
        RAISE NOTICE '✅ 関数は正常に動作しました。結果: %', v_result;
    EXCEPTION WHEN OTHERS THEN
        v_error := SQLERRM;
        RAISE NOTICE '❌ 関数の実行でエラーが発生しました: %', v_error;
        RAISE NOTICE '関数がmenu_idを使用している可能性があります。038のSQLを実行してください。';
    END;
END $$;

-- 3. 関数がmenu_idを使用している場合の確認
-- 関数の定義に"menu_id"が含まれているか確認
SELECT 
    CASE 
        WHEN pg_get_functiondef(oid) LIKE '%menu_id%' 
         AND pg_get_functiondef(oid) NOT LIKE '%menu_item_id%'
        THEN '❌ 関数はmenu_idを使用しています。038のSQLを実行してください。'
        WHEN pg_get_functiondef(oid) LIKE '%menu_item_id%'
        THEN '✅ 関数はmenu_item_idを使用しています。'
        ELSE '⚠️ 関数の定義を確認してください。'
    END AS function_status
FROM pg_proc
WHERE proname = 'get_menu_price_id';
