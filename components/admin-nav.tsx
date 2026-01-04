'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Tables } from '@/lib/database.types'

type Profile = Tables<'profiles'>

interface AdminNavProps {
  profile: Profile
}

/**
 * 管理者用サイドバーナビゲーション
 * PC向けの左サイドバー
 */
export default function AdminNav({ profile }: AdminNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navItems = [
    { href: '/admin', label: 'ダッシュボード', icon: '📊' },
    { href: '/admin/orders/today', label: '注文一覧', icon: '📦' },
    { href: '/admin/users', label: 'ユーザー管理', icon: '👥' },
    { href: '/admin/invitation-code', label: '招待コード管理', icon: '🎫' },
    { href: '/admin/vendors', label: '業者管理', icon: '🏢' },
    { href: '/admin/menus', label: 'メニュー管理', icon: '🍱' },
    { href: '/admin/prices', label: '価格管理', icon: '💰' },
    { href: '/admin/calendar', label: 'カレンダー設定', icon: '📅' },
    { href: '/admin/settings', label: 'システム設定', icon: '⚙️' },
    { href: '/admin/reports', label: 'レポート・CSV', icon: '📄' },
    { href: '/admin/logs', label: '操作ログ', icon: '📝' },
  ]

  const NavContent = () => (
    <>
      {/* ロゴ */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🍱</span>
          <div>
            <div className="font-bold text-gray-800">お弁当注文</div>
            <div className="text-xs text-gray-500">管理画面</div>
          </div>
        </div>
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setShowMobileMenu(false)}
              className={`
                flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${isActive
                  ? 'bg-amber-100 text-amber-800'
                  : 'text-gray-600 hover:bg-gray-100'
                }
              `}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* ユーザー向け画面へ */}
      <div className="p-4 border-t border-gray-200">
        <Link
          href="/calendar"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          <span>👤</span>
          <span>ユーザー画面へ</span>
        </Link>
      </div>

      {/* ユーザー情報 */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-medium">
            {profile.full_name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-800 truncate">{profile.full_name}</div>
            <div className="text-xs text-gray-500">{profile.employee_code}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full mt-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          ログアウト
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* モバイルヘッダー */}
      <header className="lg:hidden sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between h-14 px-4">
          <button
            onClick={() => setShowMobileMenu(true)}
            className="p-2 -ml-2 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xl">🍱</span>
            <span className="font-bold text-gray-800">管理画面</span>
          </div>
          <div className="w-10" />
        </div>
      </header>

      {/* モバイルメニュー */}
      {showMobileMenu && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowMobileMenu(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-white flex flex-col">
            <NavContent />
          </div>
        </div>
      )}

      {/* PC サイドバー */}
      <aside className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 bg-white border-r border-gray-200 flex-col">
        <NavContent />
      </aside>
    </>
  )
}

