-- ============================================================
-- menu_itemsテーブルのRLSポリシー作成
-- 一般ユーザーがis_active=trueのメニューを参照できるようにする
-- ============================================================

-- 1. menu_itemsテーブルでRLSが有効か確認
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = 'menu_items' 
        AND rowsecurity = true
    ) THEN
        ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE '✅ menu_itemsテーブルでRLSを有効化しました';
    ELSE
        RAISE NOTICE '⏭️ menu_itemsテーブルでRLSは既に有効です';
    END IF;
END $$;

-- 2. 既存のポリシーを確認
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'menu_items';
    
    RAISE NOTICE '現在のmenu_itemsテーブルのポリシー数: %', policy_count;
END $$;

-- 3. 管理者用の全権限ポリシー（既に存在する場合はスキップ）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'menu_items'
        AND policyname = 'menu_items_all_admin'
    ) THEN
        CREATE POLICY "menu_items_all_admin"
            ON menu_items FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
                )
            );
        RAISE NOTICE '✅ menu_items_all_adminポリシーを作成しました';
    ELSE
        RAISE NOTICE '⏭️ menu_items_all_adminポリシーは既に存在します';
    END IF;
END $$;

-- 4. 一般ユーザー用のSELECTポリシー（is_active=trueのみ参照可能）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'menu_items'
        AND policyname = 'menu_items_select_active'
    ) THEN
        CREATE POLICY "menu_items_select_active"
            ON menu_items FOR SELECT
            USING (is_active = true);
        RAISE NOTICE '✅ menu_items_select_activeポリシーを作成しました';
    ELSE
        RAISE NOTICE '⏭️ menu_items_select_activeポリシーは既に存在します';
    END IF;
END $$;

-- 5. 作成されたポリシーを確認
SELECT 
    policyname,
    cmd AS command,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE tablename = 'menu_items'
ORDER BY policyname;

-- 6. テスト: 一般ユーザーでmenu_itemsを取得できるか確認
-- （このクエリは実際のユーザーコンテキストで実行する必要があります）
SELECT 
    COUNT(*) AS menu_count,
    STRING_AGG(name, ', ') AS menu_names
FROM menu_items
WHERE is_active = true;
