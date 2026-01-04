'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/lib/database.types'

type Vendor = Database['public']['Tables']['vendors']['Row']

/**
 * 業者管理画面
 */
export default function AdminVendorsPage() {
  const supabase = createClient()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    is_active: true,
  })
  const [saving, setSaving] = useState(false)

  // 業者一覧を取得
  const fetchVendors = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/admin/vendors')
      const result = await response.json()

      if (!response.ok) {
        setError(result.error || '業者一覧の取得に失敗しました')
        return
      }

      setVendors(result.data || [])
    } catch (err) {
      console.error('Fetch error:', err)
      setError('データの取得中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVendors()
  }, [])

  // フォームをリセット
  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      is_active: true,
    })
    setIsEditing(false)
    setEditingId(null)
    setError(null)
  }

  // 新規作成ボタン
  const handleNew = () => {
    resetForm()
    setIsEditing(true)
  }

  // 編集ボタン
  const handleEdit = (vendor: Vendor) => {
    setFormData({
      code: vendor.code,
      name: vendor.name,
      is_active: vendor.is_active,
    })
    setEditingId(vendor.id)
    setIsEditing(true)
    setError(null)
  }

  // 保存
  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)

      const url = editingId
        ? `/api/admin/vendors/${editingId}`
        : '/api/admin/vendors'
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
      await fetchVendors()
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
    if (!confirm('この業者を無効化しますか？')) {
      return
    }

    try {
      setError(null)

      const response = await fetch(`/api/admin/vendors/${id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || '削除に失敗しました')
        return
      }

      // 一覧を再取得
      await fetchVendors()
    } catch (err) {
      console.error('Delete error:', err)
      setError('削除中にエラーが発生しました')
    }
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🏢 業者管理</h1>
          <p className="text-gray-500 mt-1">業者の追加・編集・削除</p>
        </div>
        <div className="flex items-center gap-3">
          {!isEditing && (
            <button
              onClick={handleNew}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
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
            {editingId ? '業者を編集' : '業者を新規作成'}
          </h2>

          <div className="space-y-4">
            {/* 業者コード */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                業者コード <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="例: V001"
                disabled={saving}
              />
            </div>

            {/* 業者名 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                業者名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="例: 株式会社○○"
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
                disabled={saving || !formData.code || !formData.name}
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

      {/* 業者一覧 */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          読み込み中...
        </div>
      ) : vendors.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          業者が登録されていません
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  業者コード
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  業者名
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
              {vendors.map((vendor) => (
                <tr key={vendor.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {vendor.code}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {vendor.name}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {vendor.is_active ? (
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
                        onClick={() => handleEdit(vendor)}
                        className="px-3 py-1 text-amber-600 hover:bg-amber-50 rounded transition-colors"
                      >
                        編集
                      </button>
                      {vendor.is_active && (
                        <button
                          onClick={() => handleDelete(vendor.id)}
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
      )}
    </div>
  )
}
