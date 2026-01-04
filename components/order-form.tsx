'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Database } from '@/lib/database.types'

type Vendor = Database['public']['Tables']['vendors']['Row']
type MenuItem = Database['public']['Tables']['menu_items']['Row']

interface OrderFormProps {
  orderDate: string
  vendors: Vendor[]
  menusByVendor: Map<number, MenuItem[]>
  deadlineTime: string | null
  targetUserId?: string  // 管理者が代理操作する場合の対象ユーザーID
}

/**
 * 注文フォームコンポーネント
 */
export default function OrderForm({
  orderDate,
  vendors,
  menusByVendor,
  deadlineTime,
  targetUserId,
}: OrderFormProps) {
  const router = useRouter()
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (!selectedMenuId) {
      setError('メニューを選択してください')
      setLoading(false)
      return
    }

    if (quantity < 1) {
      setError('数量は1以上で入力してください')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          menu_id: selectedMenuId,
          order_date: orderDate,
          quantity,
          ...(targetUserId ? { user_id: targetUserId } : {}),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || '注文に失敗しました')
        setLoading(false)
        return
      }

      // 注文成功後、カレンダーページにリダイレクト（管理者モードの場合はuser_idパラメータを保持）
      // router.refresh()は不要（router.pushで自動的にリフレッシュされる）
      const calendarUrl = targetUserId ? `/calendar?user_id=${targetUserId}` : '/calendar'
      router.push(calendarUrl)
    } catch (err) {
      setError('注文処理中にエラーが発生しました: ' + (err instanceof Error ? err.message : 'Unknown error'))
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* エラーメッセージ */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* メニュー選択 */}
      <div>
        <label htmlFor="menu" className="block text-sm font-medium text-gray-700 mb-2">
          メニューを選択 <span className="text-red-500">*</span>
        </label>
        <div className="space-y-4">
          {vendors.map((vendor) => {
            const menus = menusByVendor.get(vendor.id) || []
            if (menus.length === 0) return null

            return (
              <div key={vendor.id} className="border border-gray-200 rounded-lg p-4">
                <div className="font-medium text-gray-800 mb-2">{vendor.name}</div>
                <div className="space-y-2">
                  {menus.map((menu) => (
                    <label
                      key={menu.id}
                      className={`
                        flex items-center p-3 rounded-lg border cursor-pointer transition-all
                        ${selectedMenuId === menu.id
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-gray-200 hover:border-amber-300'
                        }
                      `}
                    >
                      <input
                        type="radio"
                        name="menu"
                        value={menu.id}
                        checked={selectedMenuId === menu.id}
                        onChange={(e) => setSelectedMenuId(Number(e.target.value))}
                        className="mr-3"
                      />
                      <span className="flex-1 text-gray-800">{menu.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        {(vendors.length === 0 || menusByVendor.size === 0) && (
          <div className="text-center py-8 text-gray-500">
            選択可能なメニューがありません
          </div>
        )}
      </div>

      {/* 数量入力 */}
      <div>
        <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-2">
          数量 <span className="text-red-500">*</span>
        </label>
        <input
          id="quantity"
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          required
          className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-colors outline-none"
        />
      </div>

      {/* 注文確定ボタン */}
      <div className="flex gap-4 pt-4 pb-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={loading || !selectedMenuId}
          className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? '注文中...' : '注文を確定'}
        </button>
      </div>
    </form>
  )
}
