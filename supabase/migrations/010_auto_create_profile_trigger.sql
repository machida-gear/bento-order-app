-- ================================================================================
-- 010_auto_create_profile_trigger.sql
-- auth.users に新規ユーザーが作成されたら profiles テーブルに自動でレコードを作成
-- ================================================================================

-- トリガー関数: 新規ユーザー作成時に profiles レコードを自動作成
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_employee_code CHAR(4);
  v_name VARCHAR(255);
  v_email VARCHAR(255);
BEGIN
  -- email を取得
  v_email := NEW.email;
  
  -- name をメタデータから取得（なければemailのローカル部分を使用）
  IF NEW.raw_user_meta_data->>'name' IS NOT NULL THEN
    v_name := NEW.raw_user_meta_data->>'name';
  ELSE
    -- emailのローカル部分（@より前）を名前として使用
    v_name := SPLIT_PART(v_email, '@', 1);
  END IF;
  
  -- employee_code をメタデータから取得（なければ仮コード '0000' を使用）
  IF NEW.raw_user_meta_data->>'employee_code' IS NOT NULL THEN
    v_employee_code := NEW.raw_user_meta_data->>'employee_code';
  ELSE
    -- 仮のemployee_code（管理者が後で設定する想定）
    v_employee_code := '0000';
  END IF;
  
  -- profiles テーブルに新規レコードを挿入
  INSERT INTO public.profiles (
    id,
    employee_code,
    name,
    email,
    role,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    v_employee_code,
    v_name,
    v_email,
    'user', -- デフォルトは一般ユーザー
    true,   -- デフォルトは有効
    NOW(),
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- トリガーの作成: auth.users に INSERT されたら handle_new_user() を実行
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 確認用コメント
COMMENT ON FUNCTION public.handle_new_user() IS 
  'auth.users に新規ユーザーが作成されたら、自動的に profiles テーブルにレコードを作成する';

COMMENT ON TRIGGER on_auth_user_created ON auth.users IS
  '新規ユーザー登録時に profiles テーブルを自動作成';

-- 確認SQL（実行後に確認用）
-- SELECT 
--   t.tgname AS trigger_name,
--   p.proname AS function_name,
--   pg_get_triggerdef(t.oid) AS trigger_definition
-- FROM pg_trigger t
-- JOIN pg_proc p ON t.tgfoid = p.oid
-- WHERE t.tgrelid = 'auth.users'::regclass;

