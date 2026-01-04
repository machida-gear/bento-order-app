'use client'

import { useEffect, useState } from 'react'
import { Database } from '@/lib/database.types'

// 型定義と実際のDBの不一致に対応
type PriceRow = {
  id: number
  menu_item_id: number
  price: number
  start_date: string
  end_date: string | null
  created_at: string
  menu_items?: {
    id: number
    name: string
    vendor_id: number
    vendors?: {
      id: number
      code: string
      name: string
    } | null
  } | null
}

/**
 * 価格管理画面
 */
export default function AdminPricesPage() {
  const [prices, setPrices] = useState<PriceRow[]>([])
  const [menus, setMenus] = useState<Array<{ id: number; name: string; vendor_id: number; vendors?: { id: number; code: string; name: string } | null }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    menu_item_id: 0,
    price: 0,
    start_date: '',
    end_date: '',
  })
  const [saving, setSaving] = useState(false)

  // データを取得
  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      // 価格一覧を取得
      const pricesResponse = await fetch('/api/admin/prices')
      const pricesResult = await pricesResponse.json()

      if (!pricesResponse.ok) {
        setError(pricesResult.error || '価格一覧の取得に失敗しました')
        return
      }

      setPrices(pricesResult.data || [])

      // メニュー一覧を取得（フォーム用）
      const menusResponse = await fetch('/api/admin/menus')
      const menusResult = await menusResponse.json()

      if (!menusResponse.ok) {
        console.error('Menus fetch error:', menusResult.error)
        return
      }

      setMenus(menusResult.data || [])
    } catch (err) {
      console.error('Fetch error:', err)
      setError('データの取得中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // フォームをリセット
  const resetForm = () => {
    setFormData({
      menu_item_id: menus.length > 0 ? menus[0].id : 0,
      price: 0,
      start_date: '',
      end_date: '',
    })
    setIsEditing(false)
    setEditingId(null)
    setError(null)
  }

  // 新規作成ボタン
  const handleNew = () => {
    if (menus.length === 0) {
      setError('メニューが登録されていません。まずメニューを登録してください。')
      return
    }
    setFormData({
      menu_item_id: menus[0].id,
      price: 0,
      start_date: '',
      end_date: '',
    })
    setEditingId(null)
    setIsEditing(true)
    setError(null)
  }

  // 編集ボタン
  const handleEdit = (price: PriceRow) => {
    setFormData({
      menu_item_id: price.menu_item_id,
      price: price.price,
      start_date: price.start_date,
      end_date: price.end_date || '',
    })
    setEditingId(price.id)
    setIsEditing(true)
    setError(null)
  }

  // 保存
  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)

      if (!formData.menu_item_id || !formData.price || !formData.start_date) {
        setError('メニュー、価格、開始日は必須です')
        return
      }

      const url = editingId
        ? `/api/admin/prices/${editingId}`
        : '/api/admin/prices'
      const method = editingId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          menu_item_id: formData.menu_item_id,
          price: formData.price,
          start_date: formData.start_date,
          end_date: formData.end_date || null,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || '保存に失敗しました')
        return
      }

      // 一覧を再取得
      await fetchData()
      resetForm()
    } catch (err) {
      console.error('Save error:', err)
      setError('保存中にエラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  // 削除
  const handleDelete = async (id: number) => {
    if (!confirm('この価格設定を削除しますか？')) {
      return
    }

    try {
      setError(null)

      const response = await fetch(`/api/admin/prices/${id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || '削除に失敗しました')
        return
      }

      // 一覧を再取得
      await fetchData()
    } catch (err) {
      console.error('Delete error:', err)
      setError('削除中にエラーが発生しました')
    }
  }

  // 業者別、その中でメニュー別にグループ化
  type VendorGroup = {
    vendor: { id: number; name: string }
    menus: Record<number, { menu: { id: number; name: string }; prices: PriceRow[] }>
  }

  const pricesByVendor = prices.reduce((acc, price) => {
    const menu = price.menu_items
    const vendor = menu?.vendors
    if (!vendor || !menu) return acc

    const vendorId = vendor.id
    const menuId = menu.id

    if (!acc[vendorId]) {
      acc[vendorId] = {
        vendor: { id: vendor.id, name: vendor.name },
        menus: {},
      }
    }

    if (!acc[vendorId].menus[menuId]) {
      acc[vendorId].menus[menuId] = {
        menu: { id: menu.id, name: menu.name },
        prices: [],
      }
    }

    acc[vendorId].menus[menuId].prices.push(price)
    return acc
  }, {} as Record<number, VendorGroup>)

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">💰 価格管理</h1>
          <p className="text-gray-500 mt-1">価格履歴の追加・編集・削除</p>
        </div>
        {!isEditing && (
          <button
            onClick={handleNew}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
            disabled={menus.length === 0}
          >
            + 新規作成
          </button>
        )}
      </div>

      {/* エラーメッセージ */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <p>{error}</p>
        </div>
      )}

      {/* 編集フォーム */}
      {isEditing && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            {editingId ? '価格を編集' : '価格を新規作成'}
          </h2>

          <div className="space-y-4">
            {/* メニュー選択 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                メニュー <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.menu_item_id}
                onChange={(e) =>
                  setFormData({ ...formData, menu_item_id: parseInt(e.target.value, 10) })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                disabled={saving}
              >
                <option value={0}>選択してください</option>
                {menus.map((menu) => (
                  <option key={menu.id} value={menu.id}>
                    {menu.vendors ? `${menu.vendors.name} - ` : ''}{menu.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 価格 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                価格（円） <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.price || ''}
                onChange={(e) =>
                  setFormData({ ...formData, price: parseInt(e.target.value, 10) || 0 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="例: 500"
                min="0"
                disabled={saving}
              />
            </div>

            {/* 開始日 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                開始日 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) =>
                  setFormData({ ...formData, start_date: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                disabled={saving}
              />
            </div>

            {/* 終了日 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                終了日（空白の場合は現在有効）
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) =>
                  setFormData({ ...formData, end_date: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                disabled={saving}
              />
            </div>

            {/* ボタン */}
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving || !formData.menu_item_id || !formData.price || !formData.start_date}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? '保存中...' : '保存'}
              </button>
              <button
                onClick={resetForm}
                disabled={saving}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 価格一覧（メニュー別にグループ化） */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          読み込み中...
        </div>
      ) : prices.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          価格が登録されていません
        </div>
      ) : (
        <div className="space-y-8">
          {Object.values(pricesByVendor)
            .sort((a, b) => a.vendor.name.localeCompare(b.vendor.name, 'ja'))
            .map((vendorGroup) => (
              <div key={vendorGroup.vendor.id} className="space-y-4">
                {/* 業者ヘッダー */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="bg-amber-50 px-4 py-3 border-b border-amber-200">
                    <h2 className="text-xl font-semibold text-gray-800">
                      {vendorGroup.vendor.name}
                    </h2>
                  </div>

                  {/* メニュー別の価格一覧 */}
                  <div className="divide-y divide-gray-200">
                    {Object.values(vendorGroup.menus)
                      .sort((a, b) => a.menu.name.localeCompare(b.menu.name, 'ja'))
                      .map((menuGroup) => (
                        <div key={menuGroup.menu.id} className="p-4">
                          <h3 className="text-lg font-medium text-gray-700 mb-3">
                            {menuGroup.menu.name}
                          </h3>
                          <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                              <tr>
                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                                  開始日
                                </th>
                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                                  終了日
                                </th>
                                <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">
                                  価格
                                </th>
                                <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">
                                  操作
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {menuGroup.prices
                                .sort((a, b) => b.start_date.localeCompare(a.start_date))
                                .map((price) => (
                                  <tr key={price.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-sm text-gray-900">
                                      {price.start_date}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-gray-900">
                                      {price.end_date || (
                                        <span className="text-gray-400">現在有効</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2 text-right text-sm font-medium text-gray-900">
                                      ¥{price.price.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2 text-right text-sm">
                                      <div className="flex items-center justify-end gap-2">
                                        <button
                                          onClick={() => handleEdit(price)}
                                          className="px-3 py-1 text-amber-600 hover:bg-amber-50 rounded transition-colors"
                                        >
                                          編集
                                        </button>
                                        <button
                                          onClick={() => handleDelete(price.id)}
                                          className="px-3 py-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                        >
                                          削除
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
