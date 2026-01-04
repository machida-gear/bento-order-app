-- ============================================================
-- テストデータ投入用SQL（開発環境のみ）
-- 本番環境では実行しないこと
-- ============================================================

-- 注意: このSQLは開発・テスト環境でのみ使用してください
-- users_profileの作成は、Auth.users作成後に手動で行う必要があります

-- ============================================================
-- 1. テスト用業者データ
-- ============================================================
INSERT INTO vendors (code, name, is_active) VALUES
('V001', '和食弁当屋', true),
('V002', '洋食レストラン', true),
('V003', 'サンドイッチ専門店', true)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 2. テスト用メニューデータ
-- ============================================================
INSERT INTO menus (vendor_id, name, is_active) VALUES
(1, '幕の内弁当', true),
(1, '唐揚げ弁当', true),
(1, '焼き魚定食', true),
(2, 'ハンバーグ定食', true),
(2, 'チキンカツ定食', true),
(2, 'オムライス', true),
(3, 'ハムサンド', true),
(3, 'ツナサンド', true),
(3, '野菜サンド', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. テスト用価格データ（2024年1月1日から有効）
-- ============================================================
INSERT INTO menu_prices (menu_id, price, start_date) VALUES
(1, 650, '2024-01-01'),
(2, 600, '2024-01-01'),
(3, 700, '2024-01-01'),
(4, 750, '2024-01-01'),
(5, 800, '2024-01-01'),
(6, 700, '2024-01-01'),
(7, 450, '2024-01-01'),
(8, 450, '2024-01-01'),
(9, 400, '2024-01-01')
ON CONFLICT (menu_id, start_date) DO NOTHING;

-- ============================================================
-- 4. テスト用注文可能日（2024年1月の営業日）
-- ============================================================
-- 月曜日から金曜日のみ注文可能とする
INSERT INTO order_days (date, is_available) VALUES
('2024-01-08', true),  -- 月
('2024-01-09', true),  -- 火
('2024-01-10', true),  -- 水
('2024-01-11', true),  -- 木
('2024-01-12', true),  -- 金
('2024-01-15', true),  -- 月
('2024-01-16', true),  -- 火
('2024-01-17', true),  -- 水
('2024-01-18', true),  -- 木
('2024-01-19', true),  -- 金
('2024-01-22', true),  -- 月
('2024-01-23', true),  -- 火
('2024-01-24', true),  -- 水
('2024-01-25', true),  -- 木
('2024-01-26', true),  -- 金
('2024-01-29', true),  -- 月
('2024-01-30', true),  -- 火
('2024-01-31', true)   -- 水
ON CONFLICT (date) DO UPDATE SET is_available = EXCLUDED.is_available;

-- 土日は注文不可
INSERT INTO order_days (date, is_available) VALUES
('2024-01-06', false),  -- 土
('2024-01-07', false),  -- 日
('2024-01-13', false),  -- 土
('2024-01-14', false),  -- 日
('2024-01-20', false),  -- 土
('2024-01-21', false),  -- 日
('2024-01-27', false),  -- 土
('2024-01-28', false)   -- 日
ON CONFLICT (date) DO UPDATE SET is_available = EXCLUDED.is_available;

-- ============================================================
-- 5. テスト用締切時刻（すべて10:00）
-- ============================================================
INSERT INTO order_deadlines (date, cutoff_time)
SELECT date, '10:00:00'::TIME
FROM order_days
WHERE is_available = true
ON CONFLICT (date) DO UPDATE SET cutoff_time = EXCLUDED.cutoff_time;

-- ============================================================
-- 6. テスト用締日期間（2024年1月分）
-- ============================================================
-- デフォルト: 11日〜翌月10日
INSERT INTO closing_periods (start_date, end_date, closing_date) VALUES
('2023-12-11', '2024-01-10', '2024-01-10'),
('2024-01-11', '2024-02-10', '2024-02-10')
ON CONFLICT (start_date, end_date) DO NOTHING;

-- ============================================================
-- 7. 確認用クエリ
-- ============================================================

-- 業者・メニュー・価格の確認
SELECT 
    v.code AS vendor_code,
    v.name AS vendor_name,
    m.name AS menu_name,
    mp.price,
    mp.start_date,
    mp.end_date
FROM vendors v
JOIN menus m ON m.vendor_id = v.id
JOIN menu_prices mp ON mp.menu_id = m.id
WHERE v.is_active = true AND m.is_active = true
ORDER BY v.code, m.name;

-- 注文可能日の確認
SELECT 
    date,
    is_available,
    COALESCE(od.cutoff_time, '10:00:00'::TIME) AS cutoff_time
FROM order_days od
LEFT JOIN order_deadlines odl ON odl.date = od.date
WHERE date >= '2024-01-01' AND date <= '2024-01-31'
ORDER BY date;

