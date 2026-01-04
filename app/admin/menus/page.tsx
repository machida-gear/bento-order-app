'use client'

import { useEffect, useState } from 'react'
import { Database } from '@/lib/database.types'

type MenuItem = Database['public']['Tables']['menu_items']['Row'] & {
  vendors?: {
    id: number
    code: string
    name: string
  } | null
}

/**
 * メニュー管理画面
 */
export default function AdminMenusPage() {
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [vendors, setVendors] = useState<Array<{ id: number; code: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    vendor_id: 0,
    name: '',
    is_active: true,
  })
  const [saving, setSaving] = useState(false)

  // データを取得
  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      // メニュー一覧を取得
      const menusResponse = await fetch('/api/admin/menus')
      const menusResult = await menusResponse.json()

      if (!menusResponse.ok) {
        setError(menusResult.error || 'メニュー一覧の取得に失敗しました')
        return
      }

      setMenus(menusResult.data || [])

      // 業者一覧を取得（フォーム用）
      const vendorsResponse = await fetch('/api/admin/vendors')
      const vendorsResult = await vendorsResponse.json()

      if (!vendorsResponse.ok) {
        console.error('Vendors fetch error:', vendorsResult.error)
        return
      }

      setVendors(vendorsResult.data || [])
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
      vendor_id: vendors.length > 0 ? vendors[0].id : 0,
      name: '',
      is_active: true,
    })
    setIsEditing(false)
    setEditingId(null)
    setError(null)
  }

  // 新規作成ボタン
  const handleNew = () => {
    if (vendors.length === 0) {
      setError('業者が登録されていません。まず業者を登録してください。')
      return
    }
    setFormData({
      vendor_id: vendors[0].id,
      name: '',
      is_active: true,
    })
    setEditingId(null)
    setIsEditing(true)
    setError(null)
  }

  // 編集ボタン
  const handleEdit = (menu: MenuItem) => {
    setFormData({
      vendor_id: menu.vendor_id,
      name: menu.name,
      is_active: menu.is_active,
    })
    setEditingId(menu.id)
    setIsEditing(true)
    setError(null)
  }

  // 保存
  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)

      if (!formData.vendor_id || !formData.name) {
        setError('業者とメニュー名は必須です')
        return
      }

      const url = editingId
        ? `/api/admin/menus/${editingId}`
        : '/api/admin/menus'
      const method = editingId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
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

  // 削除（is_active=false）
  const handleDelete = async (id: number) => {
    if (!confirm('このメニューを無効化しますか？')) {
      return
    }

    try {
      setError(null)

      const response = await fetch(`/api/admin/menus/${id}`, {
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

  // 業者別にグループ化
  const menusByVendor = menus.reduce((acc, menu) => {
    const vendorId = menu.vendor_id
    if (!acc[vendorId]) {
      acc[vendorId] = []
    }
    acc[vendorId].push(menu)
    return acc
  }, {} as Record<number, MenuItem[]>)

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🍱 メニュー管理</h1>
          <p className="text-gray-500 mt-1">メニューの追加・編集・削除</p>
        </div>
        <div className="flex items-center gap-3">
          {!isEditing && (
            <button
              onClick={handleNew}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
              disabled={vendors.length === 0}
            >
              + 新規作成
            </button>
          )}
          <a
            href="/admin"
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            ダッシュボードに戻る
          </a>
        </div>
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
            {editingId ? 'メニューを編集' : 'メニューを新規作成'}
          </h2>

          <div className="space-y-4">
            {/* 業者選択 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                業者 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.vendor_id}
                onChange={(e) =>
                  setFormData({ ...formData, vendor_id: parseInt(e.target.value, 10) })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                disabled={saving}
              >
                <option value={0}>選択してください</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.code} - {vendor.name}
                  </option>
                ))}
              </select>
            </div>

            {/* メニュー名 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                メニュー名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="例: から揚げ弁当"
                disabled={saving}
              />
            </div>

            {/* アクティブ状態 */}
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="w-5 h-5 text-amber-600 rounded border-gray-300"
                  disabled={saving}
                />
                <span className="text-sm font-medium text-gray-700">
                  有効
                </span>
              </label>
            </div>

            {/* ボタン */}
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving || !formData.vendor_id || !formData.name}
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

      {/* メニュー一覧（業者別にグループ化） */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          読み込み中...
        </div>
      ) : menus.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          メニューが登録されていません
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(menusByVendor).map(([vendorId, vendorMenus]) => {
            const vendor = vendorMenus[0]?.vendors
            if (!vendor) return null

            return (
              <div key={vendorId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {vendor.code} - {vendor.name}
                  </h3>
                </div>
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                        メニュー名
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                        状態
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {vendorMenus.map((menu) => (
                      <tr key={menu.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {menu.name}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {menu.is_active ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              有効
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              無効
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEdit(menu)}
                              className="px-3 py-1 text-amber-600 hover:bg-amber-50 rounded transition-colors"
                            >
                              編集
                            </button>
                            {menu.is_active && (
                              <button
                                onClick={() => handleDelete(menu.id)}
                                className="px-3 py-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                削除
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
