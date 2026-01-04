'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface DateSelectorProps {
  availableDates: string[]
  currentDate: string
  today: string
}

/**
 * 日付選択コンポーネント（クライアントコンポーネント）
 */
export default function DateSelector({
  availableDates,
  currentDate,
  today,
}: DateSelectorProps) {
  const router = useRouter()

  const handleDateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedDate = e.target.value
    router.push(`/admin/orders/today?date=${selectedDate}`)
  }

  if (availableDates.length === 0) {
    return (
      <div className="text-sm text-gray-500">
        注文が存在する日付がありません
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <label htmlFor="date-select" className="text-sm font-medium text-gray-700">
        日付を選択:
      </label>
      <select
        id="date-select"
        value={currentDate}
        onChange={handleDateChange}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
      >
        {availableDates.map((date: string) => {
          const dateObj = new Date(date)
          const isToday = date === today
          const dateLabel = dateObj.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'short',
          })
          return (
            <option key={date} value={date}>
              {dateLabel} {isToday ? '(今日)' : ''}
            </option>
          )
        })}
      </select>
      {currentDate !== today && (
        <Link
          href="/admin/orders/today"
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
        >
          今日に戻る
        </Link>
      )}
    </div>
  )
}
