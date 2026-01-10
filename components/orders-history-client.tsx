'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import CancelOrderButton from '@/components/cancel-order-button'

type Order = {
  id: number
  order_date: string
  menu_items: {
    id: string
    name: string
    vendors: {
      id: string
      name: string
    } | null
  } | null
  quantity: number
  unit_price_snapshot: number
  status: string
  [key: string]: any
}

type OrderDay = {
  target_date: string
  deadline_time: string | null
}

type ClosingPeriod = {
  start_date: string
  end_date: string
  label: string
}

interface OrdersHistoryClientProps {
  orders: Order[]
  orderDays: OrderDay[]
  currentPeriod: ClosingPeriod | null
  nextPeriod: ClosingPeriod | null
  selectedPeriod: 'current' | 'next'
}

/**
 * 注文履歴クライアントコンポーネント
 * 締日期間による注文表示と「今月」「来月」の切り替え機能
 */
export default function OrdersHistoryClient({
  orders,
  orderDays,
  currentPeriod,
  nextPeriod,
  selectedPeriod,
}: OrdersHistoryClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // 選択された期間に基づいて注文をフィルタリング
  const selectedPeriodData = selectedPeriod === 'current' ? currentPeriod : nextPeriod
  const filteredOrders = selectedPeriodData
    ? orders.filter((order) => {
        const orderDate = order.order_date
        return orderDate >= selectedPeriodData.start_date && orderDate <= selectedPeriodData.end_date
      })
    : []

  // 日付をキーとしたマップを作成
  const orderDaysMap = new Map(orderDays.map((day) => [day.target_date, day]))

  // 締切時間を過ぎたかどうかを判定する関数（JSTで統一）
  const isAfterDeadline = (
    orderDate: string,
    deadlineTime: string | null
  ): boolean => {
    // JST（UTC+9）で現在時刻を取得
    const now = new Date()
    const jstOffset = 9 * 60 * 60 * 1000 // JSTはUTC+9
    const jstNow = new Date(now.getTime() + jstOffset)
    
    // 今日の日付をJSTで取得（YYYY-MM-DD形式）
    const year = jstNow.getUTCFullYear()
    const month = String(jstNow.getUTCMonth() + 1).padStart(2, '0')
    const day = String(jstNow.getUTCDate()).padStart(2, '0')
    const todayJSTStr = `${year}-${month}-${day}`
    
    // 過去の日付は締切時間を過ぎている
    if (orderDate < todayJSTStr) {
      return true
    }
    
    if (!deadlineTime) {
      return false
    }

    // 今日の日付の場合、現在時刻と締切時刻を比較（JST）
    if (orderDate === todayJSTStr) {
      const [hours, minutes] = deadlineTime.split(':').map(Number)
      let utcHours = hours - 9
      let utcDate = jstNow.getUTCDate()
      let utcMonth = jstNow.getUTCMonth()
      let utcYear = year
      
      // 時刻が負の場合は前日に繰り下げ
      if (utcHours < 0) {
        utcHours += 24
        utcDate -= 1
        if (utcDate < 1) {
          utcMonth -= 1
          if (utcMonth < 0) {
            utcMonth = 11
            utcYear -= 1
          }
          utcDate = new Date(utcYear, utcMonth + 1, 0).getDate()
        }
      }
      
      const deadlineUTC = new Date(Date.UTC(utcYear, utcMonth, utcDate, utcHours, minutes, 0))
      return now >= deadlineUTC
    }

    return false
  }

  // 合計金額を計算（unit_price_snapshotを使用）
  const totalAmount = filteredOrders.reduce((sum, order) => {
    if (order.status === 'ordered' && order.unit_price_snapshot) {
      return sum + order.unit_price_snapshot * order.quantity
    }
    return sum
  }, 0)

  // 期間切り替え
  const handlePeriodChange = (period: 'current' | 'next') => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', period)
    router.push(`/orders?${params.toString()}`)
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📋 注文履歴</h1>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => handlePeriodChange('current')}
              className={`
                px-4 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${
                  selectedPeriod === 'current'
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }
              `}
            >
              今月
            </button>
            {nextPeriod && (
              <button
                onClick={() => handlePeriodChange('next')}
                className={`
                  px-4 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${
                    selectedPeriod === 'next'
                      ? 'bg-amber-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }
                `}
              >
                来月
              </button>
            )}
          </div>
          {selectedPeriodData && (
            <p className="text-gray-500 mt-2 text-sm">{selectedPeriodData.label}</p>
          )}
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">
            {selectedPeriod === 'current' ? '今月' : '来月'}の合計
          </div>
          <div className="text-2xl font-bold text-amber-600">
            ¥{totalAmount.toLocaleString()}
          </div>
        </div>
      </div>

      {/* 注文一覧 */}
      <div className="space-y-3">
        {filteredOrders && filteredOrders.length > 0 ? (
          filteredOrders.map((order) => {
            const date = new Date(order.order_date)
            const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]

            return (
              <div
                key={order.id}
                className={`
                  p-4 rounded-xl border bg-white
                  ${order.status === 'canceled' ? 'opacity-60' : ''}
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center font-bold text-amber-700">
                      {date.getDate()}
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">
                        {date.getMonth() + 1}月{date.getDate()}日（{dayOfWeek}）
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {order.menu_items?.name}
                        {order.quantity > 1 && ` × ${order.quantity}`}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {order.menu_items?.vendors?.name}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-800">
                      ¥{((order.unit_price_snapshot || 0) * order.quantity).toLocaleString()}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {order.status === 'canceled' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                          キャンセル済み
                        </span>
                      ) : (
                        <>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                            注文済み
                          </span>
                          {(() => {
                            const orderDay = orderDaysMap.get(order.order_date)
                            const canCancel = !isAfterDeadline(
                              order.order_date,
                              orderDay?.deadline_time || null
                            )

                            if (canCancel) {
                              return (
                                <CancelOrderButton
                                  orderId={order.id}
                                  orderDate={order.order_date}
                                />
                              )
                            }
                            return null
                          })()}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p>注文履歴がありません</p>
          </div>
        )}
      </div>
    </div>
  )
}
