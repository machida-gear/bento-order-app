import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminNav from '@/components/admin-nav'

/**
 * 管理者画面用レイアウト
 * 管理者ロールのみアクセス可能
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // ユーザープロフィールを取得
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  // 管理者権限チェック
  const profileTyped = profile as { role?: string; [key: string]: any }
  if (profileTyped.role !== 'admin') {
    redirect('/calendar')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav profile={profile} />
      <main className="lg:ml-64">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  )
}

