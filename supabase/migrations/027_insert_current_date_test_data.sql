-- ============================================================
-- 注文機能動作確認用：現在の日付に対応したテストデータ
-- このSQLは開発環境でのみ実行してください
-- ============================================================

-- 1. 業者データ（既存のデータがあればスキップ）
INSERT INTO vendors (code, name, is_active) VALUES
('V001', '和食弁当屋', true),
('V002', '洋食レストラン', true),
('V003', 'サンドイッチ専門店', true)
ON CONFLICT (code) DO UPDATE SET is_active = true;

-- 2. メニューデータ（既存のデータがあればスキップ）
-- 注意: vendor_idは実際のvendorsテーブルのIDに合わせて調整してください
INSERT INTO menu_items (vendor_id, name, is_active)
SELECT 
    v.id,
    m.name,
    true
FROM vendors v
CROSS JOIN (VALUES
    ('V001', '幕の内弁当'),
    ('V001', '唐揚げ弁当'),
    ('V001', '焼き魚定食'),
    ('V002', 'ハンバーグ定食'),
    ('V002', 'チキンカツ定食'),
    ('V002', 'オムライス'),
    ('V003', 'ハムサンド'),
    ('V003', 'ツナサンド'),
    ('V003', '野菜サンド')
) AS m(vendor_code, name)
WHERE v.code = m.vendor_code
  AND NOT EXISTS (
    SELECT 1 FROM menu_items mi 
    WHERE mi.vendor_id = v.id AND mi.name = m.name
  );

-- 3. 価格データ（現在の日付から有効）
-- 注意: menu_item_idは実際のmenu_itemsテーブルのIDに合わせて調整してください
INSERT INTO menu_prices (menu_item_id, price, start_date)
SELECT 
    m.id,
    CASE m.name
        WHEN '幕の内弁当' THEN 650
        WHEN '唐揚げ弁当' THEN 600
        WHEN '焼き魚定食' THEN 700
        WHEN 'ハンバーグ定食' THEN 750
        WHEN 'チキンカツ定食' THEN 800
        WHEN 'オムライス' THEN 700
        WHEN 'ハムサンド' THEN 450
        WHEN 'ツナサンド' THEN 450
        WHEN '野菜サンド' THEN 400
        ELSE 500  -- デフォルト価格（メニュー名が一致しない場合）
    END,
    CURRENT_DATE
FROM menu_items m
WHERE m.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM menu_prices mp 
    WHERE mp.menu_item_id = m.id AND mp.start_date = CURRENT_DATE
  )
  AND CASE m.name
        WHEN '幕の内弁当' THEN true
        WHEN '唐揚げ弁当' THEN true
        WHEN '焼き魚定食' THEN true
        WHEN 'ハンバーグ定食' THEN true
        WHEN 'チキンカツ定食' THEN true
        WHEN 'オムライス' THEN true
        WHEN 'ハムサンド' THEN true
        WHEN 'ツナサンド' THEN true
        WHEN '野菜サンド' THEN true
        ELSE false  -- 一致しないメニューは除外
      END;

-- 4. 注文可能日（今日から2週間分、平日のみ）
INSERT INTO order_calendar (target_date, is_available, deadline_time, note)
SELECT
    ds.target_date,
    CASE 
        WHEN EXTRACT(DOW FROM ds.target_date) IN (0, 6) THEN false  -- 土日は注文不可
        ELSE true
    END,
    '10:00:00'::time,
    CASE 
        WHEN EXTRACT(DOW FROM ds.target_date) IN (0, 6) THEN '週末'
        ELSE NULL
    END
FROM (
    SELECT (CURRENT_DATE + (generate_series(0, 13) || ' days')::interval)::date as target_date
) as ds
ON CONFLICT (target_date) DO UPDATE SET
    is_available = EXCLUDED.is_available,
    deadline_time = EXCLUDED.deadline_time,
    note = EXCLUDED.note;

-- 5. 確認用クエリ
SELECT 
    '業者数' AS item,
    COUNT(*)::text AS count
FROM vendors
WHERE is_active = true
UNION ALL
SELECT 
    'メニュー数',
    COUNT(*)::text
FROM menu_items
WHERE is_active = true
UNION ALL
SELECT 
    '価格レコード数',
    COUNT(*)::text
FROM menu_prices
WHERE start_date <= CURRENT_DATE
  AND (end_date IS NULL OR end_date >= CURRENT_DATE)
UNION ALL
SELECT 
    '注文可能日数（今後2週間）',
    COUNT(*)::text
FROM order_calendar
WHERE target_date >= CURRENT_DATE
  AND target_date <= CURRENT_DATE + INTERVAL '14 days'
  AND is_available = true;
