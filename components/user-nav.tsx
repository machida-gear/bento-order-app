'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Tables } from '@/lib/database.types'

type Profile = Tables<'profiles'>

interface UserNavProps {
  profile: Profile
}

/**
 * ユーザー用ナビゲーションバー
 * スマホ向けの下部固定ナビゲーション
 */
export default function UserNav({ profile }: UserNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [showMenu, setShowMenu] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navItems = [
    { href: '/calendar', label: 'カレンダー', icon: '📅' },
    { href: '/orders', label: '注文履歴', icon: '📋' },
    { href: '/settings/auto-order', label: '自動注文', icon: '⚙️' },
  ]

  return (
    <>
      {/* ヘッダー */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🍱</span>
              <span className="font-bold text-gray-800">お弁当注文</span>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span className="text-sm text-gray-600">{profile.full_name}</span>
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-medium">
                  {profile.full_name.charAt(0)}
                </div>
              </button>
              {showMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <div className="font-medium text-gray-800">{profile.full_name}</div>
                    <div className="text-xs text-gray-500">{profile.employee_code}</div>
                  </div>
                  {profile.role === 'admin' && (
                    <Link
                      href="/admin"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      onClick={() => setShowMenu(false)}
                    >
                      🔧 管理画面
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
                  >
                    ログアウト
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 下部ナビゲーション（スマホ向け） */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 pb-safe">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex flex-col items-center justify-center w-full h-full
                  ${isActive ? 'text-amber-600' : 'text-gray-400'}
                `}
              >
                <span className="text-xl mb-0.5">{item.icon}</span>
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* 下部ナビの高さ分のスペーサー */}
      <div className="h-16" />
    </>
  )
}

