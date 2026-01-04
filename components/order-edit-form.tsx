'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Database } from '@/lib/database.types'

type Vendor = Database['public']['Tables']['vendors']['Row']
type MenuItem = Database['public']['Tables']['menu_items']['Row']

interface OrderEditFormProps {
  orderId: number
  orderDate: string
  currentMenuId: number
  currentQuantity: number
  vendors: Vendor[]
  menusByVendor: Map<number, MenuItem[]>
  deadlineTime: string | null
  targetUserId?: string  // 管理者が代理操作する場合の対象ユーザーID
}

/**
 * 注文編集フォームコンポーネント
 */
export default function OrderEditForm({
  orderId,
  orderDate,
  currentMenuId,
  currentQuantity,
  vendors,
  menusByVendor,
  deadlineTime,
  targetUserId,
}: OrderEditFormProps) {
  const router = useRouter()
  const [selectedMenuId, setSelectedMenuId] = useState<number>(currentMenuId)
  const [quantity, setQuantity] = useState(currentQuantity)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

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

    // 変更がない場合はスキップ
    if (selectedMenuId === currentMenuId && quantity === currentQuantity) {
      setError('変更内容がありません')
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          menu_id: selectedMenuId,
          quantity,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || '注文の更新に失敗しました')
        setLoading(false)
        return
      }

      // 更新成功後、カレンダーページにリダイレクト（管理者モードの場合はuser_idパラメータを保持）
      const calendarUrl = targetUserId ? `/calendar?user_id=${targetUserId}` : '/calendar'
      router.push(calendarUrl)
      router.refresh()
    } catch (err) {
      console.error('Order update error:', err)
      setError('注文更新処理中にエラーが発生しました: ' + (err instanceof Error ? err.message : 'Unknown error'))
      setLoading(false)
    }
  }

  const handleCancelOrder = async () => {
    if (!showCancelConfirm) {
      setShowCancelConfirm(true)
      return
    }

    setError(null)
    setLoading(true)

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('Cancel order error:', data)
        const errorMessage = data.error || '注文のキャンセルに失敗しました'
        const details = data.details ? `\n詳細: ${data.details}` : ''
        setError(errorMessage + details)
        setLoading(false)
        setShowCancelConfirm(false)
        return
      }

      // キャンセル成功後、カレンダーページにリダイレクト（管理者モードの場合はuser_idパラメータを保持）
      const calendarUrl = targetUserId ? `/calendar?user_id=${targetUserId}` : '/calendar'
      router.push(calendarUrl)
      router.refresh()
    } catch (err) {
      console.error('Order cancel error:', err)
      setError('注文キャンセル処理中にエラーが発生しました: ' + (err instanceof Error ? err.message : 'Unknown error'))
      setLoading(false)
      setShowCancelConfirm(false)
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

      {/* 注文取りやめボタン */}
      {showCancelConfirm ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-medium text-red-800 mb-3">
            本当に注文を取りやめますか？
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowCancelConfirm(false)
                setError(null)
              }}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
            >
              戻る
            </button>
            <button
              type="button"
              onClick={handleCancelOrder}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '処理中...' : '取りやめ確定'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleCancelOrder}
          disabled={loading}
          className="w-full px-4 py-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium border border-red-300"
        >
          注文を取りやめる
        </button>
      )}

      {/* 更新ボタン */}
      <div className="flex gap-4 pt-4 pb-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
        >
          戻る
        </button>
        <button
          type="submit"
          disabled={loading || !selectedMenuId || (selectedMenuId === currentMenuId && quantity === currentQuantity)}
          className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? '更新中...' : '変更を確定'}
        </button>
      </div>
    </form>
  )
}
