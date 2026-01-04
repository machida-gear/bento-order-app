'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface DateCalendarProps {
  availableDates: string[]
  currentDate: string
  today: string
}

/**
 * 日付選択用カレンダーコンポーネント（クライアントコンポーネント）
 */
export default function DateCalendar({
  availableDates,
  currentDate,
  today,
}: DateCalendarProps) {
  const router = useRouter()

  // 日付をSetに変換して高速検索
  const availableDatesSet = new Set(availableDates)

  // 現在表示する年月を決定（選択中の日付から）
  const currentDateObj = new Date(currentDate)
  const currentYear = currentDateObj.getFullYear()
  const currentMonth = currentDateObj.getMonth() // 0-11

  // 月の最初の日と最後の日
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1)
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0)

  // 日付文字列をフォーマット（YYYY-MM-DD）
  const formatDate = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // 今日の日付文字列
  const todayStr = formatDate(new Date(today))

  // カレンダーの日付配列を生成
  const calendarDays: (Date | null)[] = []

  // 1日の曜日までの空セルを追加
  const firstDayOfWeek = firstDayOfMonth.getDay()
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarDays.push(null)
  }

  // 今月の日付を追加
  const daysInMonth = lastDayOfMonth.getDate()
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(new Date(currentYear, currentMonth, i))
  }

  // 7の倍数になるように空セルを追加
  const remainingCells = 7 - (calendarDays.length % 7)
  if (remainingCells < 7) {
    for (let i = 0; i < remainingCells; i++) {
      calendarDays.push(null)
    }
  }

  // 日付が選択可能かどうか
  const isDateAvailable = (date: Date): boolean => {
    const dateStr = formatDate(date)
    return availableDatesSet.has(dateStr)
  }

  // 日付が今日かどうか
  const isToday = (date: Date): boolean => {
    return formatDate(date) === todayStr
  }

  // 日付が選択中かどうか
  const isSelected = (date: Date): boolean => {
    return formatDate(date) === currentDate
  }

  // 前月・次月の計算
  const prevMonth = new Date(currentYear, currentMonth - 1, 1)
  const nextMonth = new Date(currentYear, currentMonth + 1, 1)
  const prevMonthStr = formatDate(prevMonth)
  const nextMonthStr = formatDate(nextMonth)

  // 前月・次月に注文があるかチェック
  const hasOrdersInPrevMonth = availableDates.some(
    (date) => date.startsWith(`${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`)
  )
  const hasOrdersInNextMonth = availableDates.some(
    (date) => date.startsWith(`${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`)
  )

  const handleDateClick = (date: Date) => {
    const dateStr = formatDate(date)
    if (isDateAvailable(date)) {
      router.push(`/admin/orders/today?date=${dateStr}`)
    }
  }

  const handleMonthChange = (newMonth: Date) => {
    // 新しい月に注文がある日付を探す
    const newMonthStr = `${newMonth.getFullYear()}-${String(newMonth.getMonth() + 1).padStart(2, '0')}`
    const firstAvailableDate = availableDates.find((date) => date.startsWith(newMonthStr))
    
    if (firstAvailableDate) {
      router.push(`/admin/orders/today?date=${firstAvailableDate}`)
    } else {
      // 注文がない場合は、その月の最初の日付を選択（ただし選択不可として表示）
      const firstDayOfNewMonth = formatDate(new Date(newMonth.getFullYear(), newMonth.getMonth(), 1))
      router.push(`/admin/orders/today?date=${firstDayOfNewMonth}`)
    }
  }

  const monthLabel = `${currentYear}年${currentMonth + 1}月`

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      {/* 月ナビゲーション */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => handleMonthChange(prevMonth)}
          disabled={!hasOrdersInPrevMonth}
          className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
            hasOrdersInPrevMonth
              ? 'hover:bg-gray-100 text-gray-600'
              : 'text-gray-300 cursor-not-allowed'
          }`}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-base font-semibold text-gray-800">{monthLabel}</div>
        <button
          onClick={() => handleMonthChange(nextMonth)}
          disabled={!hasOrdersInNextMonth}
          className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
            hasOrdersInNextMonth
              ? 'hover:bg-gray-100 text-gray-600'
              : 'text-gray-300 cursor-not-allowed'
          }`}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['日', '月', '火', '水', '木', '金', '土'].map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-gray-600 py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* カレンダーグリッド */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((date, index) => {
          if (!date) {
            return (
              <div
                key={index}
                className="border border-transparent rounded-lg min-h-[40px]"
              />
            )
          }

          const dateStr = formatDate(date)
          const available = isDateAvailable(date)
          const isTodayDate = isToday(date)
          const selected = isSelected(date)
          const isWeekend = date.getDay() === 0 || date.getDay() === 6

          return (
            <button
              key={index}
              onClick={() => handleDateClick(date)}
              disabled={!available}
              className={`
                border rounded-lg min-h-[40px] p-1 text-sm transition-all
                flex flex-col items-center justify-center
                ${
                  selected
                    ? 'bg-amber-500 text-white font-bold ring-2 ring-amber-300'
                    : available
                    ? isTodayDate
                      ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold hover:bg-amber-100 cursor-pointer'
                      : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50 hover:border-amber-300 cursor-pointer'
                    : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-50'
                }
                ${isWeekend && available && !selected ? 'text-red-600' : ''}
              `}
            >
              <span>{date.getDate()}</span>
              {isTodayDate && available && !selected && (
                <span className="text-[8px] text-amber-600">今日</span>
              )}
            </button>
          )
        })}
      </div>

      {/* 凡例 */}
      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-amber-500 rounded border border-amber-300"></div>
          <span>選択中</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-amber-50 border border-amber-300 rounded"></div>
          <span>今日</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-white border border-gray-200 rounded"></div>
          <span>選択可能</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-gray-100 border border-gray-200 rounded opacity-50"></div>
          <span>選択不可</span>
        </div>
      </div>
    </div>
  )
}
