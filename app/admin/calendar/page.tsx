'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/lib/database.types'

type OrderCalendar = Database['public']['Tables']['order_calendar']['Row']

/**
 * カレンダー管理画面
 * 管理者が注文可能日を設定する画面
 */
export default function AdminCalendarPage() {
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [orderDays, setOrderDays] = useState<Map<string, OrderCalendar>>(new Map())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    is_available: true,
    deadline_time: '10:00',
    note: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkNote, setBulkNote] = useState('')
  const [systemSettings, setSystemSettings] = useState<{
    default_deadline_time: string
    day_of_week_settings: { [key: string]: { is_available: boolean; note: string | null } }
  } | null>(null)

  // URLパラメータから年月を取得
  const yearParam = searchParams.get('year')
  const monthParam = searchParams.get('month')
  const now = new Date()
  const currentYear = yearParam ? parseInt(yearParam, 10) : now.getFullYear()
  const currentMonthDisplay = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1
  const currentMonth = currentMonthDisplay - 1 // 0-11形式

  // 日付文字列をフォーマット（YYYY-MM-DD）
  const formatDateLocal = (date: Date): string => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  // システム設定を取得
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('default_deadline_time, day_of_week_settings')
          .eq('id', 1)
          .single()

        if (error) {
          console.error('Error fetching settings:', error)
          // 設定が取得できなくても続行（デフォルト値を使用）
          return
        }

        if (data) {
          const dataTyped = data as { default_deadline_time?: string | null; day_of_week_settings?: any }
          setSystemSettings({
            default_deadline_time: dataTyped.default_deadline_time || '10:00',
            day_of_week_settings: dataTyped.day_of_week_settings || {},
          })
        }
      } catch (err) {
        console.error('Settings fetch error:', err)
        // エラーが発生しても続行
      }
    }

    fetchSettings()
  }, [supabase])

  // カレンダーデータを取得
  useEffect(() => {
    const fetchCalendar = async () => {
      try {
        setLoading(true)
        
        // 月の最初の日と最後の日
        const firstDayOfMonth = new Date(currentYear, currentMonth, 1)
        const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0)
        const startDateStr = formatDateLocal(firstDayOfMonth)
        const endDateStr = formatDateLocal(lastDayOfMonth)

        const { data, error } = await supabase
          .from('order_calendar')
          .select('*')
          .gte('target_date', startDateStr)
          .lte('target_date', endDateStr)
          .order('target_date', { ascending: true })

        if (error) {
          console.error('Error fetching calendar:', error)
          setError('カレンダーデータの取得に失敗しました')
          return
        }

        // Mapに変換
        const daysMap = new Map<string, OrderCalendar>()
        if (data) {
          (data as Array<{ target_date: string; [key: string]: any }>).forEach((day) => {
            daysMap.set(day.target_date, day as OrderCalendar)
          })
        }

        setOrderDays(daysMap)
      } catch (err) {
        console.error('Fetch error:', err)
        setError('データの取得中にエラーが発生しました')
      } finally {
        setLoading(false)
      }
    }

    fetchCalendar()
  }, [currentYear, currentMonth])

  // 時刻をHH:MM形式に変換（HH:MM:SS形式の場合に対応）
  const formatTime = (time: string | null | undefined): string => {
    if (!time) return '10:00'
    // HH:MM:SS形式の場合はHH:MMに変換
    if (time.includes(':')) {
      const parts = time.split(':')
      return `${parts[0]}:${parts[1]}`
    }
    return time
  }

  // 日付をクリックした時の処理
  const handleDateClick = (dateStr: string) => {
    const existingDay = orderDays.get(dateStr)
    
    if (existingDay) {
      // 既存の設定をフォームに反映
      setEditForm({
        is_available: existingDay.is_available,
        deadline_time: formatTime(existingDay.deadline_time),
        note: existingDay.note || '',
      })
    } else {
      // 新規作成（デフォルト値）
      setEditForm({
        is_available: true,
        deadline_time: '10:00',
        note: '',
      })
    }
    
    setSelectedDate(dateStr)
    setIsEditing(true)
  }

  // フォームを保存
  const handleSave = async () => {
    if (!selectedDate) return

    try {
      setSaving(true)
      setError(null)

      // 注文不可の場合は締切時刻をnullにする
      const deadlineTime = editForm.is_available ? formatTime(editForm.deadline_time) : null

      const response = await fetch('/api/admin/calendar', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target_date: selectedDate,
          is_available: editForm.is_available,
          deadline_time: deadlineTime,
          note: editForm.note || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || '保存に失敗しました')
        return
      }

      // ローカル状態を更新
      const updatedDays = new Map(orderDays)
      updatedDays.set(selectedDate, data.data)
      setOrderDays(updatedDays)

      // 編集モードを閉じる
      setIsEditing(false)
      setSelectedDate(null)
    } catch (err) {
      console.error('Save error:', err)
      setError('保存中にエラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  // キャンセル
  const handleCancel = () => {
    setIsEditing(false)
    setSelectedDate(null)
    setError(null)
  }

  // 月一括編集（設定から曜日ごとの設定を読み込む）
  const handleMonthBulkUpdate = async () => {
    try {
      setSaving(true)
      setError(null)

      if (!systemSettings) {
        setError('システム設定が読み込まれていません。設定画面で設定を確認してください。')
        setSaving(false)
        return
      }

      // 月の最初の日と最後の日を計算
      const firstDay = new Date(currentYear, currentMonth, 1)
      const lastDay = new Date(currentYear, currentMonth + 1, 0)
      const daysInMonth = lastDay.getDate()

      // 月のすべての日付を取得
      const monthDates: string[] = []
      for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(currentYear, currentMonth, i)
        monthDates.push(formatDateLocal(date))
      }

      // 各日付を更新（設定から曜日ごとの設定を読み込む）
      const updatePromises = monthDates.map(async (dateStr) => {
        try {
          const date = new Date(dateStr + 'T00:00:00')
          const dayOfWeek = date.getDay() // 0=日曜, 1=月曜, ..., 6=土曜
          const dayKey = dayOfWeek.toString()
          const daySetting = systemSettings.day_of_week_settings[dayKey] || {
            is_available: true,
            note: null,
          }

          const response = await fetch('/api/admin/calendar', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              target_date: dateStr,
              is_available: daySetting.is_available,
              deadline_time: daySetting.is_available
                ? formatTime(systemSettings.default_deadline_time)
                : null,
              note: daySetting.note,
            }),
          })

          if (!response.ok) {
            const data = await response.json()
            const errorMsg = data.error || '更新に失敗しました'
            const details = data.details ? ` (詳細: ${data.details})` : ''
            const hint = data.hint ? ` [ヒント: ${data.hint}]` : ''
            const code = data.code ? ` [コード: ${data.code}]` : ''
            throw new Error(`${errorMsg}${details}${hint}${code}`)
          }

          const result = await response.json()
          return { status: 'fulfilled' as const, date: dateStr, data: result.data, error: null }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : '更新に失敗しました'
          return { status: 'rejected' as const, date: dateStr, data: null, error: errorMessage }
        }
      })

      const results = await Promise.all(updatePromises)

      // 成功と失敗を分ける
      const successful = results.filter((r) => r.status === 'fulfilled')
      const failed = results.filter((r) => r.status === 'rejected')

      // 成功したものはローカル状態を更新
      const updatedDays = new Map(orderDays)
      successful.forEach((result) => {
        if (result.data) {
          updatedDays.set(result.data.target_date, result.data)
        }
      })
      setOrderDays(updatedDays)

      // エラーメッセージを表示
      if (failed.length > 0) {
        const failedDates = failed.map((f) => f.date).join(', ')
        const errorMessages = failed.map((f) => `${f.date}: ${f.error}`).join('\n')
        setError(
          `${failed.length}件の更新に失敗しました:\n${failedDates}\n\n詳細:\n${errorMessages}`
        )
      } else {
        // すべて成功した場合
        setError(null)
      }
    } catch (err) {
      console.error('Month bulk update error:', err)
      setError(err instanceof Error ? err.message : '月一括更新中にエラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  // 複数日選択モードの切り替え
  const toggleBulkMode = () => {
    setBulkMode(!bulkMode)
    setSelectedDates(new Set())
    setBulkNote('')
    setIsEditing(false)
    setSelectedDate(null)
  }

  // 日付の選択/選択解除
  const toggleDateSelection = (dateStr: string) => {
    const newSelected = new Set(selectedDates)
    if (newSelected.has(dateStr)) {
      newSelected.delete(dateStr)
    } else {
      newSelected.add(dateStr)
    }
    setSelectedDates(newSelected)
  }

  // 一括更新
  const handleBulkUpdate = async (isAvailable: boolean) => {
    if (selectedDates.size === 0) {
      setError('日付を選択してください')
      return
    }

    try {
      setSaving(true)
      setError(null)

      // 備考を設定（空文字の場合はnull）
      const noteValue = bulkNote.trim() || null

      // 各日付を更新（Promise.allSettledを使用して一部失敗しても続行）
      const updatePromises = Array.from(selectedDates).map(async (dateStr) => {
        try {
          const response = await fetch('/api/admin/calendar', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
          body: JSON.stringify({
            target_date: dateStr,
            is_available: isAvailable,
            deadline_time: isAvailable
              ? formatTime(systemSettings?.default_deadline_time || '10:00')
              : null, // 注文可能な場合のみ締切時刻を設定
            note: noteValue,
          }),
          })

          if (!response.ok) {
            const data = await response.json()
            const errorMsg = data.error || '更新に失敗しました'
            const details = data.details ? ` (詳細: ${data.details})` : ''
            const hint = data.hint ? ` [ヒント: ${data.hint}]` : ''
            const code = data.code ? ` [コード: ${data.code}]` : ''
            throw new Error(`${errorMsg}${details}${hint}${code}`)
          }

          const result = await response.json()
          return { status: 'fulfilled' as const, date: dateStr, data: result.data, error: null }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : '更新に失敗しました'
          return { status: 'rejected' as const, date: dateStr, data: null, error: errorMessage }
        }
      })

      const results = await Promise.all(updatePromises)

      // 成功と失敗を分ける
      const successful = results.filter((r) => r.status === 'fulfilled')
      const failed = results.filter((r) => r.status === 'rejected')

      // 成功したものはローカル状態を更新
      const updatedDays = new Map(orderDays)
      successful.forEach((result) => {
        if (result.data) {
          updatedDays.set(result.data.target_date, result.data)
        }
      })
      setOrderDays(updatedDays)

      // エラーメッセージを表示
      if (failed.length > 0) {
        const failedDates = failed.map((f) => f.date).join(', ')
        const errorMessages = failed.map((f) => `${f.date}: ${f.error}`).join('\n')
        setError(
          `${failed.length}件の更新に失敗しました:\n${failedDates}\n\n詳細:\n${errorMessages}`
        )
      } else {
        // すべて成功した場合
        setError(null)
        // 選択をクリア
        setSelectedDates(new Set())
        setBulkNote('')
        setBulkMode(false)
      }
    } catch (err) {
      console.error('Bulk update error:', err)
      setError(err instanceof Error ? err.message : '一括更新中にエラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  // 月の最初の日と最後の日
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1)
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0)

  // カレンダー日付を生成
  const calendarDays: (Date | null)[] = []
  const firstDayOfWeek = firstDayOfMonth.getDay()
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarDays.push(null)
  }
  const daysInMonth = lastDayOfMonth.getDate()
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(new Date(currentYear, currentMonth, i))
  }
  const remainingCells = 7 - (calendarDays.length % 7)
  if (remainingCells < 7) {
    for (let i = 0; i < remainingCells; i++) {
      calendarDays.push(null)
    }
  }

  // 前月・次月
  const prevMonthDisplay = currentMonthDisplay === 1 ? 12 : currentMonthDisplay - 1
  const prevYear = currentMonthDisplay === 1 ? currentYear - 1 : currentYear
  const nextMonthDisplay = currentMonthDisplay === 12 ? 1 : currentMonthDisplay + 1
  const nextYear = currentMonthDisplay === 12 ? currentYear + 1 : currentYear

  const today = new Date()
  const todayStr = formatDateLocal(today)

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">📅 カレンダー設定</h1>
        <p className="text-gray-500 mt-1">注文可能日と締切時刻を設定</p>
      </div>

      {/* エラーメッセージ */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <p className="whitespace-pre-line">{error}</p>
        </div>
      )}

      {/* 月ナビゲーションと一括編集モード */}
      <div className="space-y-3">
        <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4">
          <a
            href={`/admin/calendar?year=${prevYear}&month=${prevMonthDisplay}`}
            className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg
              className="w-6 h-6 text-gray-600"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <div className="text-lg font-semibold text-gray-800">
            {currentYear}年{currentMonthDisplay}月
          </div>
          <a
            href={`/admin/calendar?year=${nextYear}&month=${nextMonthDisplay}`}
            className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg
              className="w-6 h-6 text-gray-600"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>

        {/* 月一括編集 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">月一括編集</h3>
            <button
              onClick={handleMonthBulkUpdate}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {saving ? '更新中...' : `${currentYear}年${currentMonthDisplay}月を一括設定`}
            </button>
          </div>
          <p className="text-xs text-gray-500">
            システム設定で設定した曜日ごとの設定を適用します
          </p>
        </div>

        {/* 一括編集モード切り替え */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={bulkMode}
              onChange={toggleBulkMode}
              className="w-5 h-5 text-amber-600 rounded border-gray-300"
            />
            <span className="text-sm font-medium text-gray-700">
              複数日を選択して一括編集
            </span>
          </label>
          {bulkMode && (
            <>
              {selectedDates.size > 0 && (
                <div className="space-y-3">
                  {/* 備考入力 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      備考（選択したすべての日付に適用）
                    </label>
                    <input
                      type="text"
                      value={bulkNote}
                      onChange={(e) => setBulkNote(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="備考を入力（例: 臨時休業）"
                    />
                  </div>
                  {/* ボタン */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleBulkUpdate(true)}
                      disabled={saving}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      {saving ? '更新中...' : `選択した${selectedDates.size}日を注文可能にする`}
                    </button>
                    <button
                      onClick={() => handleBulkUpdate(false)}
                      disabled={saving}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      {saving ? '更新中...' : `選択した${selectedDates.size}日を注文不可にする`}
                    </button>
                  </div>
                </div>
              )}
              {selectedDates.size === 0 && (
                <p className="text-xs text-gray-500">
                  カレンダーから日付を選択してください
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* カレンダーグリッド */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          読み込み中...
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            {/* 曜日ヘッダー */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['日', '月', '火', '水', '木', '金', '土'].map((day) => (
                <div
                  key={day}
                  className="text-center text-sm font-medium text-gray-600 py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* カレンダーグリッド */}
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((date, index) => {
                if (!date) {
                  return (
                    <div
                      key={index}
                      className="border border-transparent rounded-lg min-h-[100px]"
                    />
                  )
                }

                const dateStr = formatDateLocal(date)
                const orderDay = orderDays.get(dateStr)
                const isAvailable = orderDay?.is_available ?? false
                const isToday = dateStr === todayStr
                const isWeekend = date.getDay() === 0 || date.getDay() === 6
                const isSelected = selectedDates.has(dateStr)

                if (bulkMode) {
                  // 一括編集モード
                  return (
                    <label
                      key={index}
                      className={`
                        border rounded-lg p-2 min-h-[100px] text-left transition-all cursor-pointer
                        ${isAvailable ? 'bg-green-50 border-green-200 hover:bg-green-100' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}
                        ${isToday ? 'ring-2 ring-amber-500' : ''}
                        ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''}
                      `}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleDateSelection(dateStr)}
                          className="mt-1 w-4 h-4 text-amber-600 rounded border-gray-300"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1">
                          <div className={`text-lg font-medium ${isWeekend ? 'text-red-600' : 'text-gray-800'}`}>
                            {date.getDate()}
                          </div>
                          {orderDay && (
                            <div className="mt-1 text-xs text-gray-600">
                              {orderDay.deadline_time && (
                                <div>締切: {formatTime(orderDay.deadline_time)}</div>
                              )}
                              {orderDay.note && (
                                <div className="mt-1 truncate">{orderDay.note}</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </label>
                  )
                }

                // 通常モード
                return (
                  <button
                    key={index}
                    onClick={() => handleDateClick(dateStr)}
                    className={`
                      border rounded-lg p-2 min-h-[100px] text-left transition-all
                      ${isAvailable ? 'bg-green-50 border-green-200 hover:bg-green-100' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}
                      ${isToday ? 'ring-2 ring-amber-500' : ''}
                      ${selectedDate === dateStr ? 'ring-2 ring-blue-500' : ''}
                    `}
                  >
                    <div className={`text-lg font-medium ${isWeekend ? 'text-red-600' : 'text-gray-800'}`}>
                      {date.getDate()}
                    </div>
                    {orderDay && (
                      <div className="mt-1 text-xs text-gray-600">
                        {orderDay.deadline_time && (
                          <div>締切: {formatTime(orderDay.deadline_time)}</div>
                        )}
                        {orderDay.note && (
                          <div className="mt-1 truncate">{orderDay.note}</div>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 編集フォーム */}
          {isEditing && selectedDate && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                {selectedDate} の設定
              </h2>

              <div className="space-y-4">
                {/* 注文可能フラグ */}
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editForm.is_available}
                      onChange={(e) =>
                        setEditForm({ ...editForm, is_available: e.target.checked })
                      }
                      className="w-5 h-5 text-amber-600 rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      注文可能にする
                    </span>
                  </label>
                </div>

                {/* 締切時刻 */}
                {editForm.is_available && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      締切時刻
                    </label>
                    <input
                      type="time"
                      value={editForm.deadline_time}
                      onChange={(e) =>
                        setEditForm({ ...editForm, deadline_time: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                )}

                {/* 備考 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    備考
                  </label>
                  <textarea
                    value={editForm.note}
                    onChange={(e) =>
                      setEditForm({ ...editForm, note: e.target.value })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="休業理由などを入力"
                  />
                </div>

                {/* ボタン */}
                <div className="flex gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving ? '保存中...' : '保存'}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
