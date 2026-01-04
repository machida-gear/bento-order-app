import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * 管理者ダッシュボード
 * 本日の注文状況や各種サマリーを表示
 */
export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const todayDate = new Date()
  todayDate.setHours(0, 0, 0, 0)

  // 本日の注文数
  const { count: todayOrderCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('order_date', today)
    .eq('status', 'ordered')

  // アクティブユーザー数（Service Role Keyを使用してRLSをバイパス）
  const { count: activeUserCount } = await supabaseAdmin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  // アクティブ業者数
  const { count: activeVendorCount } = await supabaseAdmin
    .from('vendors')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  // アクティブメニュー数
  const { count: activeMenuCount } = await supabaseAdmin
    .from('menu_items')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  // 承認待ちユーザー数（Service Role Keyを使用してRLSをバイパス）
  // 承認待ち = is_active=false かつ 退職日が未設定または未来の日付
  const todayStr = todayDate.toISOString().split('T')[0]
  const { count: pendingUserCount } = await supabaseAdmin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', false)
    .or(`left_date.is.null,left_date.gte.${todayStr}`)

  const stats = [
    { label: '本日の注文', value: todayOrderCount || 0, icon: '📦', color: 'amber', href: '/admin/orders/today' },
    { label: 'アクティブユーザー', value: activeUserCount || 0, icon: '👥', color: 'blue', href: '/admin/users' },
    { label: '承認待ちユーザー', value: pendingUserCount || 0, icon: '⏳', color: 'orange', href: '/admin/users?pending=true' },
    { label: 'アクティブ業者', value: activeVendorCount || 0, icon: '🏢', color: 'green', href: '/admin/vendors' },
    { label: 'アクティブメニュー', value: activeMenuCount || 0, icon: '🍱', color: 'purple', href: '/admin/menus' },
  ]

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">📊 ダッシュボード</h1>
        <p className="text-gray-500 mt-1">システムの概要を確認</p>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <a
            key={stat.label}
            href={stat.href}
            className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm cursor-pointer hover:shadow-md transition-shadow block"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">{stat.label}</div>
                <div className="text-3xl font-bold text-gray-800 mt-1">
                  {stat.value.toLocaleString()}
                </div>
              </div>
              <div className="text-3xl">{stat.icon}</div>
            </div>
          </a>
        ))}
      </div>

      {/* クイックリンク */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="font-semibold text-gray-800 mb-4">クイックリンク</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a
            href="/admin/calendar"
            className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <span className="text-2xl">📅</span>
            <span className="text-sm text-gray-600">カレンダー設定</span>
          </a>
          <a
            href="/admin/reports"
            className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <span className="text-2xl">📄</span>
            <span className="text-sm text-gray-600">レポート出力</span>
          </a>
          <a
            href="/admin/users"
            className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <span className="text-2xl">👥</span>
            <span className="text-sm text-gray-600">ユーザー管理</span>
          </a>
          <a
            href="/admin/logs"
            className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <span className="text-2xl">📝</span>
            <span className="text-sm text-gray-600">操作ログ</span>
          </a>
        </div>
      </div>

      {/* 本日の情報 */}
      <div className="bg-amber-50 rounded-xl border border-amber-100 p-6">
        <h2 className="font-semibold text-amber-800 mb-2">📌 本日の情報</h2>
        <p className="text-amber-700">
          {today} の注文受付状況を確認してください。
        </p>
      </div>
    </div>
  )
}

