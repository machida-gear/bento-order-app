import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * ルートページ
 * 認証状態に応じてリダイレクト
 */
export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // ログイン済み → カレンダーへ
    redirect('/calendar')
  } else {
    // 未ログイン → ログインページへ
    redirect('/login')
  }
}
