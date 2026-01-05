'use client'

import { useState, useEffect } from 'react'

interface User {
  id: string
  employee_code: string | null
  full_name: string | null
  is_active: boolean
}

interface ChangeOrderUserModalProps {
  isOpen: boolean
  onClose: () => void
  orderId: number
  currentUserId: string
  currentUserName: string
  onSuccess: () => void
}

export default function ChangeOrderUserModal({
  isOpen,
  onClose,
  orderId,
  currentUserId,
  currentUserName,
  onSuccess,
}: ChangeOrderUserModalProps) {
  const [users, setUsers] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ユーザー一覧を取得
  useEffect(() => {
    if (isOpen) {
      fetchUsers()
    }
  }, [isOpen])

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/users')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'ユーザー一覧の取得に失敗しました')
      }

      // 有効なユーザーのみフィルタリング
      const activeUsers = (data.data || []).filter(
        (user: User) => user.is_active && user.id !== currentUserId
      )
      setUsers(activeUsers)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ユーザー一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedUserId) {
      setError('ユーザーを選択してください')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/change-user`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          new_user_id: selectedUserId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '注文者の変更に失敗しました')
      }

      // 成功時は親コンポーネントに通知してモーダルを閉じる
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '注文者の変更に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            注文者を変更
          </h2>

          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">
              現在の注文者: <span className="font-medium">{currentUserName}</span>
            </p>
            <p className="text-xs text-gray-500">
              締切時間を過ぎた後でも、管理者が注文者を変更できます。
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label
                htmlFor="user-select"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                新しい注文者を選択
              </label>
              {loading ? (
                <div className="p-3 bg-gray-50 rounded border border-gray-200 text-sm text-gray-600">
                  ユーザー一覧を読み込み中...
                </div>
              ) : (
                <select
                  id="user-select"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">選択してください</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.employee_code || '-'} - {user.full_name || '名前不明'}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={submitting || !selectedUserId || loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {submitting ? '変更中...' : '変更する'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
