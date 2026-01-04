'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface DayOfWeekSetting {
  is_available: boolean
  note: string | null
}

interface SystemSettings {
  id: number
  default_deadline_time: string
  closing_day: number | null
  max_order_days_ahead: number
  day_of_week_settings: {
    [key: string]: DayOfWeekSetting
  }
  company_name: string | null
  company_postal_code: string | null
  company_address1: string | null
  company_address2: string | null
  company_phone: string | null
  company_fax: string | null
  company_email: string | null
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']

/**
 * システム設定画面
 * 管理者がシステム全体の設定を管理する画面
 */
export default function AdminSettingsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<SystemSettings | null>(null)

  // 設定を取得
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('system_settings')
          .select('*')
          .eq('id', 1)
          .single()

        if (error) {
          console.error('Settings fetch error:', error)
          setError('設定の取得に失敗しました')
          return
        }

        if (data) {
          // データが存在する場合は、default_deadline_timeをHH:MM形式に変換
          const formattedData = {
            ...data,
            default_deadline_time: data.default_deadline_time
              ? data.default_deadline_time.toString().slice(0, 5) // "10:00:00" → "10:00"
              : '10:00',
          }
          setSettings(formattedData as SystemSettings)
        } else {
          // データが存在しない場合はデフォルト値を設定
          setSettings({
            id: 1,
            default_deadline_time: '10:00',
            closing_day: 25,
            max_order_days_ahead: 30,
            day_of_week_settings: {
              '0': { is_available: false, note: '週末' },
              '1': { is_available: true, note: null },
              '2': { is_available: true, note: null },
              '3': { is_available: true, note: null },
              '4': { is_available: true, note: null },
              '5': { is_available: true, note: null },
              '6': { is_available: false, note: '週末' },
            },
            company_name: null,
            company_postal_code: null,
            company_address1: null,
            company_address2: null,
            company_phone: null,
            company_fax: null,
            company_email: null,
          })
        }
      } catch (err) {
        console.error('Fetch error:', err)
        setError('データの取得中にエラーが発生しました')
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [supabase])

  // 設定を保存
  const handleSave = async () => {
    if (!settings) return

    try {
      setSaving(true)
      setError(null)

      // API Routeを使用して更新（order_calendarテーブルの更新処理を含む）
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          default_deadline_time: settings.default_deadline_time,
          closing_day: settings.closing_day,
          max_order_days_ahead: settings.max_order_days_ahead,
          day_of_week_settings: settings.day_of_week_settings,
          company_name: settings.company_name,
          company_postal_code: settings.company_postal_code,
          company_address1: settings.company_address1,
          company_address2: settings.company_address2,
          company_phone: settings.company_phone,
          company_fax: settings.company_fax,
          company_email: settings.company_email,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || '設定の保存に失敗しました')
        return
      }

      // 更新された設定を反映（default_deadline_timeをHH:MM形式に変換）
      if (result.data) {
        const formattedData = {
          ...result.data,
          default_deadline_time: result.data.default_deadline_time
            ? result.data.default_deadline_time.toString().slice(0, 5) // "10:00:00" → "10:00"
            : '10:00',
        }
        setSettings(formattedData as SystemSettings)
      }

      alert('設定を保存しました')
    } catch (err) {
      console.error('Save error:', err)
      setError('保存中にエラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  // 曜日設定を更新
  const updateDayOfWeekSetting = (dayIndex: number, field: 'is_available' | 'note', value: boolean | string | null) => {
    if (!settings) return

    const newSettings = { ...settings }
    const dayKey = dayIndex.toString()
    newSettings.day_of_week_settings = {
      ...newSettings.day_of_week_settings,
      [dayKey]: {
        ...newSettings.day_of_week_settings[dayKey],
        [field]: value,
      },
    }
    setSettings(newSettings)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
        読み込み中...
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-red-600">
        設定データが見つかりません
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">⚙️ システム設定</h1>
        <p className="text-gray-500 mt-1">システム全体の設定を管理</p>
      </div>

      {/* エラーメッセージ */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <p>{error}</p>
        </div>
      )}

      {/* 設定フォーム */}
      <div className="space-y-6">
        {/* セクション1: 基本設定 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-200">
            <span className="text-xl">⚙️</span>
            <h2 className="text-lg font-semibold text-gray-800">基本設定</h2>
          </div>
          <div className="space-y-6">
            {/* デフォルト締切時刻 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                デフォルト締切時刻
              </label>
              <input
                type="time"
                value={settings.default_deadline_time}
                onChange={(e) =>
                  setSettings({ ...settings, default_deadline_time: e.target.value })
                }
                className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                カレンダー設定で締切時刻を指定しない場合のデフォルト値
              </p>
            </div>

            {/* 締め日 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                締め日（毎月）
              </label>
              <div className="space-y-3">
                {/* ラジオボタンで選択 */}
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="closing_day_type"
                      checked={settings.closing_day !== null}
                      onChange={() => {
                        // 指定日を選択した場合、デフォルト値として25を設定
                        setSettings({ ...settings, closing_day: settings.closing_day ?? 25 })
                      }}
                      className="w-4 h-4 text-amber-600 border-gray-300"
                    />
                    <span className="text-sm text-gray-700">指定日</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="closing_day_type"
                      checked={settings.closing_day === null}
                      onChange={() => {
                        // 月末締めを選択した場合
                        setSettings({ ...settings, closing_day: null })
                      }}
                      className="w-4 h-4 text-amber-600 border-gray-300"
                    />
                    <span className="text-sm text-gray-700">月末締め</span>
                  </label>
                </div>
                {/* 指定日を選択した場合のみ入力欄を表示 */}
                {settings.closing_day !== null && (
                  <div>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={settings.closing_day > 0 ? settings.closing_day.toString() : ''}
                      onChange={(e) => {
                        const value = e.target.value
                        // 空文字の場合は一時的に0を設定（表示は空になる）
                        if (value === '') {
                          setSettings({ ...settings, closing_day: 0 })
                          return
                        }
                        // 数値のみを許可（先頭の0は許可）
                        if (/^\d*$/.test(value)) {
                          const numValue = parseInt(value, 10)
                          // 数値が有効な場合（範囲外でも一時的に許可）
                          if (!isNaN(numValue)) {
                            setSettings({ ...settings, closing_day: numValue })
                          }
                        }
                      }}
                      onBlur={(e) => {
                        // フォーカスが外れたときにバリデーション
                        const value = e.target.value
                        const numValue = parseInt(value, 10)
                        if (value === '' || isNaN(numValue) || numValue < 1 || numValue > 31) {
                          // 無効な値の場合は、現在の値が有効ならそのまま、無効ならデフォルト値（25）に戻す
                          const currentValue = settings.closing_day
                          if (currentValue >= 1 && currentValue <= 31) {
                            // 現在の値が有効な場合はそのまま
                            return
                          }
                          setSettings({ ...settings, closing_day: 25 })
                        }
                      }}
                      className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="1～31"
                    />
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {settings.closing_day === null
                  ? '月末締めの場合、月によって28日、29日、30日、31日と自動的に設定されます'
                  : '集計の際に使用される締め日（1〜31日）'}
              </p>
            </div>

            {/* 最大注文可能日数 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                最大注文可能日数
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={settings.max_order_days_ahead > 0 ? settings.max_order_days_ahead.toString() : ''}
                onChange={(e) => {
                  const value = e.target.value
                  if (value === '') {
                    setSettings({ ...settings, max_order_days_ahead: 0 })
                    return
                  }
                  if (/^\d*$/.test(value)) {
                    const numValue = parseInt(value, 10)
                    if (!isNaN(numValue) && numValue >= 1 && numValue <= 365) {
                      setSettings({ ...settings, max_order_days_ahead: numValue })
                    }
                  }
                }}
                onBlur={(e) => {
                  const value = e.target.value
                  const numValue = parseInt(value, 10)
                  if (value === '' || isNaN(numValue) || numValue < 1 || numValue > 365) {
                    const currentValue = settings.max_order_days_ahead
                    if (currentValue >= 1 && currentValue <= 365) {
                      return
                    }
                    setSettings({ ...settings, max_order_days_ahead: 30 })
                  }
                }}
                className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="1～365"
              />
              <p className="mt-1 text-xs text-gray-500">
                今日から何日先まで注文可能にするか（1〜365日）。設定日数を超える未来の日付は注文可ボタンがグレーアウトされます。
              </p>
            </div>

          </div>
        </div>

        {/* セクション2: 曜日ごとのデフォルト設定 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-200">
            <span className="text-xl">📅</span>
            <h2 className="text-lg font-semibold text-gray-800">曜日ごとのデフォルト設定</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            月一括編集で使用される各曜日のデフォルト設定を変更できます。
          </p>
          <div className="space-y-3">
            {DAY_NAMES.map((dayName, index) => {
              const dayKey = index.toString()
              const daySetting = settings.day_of_week_settings[dayKey] || {
                is_available: true,
                note: null,
              }

              return (
                <div
                  key={index}
                  className="p-4 border border-gray-200 rounded-lg space-y-3 bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 text-center font-medium text-gray-700">
                      {dayName}曜日
                    </div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={daySetting.is_available}
                        onChange={(e) =>
                          updateDayOfWeekSetting(index, 'is_available', e.target.checked)
                        }
                        className="w-5 h-5 text-amber-600 rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">注文可能</span>
                    </label>
                  </div>
                  {!daySetting.is_available && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        備考
                      </label>
                      <input
                        type="text"
                        value={daySetting.note || ''}
                        onChange={(e) =>
                          updateDayOfWeekSetting(
                            index,
                            'note',
                            e.target.value.trim() || null
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm bg-white"
                        placeholder="備考を入力（例: 週末）"
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* セクション3: 会社情報 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-200">
            <span className="text-xl">🏢</span>
            <h2 className="text-lg font-semibold text-gray-800">会社情報</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            PDF出力などで使用される会社情報を設定します。
          </p>
          <div className="space-y-4">
            {/* 会社名 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                会社名
              </label>
              <input
                type="text"
                value={settings.company_name || ''}
                onChange={(e) =>
                  setSettings({ ...settings, company_name: e.target.value || null })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="例: ●●●●株式会社"
              />
            </div>

            {/* 郵便番号 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                郵便番号
              </label>
              <input
                type="text"
                value={settings.company_postal_code || ''}
                onChange={(e) =>
                  setSettings({ ...settings, company_postal_code: e.target.value || null })
                }
                className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="例: 〒100-0000"
              />
            </div>

            {/* 住所（1行目） */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                住所（1行目）
              </label>
              <input
                type="text"
                value={settings.company_address1 || ''}
                onChange={(e) =>
                  setSettings({ ...settings, company_address1: e.target.value || null })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="例: 東京都千代田区0-1-2"
              />
            </div>

            {/* 住所（2行目） */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                住所（2行目）
              </label>
              <input
                type="text"
                value={settings.company_address2 || ''}
                onChange={(e) =>
                  setSettings({ ...settings, company_address2: e.target.value || null })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="例: ●●ビル 1F"
              />
              <p className="mt-1 text-xs text-gray-500">
                住所が長い場合は2行に分けて入力できます
              </p>
            </div>

            {/* 電話番号 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                電話番号
              </label>
              <input
                type="text"
                value={settings.company_phone || ''}
                onChange={(e) =>
                  setSettings({ ...settings, company_phone: e.target.value || null })
                }
                className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="例: 00-0000-0000"
              />
            </div>

            {/* FAX番号 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                FAX番号
              </label>
              <input
                type="text"
                value={settings.company_fax || ''}
                onChange={(e) =>
                  setSettings({ ...settings, company_fax: e.target.value || null })
                }
                className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="例: 00-0000-0000"
              />
            </div>

            {/* メールアドレス */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                メールアドレス
              </label>
              <input
                type="email"
                value={settings.company_email || ''}
                onChange={(e) =>
                  setSettings({ ...settings, company_email: e.target.value || null })
                }
                className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="例: info@example.com"
              />
            </div>
          </div>
        </div>

        {/* 保存ボタン */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {saving ? '保存中...' : '設定を保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
