'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface EmployeeCode {
  id: number
  employee_code: string
  full_name: string
  is_registered: boolean
  registered_user_id: string | null
  registered_profile?: {
    id: string
    employee_code: string
    full_name: string
    email: string | null
  } | null
  created_at: string
  updated_at: string
}

/**
 * 社員コードマスター管理画面
 */
export default function AdminEmployeeCodesPage() {
  const supabase = createClient()
  const [employeeCodes, setEmployeeCodes] = useState<EmployeeCode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    employee_code: '',
    full_name: '',
  })
  const [saving, setSaving] = useState(false)

  // 社員コードマスター一覧を取得
  const fetchEmployeeCodes = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/admin/employee-codes')
      const result = await response.json()

      if (!response.ok) {
        setError(result.error || '社員コードマスター一覧の取得に失敗しました')
        return
      }

      setEmployeeCodes(result.data || [])
    } catch (err) {
      console.error('Fetch error:', err)
      setError('データの取得中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmployeeCodes()
  }, [])

  // フォームをリセット
  const resetForm = () => {
    setFormData({
      employee_code: '',
      full_name: '',
    })
    setIsEditing(false)
    setEditingId(null)
    setError(null)
  }

  // 編集ボタン
  const handleEdit = (employeeCode: EmployeeCode) => {
    if (employeeCode.is_registered) {
      setError('登録済みの社員コードは編集できません')
      return
    }
    setFormData({
      employee_code: employeeCode.employee_code,
      full_name: employeeCode.full_name,
    })
    setEditingId(employeeCode.id)
    setIsEditing(true)
    setError(null)
  }

  // 保存
  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)

      // バリデーション
      if (!formData.employee_code || !formData.full_name) {
        setError('社員コードと氏名は必須です')
        return
      }

      const employeeCodeNum = formData.employee_code.replace(/[^0-9]/g, '')
      if (employeeCodeNum.length === 0 || employeeCodeNum.length > 4) {
        setError('社員コードは1〜4桁の数字で入力してください')
        return
      }

      let response
      if (isEditing && editingId) {
        // 更新
        response = await fetch(`/api/admin/employee-codes/${editingId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            employee_code: employeeCodeNum,
            full_name: formData.full_name.trim(),
          }),
        })
      } else {
        // 新規作成
        response = await fetch('/api/admin/employee-codes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            employee_code: employeeCodeNum,
            full_name: formData.full_name.trim(),
          }),
        })
      }

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || '保存に失敗しました')
        return
      }

      // 一覧を再取得
      await fetchEmployeeCodes()
      resetForm()
      alert('保存しました')
    } catch (err) {
      console.error('Save error:', err)
      setError('保存中にエラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  // 削除
  const handleDelete = async (id: number, employeeCode: EmployeeCode) => {
    if (employeeCode.is_registered) {
      alert('登録済みの社員コードは削除できません')
      return
    }

    if (!confirm('この社員コードマスターを削除しますか？')) {
      return
    }

    try {
      setError(null)
      const response = await fetch(`/api/admin/employee-codes/${id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || '削除に失敗しました')
        return
      }

      // 一覧を再取得
      await fetchEmployeeCodes()
      alert('削除しました')
    } catch (err) {
      console.error('Delete error:', err)
      setError('削除中にエラーが発生しました')
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">社員コードマスター管理</h1>
        <p className="text-sm text-gray-600 mt-1">
          新規登録可能な社員コードを管理します
        </p>
      </div>

      {/* エラーメッセージ */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <p>{error}</p>
        </div>
      )}

      {/* フォーム */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          {isEditing ? '編集' : '新規追加'}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              社員コード（1〜4桁） <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.employee_code}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4)
                setFormData({ ...formData, employee_code: value })
              }}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="0001"
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              氏名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="山田 太郎"
              disabled={saving}
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? '保存中...' : '保存'}
            </button>
            {isEditing && (
              <button
                onClick={resetForm}
                disabled={saving}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                キャンセル
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 一覧 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">社員コードマスター一覧</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  社員コード
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  氏名
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状態
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  登録済みユーザー
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employeeCodes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    社員コードマスターが登録されていません
                  </td>
                </tr>
              ) : (
                employeeCodes.map((employeeCode) => (
                  <tr key={employeeCode.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {employeeCode.employee_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {employeeCode.full_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {employeeCode.is_registered ? (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                          登録済み
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                          未登録
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {employeeCode.is_registered && employeeCode.registered_profile ? (
                        <div>
                          <div className="font-medium">{employeeCode.registered_profile.full_name}</div>
                          <div className="text-xs text-gray-500">{employeeCode.registered_profile.email}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        {!employeeCode.is_registered && (
                          <>
                            <button
                              onClick={() => handleEdit(employeeCode)}
                              className="text-amber-600 hover:text-amber-700 font-medium"
                            >
                              編集
                            </button>
                            <button
                              onClick={() => handleDelete(employeeCode.id, employeeCode)}
                              className="text-red-600 hover:text-red-700 font-medium"
                            >
                              削除
                            </button>
                          </>
                        )}
                        {employeeCode.is_registered && (
                          <span className="text-gray-400 text-xs">編集不可</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
