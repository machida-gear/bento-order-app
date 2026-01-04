-- ============================================================
-- get_menu_price_id関数の修正
-- menu_pricesテーブルのカラム名がmenu_item_idであることを反映
-- ============================================================

-- 既存の関数を削除
DROP FUNCTION IF EXISTS get_menu_price_id(INTEGER, DATE);

-- 修正した関数を作成（menu_item_idを使用）
CREATE OR REPLACE FUNCTION get_menu_price_id(
    p_menu_id INTEGER,
    p_order_date DATE
)
RETURNS INTEGER AS $$
DECLARE
    v_price_id INTEGER;
    v_count INTEGER;
BEGIN
    -- 指定日付が含まれる価格期間を検索
    -- 注意: menu_pricesテーブルではmenu_item_idを使用
    SELECT id, COUNT(*) OVER()
    INTO v_price_id, v_count
    FROM menu_prices
    WHERE menu_item_id = p_menu_id
        AND start_date <= p_order_date
        AND (end_date IS NULL OR end_date >= p_order_date)
    ORDER BY start_date DESC
    LIMIT 1;

    -- 価格が見つからない場合
    IF v_price_id IS NULL THEN
        RAISE EXCEPTION '指定日付(%)に対応するメニューID(%)の価格が見つかりません', p_order_date, p_menu_id;
    END IF;

    -- 重複する価格期間がある場合
    IF v_count > 1 THEN
        RAISE EXCEPTION '指定日付(%)に対応するメニューID(%)の価格期間が重複しています', p_order_date, p_menu_id;
    END IF;

    RETURN v_price_id;
END;
$$ LANGUAGE plpgsql;

-- 関数の確認
SELECT 
    routine_name,
    routine_type,
    data_type AS return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name = 'get_menu_price_id';
