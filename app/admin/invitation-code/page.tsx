'use client'

import { useEffect, useState } from 'react'

interface InvitationCodeSettings {
  invitation_code: string | null
  invitation_code_max_uses: number | null
  invitation_code_used_count: number
}

/**
 * 招待コード管理画面
 */
export default function AdminInvitationCodePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [settings, setSettings] = useState<InvitationCodeSettings>({
    invitation_code: null,
    invitation_code_max_uses: null,
    invitation_code_used_count: 0,
  })

  // 設定を取得
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/api/admin/invitation-code')
        const result = await response.json()

        if (!response.ok) {
          setError(result.error || '設定の取得に失敗しました')
          return
        }

        if (result.data) {
          setSettings(result.data)
        }
      } catch (err) {
        console.error('Fetch error:', err)
        setError('データの取得中にエラーが発生しました')
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  // 設定を保存
  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const response = await fetch('/api/admin/invitation-code', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invitation_code: settings.invitation_code || null,
          invitation_code_max_uses: settings.invitation_code_max_uses,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || '設定の保存に失敗しました')
        return
      }

      // 更新された設定を反映
      if (result.data) {
        setSettings(result.data)
      }

      setSuccess('設定を保存しました')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Save error:', err)
      setError('保存中にエラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  // 使用回数をリセット
  const handleResetUsageCount = async () => {
    if (!confirm('使用回数を0にリセットしますか？')) {
      return
    }

    try {
      setError(null)
      setSuccess(null)

      // reset_usage_countフラグを使用して使用回数をリセット
      const response = await fetch('/api/admin/invitation-code', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invitation_code: settings.invitation_code,
          invitation_code_max_uses: settings.invitation_code_max_uses,
          reset_usage_count: true,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || '使用回数のリセットに失敗しました')
        return
      }

      // 更新された設定を反映
      if (result.data) {
        setSettings(result.data)
      }

      setSuccess('使用回数をリセットしました')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Reset error:', err)
      setError('使用回数のリセット中にエラーが発生しました')
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
        <h1 className="text-2xl font-bold text-gray-800">招待コード管理</h1>
        <p className="text-sm text-gray-600 mt-1">
          新規登録用の招待コードを管理します
        </p>
      </div>

      {/* エラーメッセージ */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <p>{error}</p>
        </div>
      )}

      {/* 成功メッセージ */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          <p>{success}</p>
        </div>
      )}

      {/* 設定フォーム */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-6">招待コード設定</h2>
        <div className="space-y-6">
          {/* 招待コード */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              招待コード（4桁） <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.invitation_code || ''}
                onChange={(e) => {
                  // 数字のみ入力可能、最大4文字
                  const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4)
                  setSettings({ ...settings, invitation_code: value || null })
                }}
                className="flex-1 max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="0000"
                maxLength={4}
                disabled={saving}
              />
              <button
                type="button"
                onClick={() => {
                  // 4桁のランダムな数字を生成（0000〜9999）
                  const code = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
                  setSettings({ ...settings, invitation_code: code })
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                disabled={saving}
              >
                自動生成
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              新規登録時に必要な4桁の数字の招待コードを設定します。空欄にすると新規登録ができなくなります。
            </p>
          </div>

          {/* 使用回数制限 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              最大使用回数
            </label>
            <div className="space-y-3">
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="invitation_code_limit_type"
                    checked={settings.invitation_code_max_uses !== null}
                    onChange={() => {
                      setSettings({ ...settings, invitation_code_max_uses: settings.invitation_code_max_uses ?? 10 })
                    }}
                    className="w-4 h-4 text-amber-600 border-gray-300"
                    disabled={saving}
                  />
                  <span className="text-sm text-gray-700">制限あり</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="invitation_code_limit_type"
                    checked={settings.invitation_code_max_uses === null}
                    onChange={() => {
                      setSettings({ ...settings, invitation_code_max_uses: null })
                    }}
                    className="w-4 h-4 text-amber-600 border-gray-300"
                    disabled={saving}
                  />
                  <span className="text-sm text-gray-700">無制限</span>
                </label>
              </div>
              {settings.invitation_code_max_uses !== null && (
                <div>
                  <input
                    type="number"
                    min="1"
                    max="9999"
                    value={settings.invitation_code_max_uses > 0 ? settings.invitation_code_max_uses : ''}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10)
                      if (!isNaN(value) && value >= 1 && value <= 9999) {
                        setSettings({ ...settings, invitation_code_max_uses: value })
                      } else if (e.target.value === '') {
                        setSettings({ ...settings, invitation_code_max_uses: 0 })
                      }
                    }}
                    onBlur={(e) => {
                      const value = parseInt(e.target.value, 10)
                      if (e.target.value === '' || isNaN(value) || value < 1 || value > 9999) {
                        const currentValue = settings.invitation_code_max_uses
                        if (currentValue && currentValue >= 1 && currentValue <= 9999) {
                          return
                        }
                        setSettings({ ...settings, invitation_code_max_uses: 10 })
                      }
                    }}
                    className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="10"
                    disabled={saving}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    この回数まで招待コードを使用できます（1〜9999回）
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 現在の使用回数 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              現在の使用回数
            </label>
            <div className="flex items-center gap-4">
              <div className="text-lg font-semibold text-gray-800">
                {settings.invitation_code_used_count}
                {settings.invitation_code_max_uses !== null && ` / ${settings.invitation_code_max_uses}`}
              </div>
              {settings.invitation_code_used_count > 0 && (
                <button
                  type="button"
                  onClick={handleResetUsageCount}
                  className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
                >
                  リセット
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              招待コードが使用された回数です。招待コードを変更すると自動的に0にリセットされます。
            </p>
          </div>

          {/* 保存ボタン */}
          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              disabled={saving || !settings.invitation_code}
              className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? '保存中...' : '設定を保存'}
            </button>
          </div>
        </div>
      </div>

      {/* 使い方 */}
      <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
        <h3 className="text-sm font-semibold text-blue-800 mb-3">使い方</h3>
        <ol className="text-sm text-blue-700 space-y-2 list-decimal list-inside">
          <li>「自動生成」ボタンをクリックして4桁の数字コードを生成するか、手動で4桁の数字を入力します</li>
          <li>最大使用回数を設定します（制限なしの場合は「無制限」を選択）</li>
          <li>「設定を保存」ボタンをクリックして保存します</li>
          <li>生成された招待コードを社員に共有します</li>
          <li>社員は新規登録時にこの招待コードを入力して登録します</li>
          <li>使用回数が上限に達すると、新規登録ができなくなります</li>
          <li>招待コードを変更すると、使用回数は自動的に0にリセットされます</li>
        </ol>
      </div>
    </div>
  )
}
