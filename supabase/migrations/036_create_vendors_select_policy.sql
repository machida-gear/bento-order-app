-- ============================================================
-- vendorsテーブルのRLSポリシー作成
-- 一般ユーザーがis_active=trueの業者を参照できるようにする
-- ============================================================

-- 1. vendorsテーブルでRLSが有効か確認
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = 'vendors' 
        AND rowsecurity = true
    ) THEN
        ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE '✅ vendorsテーブルでRLSを有効化しました';
    ELSE
        RAISE NOTICE '⏭️ vendorsテーブルでRLSは既に有効です';
    END IF;
END $$;

-- 2. 既存のポリシーを確認
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'vendors';
    
    RAISE NOTICE '現在のvendorsテーブルのポリシー数: %', policy_count;
END $$;

-- 3. 管理者用の全権限ポリシー（既に存在する場合はスキップ）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'vendors'
        AND policyname = 'vendors_all_admin'
    ) THEN
        CREATE POLICY "vendors_all_admin"
            ON vendors FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
                )
            );
        RAISE NOTICE '✅ vendors_all_adminポリシーを作成しました';
    ELSE
        RAISE NOTICE '⏭️ vendors_all_adminポリシーは既に存在します';
    END IF;
END $$;

-- 4. 一般ユーザー用のSELECTポリシー（is_active=trueのみ参照可能）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'vendors'
        AND policyname = 'vendors_select_active'
    ) THEN
        CREATE POLICY "vendors_select_active"
            ON vendors FOR SELECT
            USING (is_active = true);
        RAISE NOTICE '✅ vendors_select_activeポリシーを作成しました';
    ELSE
        RAISE NOTICE '⏭️ vendors_select_activeポリシーは既に存在します';
    END IF;
END $$;

-- 5. 作成されたポリシーを確認
SELECT 
    policyname,
    cmd AS command,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE tablename = 'vendors'
ORDER BY policyname;

-- 6. テスト: 一般ユーザーでvendorsを取得できるか確認
SELECT 
    COUNT(*) AS vendor_count,
    STRING_AGG(name, ', ') AS vendor_names
FROM vendors
WHERE is_active = true;
