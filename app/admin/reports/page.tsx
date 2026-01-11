'use client'

import { useEffect, useState } from 'react'

type ClosingPeriod = {
  id: number
  label: string | null
  start_date: string
  end_date: string
  status: string | null
  created_at: string
}

type CalculatedPeriod = {
  start_date: string
  end_date: string
  label: string
}

type OrderSummary = {
  order_id: number
  order_date: string
  employee_code: string
  full_name: string
  vendor_code: string
  vendor_name: string
  menu_name: string
  quantity: number
  unit_price: number
  subtotal: number
  is_admin_order: boolean // 代理注文フラグ
}

type Vendor = {
  id: number
  code: string
  name: string
  is_active: boolean
}

type User = {
  id: string
  employee_code: string
  full_name: string
  is_active: boolean
}

/**
 * 集計・CSV出力画面
 */
export default function AdminReportsPage() {
  const [calculatedPeriods, setCalculatedPeriods] = useState<CalculatedPeriod[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<CalculatedPeriod | null>(null)
  const [summary, setSummary] = useState<OrderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [closingDay, setClosingDay] = useState<number | null | undefined>(undefined)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [selectedVendorId, setSelectedVendorId] = useState<string>('')
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [loadingFilters, setLoadingFilters] = useState(false)

  // システム設定から締日を取得して期間を計算
  const fetchSystemSettingsAndCalculatePeriods = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/admin/settings')
      const result = await response.json()

      if (!response.ok || !result.data) {
        setError('システム設定の取得に失敗しました')
        return
      }

      const closingDaySetting = result.data.closing_day
      setClosingDay(closingDaySetting)

      // 締日期間を計算（過去12ヶ月分）
      const periods = calculateClosingPeriods(closingDaySetting, 12)
      setCalculatedPeriods(periods)
    } catch (err) {
      console.error('Fetch error:', err)
      setError('データの取得中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  // 締日期間を計算する関数（来月1ヶ月 + 過去12ヶ月）
  const calculateClosingPeriods = (closingDay: number | null, pastMonthsCount: number): CalculatedPeriod[] => {
    const periods: CalculatedPeriod[] = []
    const today = new Date()
    
    // YYYY-MM-DD形式に変換
    const formatDate = (date: Date): string => {
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    }
    
    // 単一期間を計算する関数
    const calculateSinglePeriod = (year: number, month: number): CalculatedPeriod => {
      // 前月の情報
      const prevMonth = new Date(year, month, 0) // 前月の最終日
      const prevYear = prevMonth.getFullYear()
      const prevMonthIndex = prevMonth.getMonth() // 0-11
      
      let startDate: Date
      let endDate: Date
      
      if (closingDay === null) {
        // 月末締めの場合
        startDate = new Date(year, month, 1)
        endDate = new Date(year, month + 1, 0)
      } else {
        // 指定日締めの場合
        startDate = new Date(prevYear, prevMonthIndex, closingDay + 1)
        endDate = new Date(year, month, closingDay)
        
        // 日付が有効でない場合（例：2月31日など）は月末にする
        if (endDate.getMonth() !== month) {
          endDate = new Date(year, month + 1, 0)
        }
      }
      
      const startDateStr = formatDate(startDate)
      const endDateStr = formatDate(endDate)
      
      // ラベルを生成（例：2025年12月11日～2026年1月10日）
      const startLabel = `${startDate.getFullYear()}年${startDate.getMonth() + 1}月${startDate.getDate()}日`
      const endLabel = `${endDate.getFullYear()}年${endDate.getMonth() + 1}月${endDate.getDate()}日`
      
      return {
        start_date: startDateStr,
        end_date: endDateStr,
        label: `${startLabel}～${endLabel}`,
      }
    }
    
    // 来月の期間を追加
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    periods.push(calculateSinglePeriod(nextMonth.getFullYear(), nextMonth.getMonth()))
    
    // 今月から過去12ヶ月分を追加
    for (let i = 0; i <= pastMonthsCount; i++) {
      const targetMonth = new Date(today.getFullYear(), today.getMonth() - i, 1)
      periods.push(calculateSinglePeriod(targetMonth.getFullYear(), targetMonth.getMonth()))
    }
    
    return periods
  }

  useEffect(() => {
    fetchSystemSettingsAndCalculatePeriods()
    fetchFilters()
  }, [])

  // フィルタ変更時に集計結果を再取得
  useEffect(() => {
    if (selectedPeriod) {
      fetchSummary(selectedPeriod)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVendorId, selectedUserId])

  // 業者とユーザーのリストを取得
  const fetchFilters = async () => {
    try {
      setLoadingFilters(true)
      
      // 業者一覧を取得
      const vendorsResponse = await fetch('/api/admin/vendors')
      const vendorsResult = await vendorsResponse.json()
      if (vendorsResponse.ok && vendorsResult.data) {
        setVendors(vendorsResult.data.filter((v: Vendor) => v.is_active))
      }

      // ユーザー一覧を取得
      const usersResponse = await fetch('/api/admin/users')
      const usersResult = await usersResponse.json()
      if (usersResponse.ok && usersResult.data) {
        setUsers(usersResult.data.filter((u: User) => u.is_active))
      }
    } catch (err) {
      console.error('Filters fetch error:', err)
    } finally {
      setLoadingFilters(false)
    }
  }

  // 集計データを取得
  const fetchSummary = async (period: CalculatedPeriod) => {
    try {
      setLoadingSummary(true)
      setError(null)

      let url = `/api/admin/reports/summary?start_date=${period.start_date}&end_date=${period.end_date}`
      if (selectedVendorId) {
        url += `&vendor_id=${selectedVendorId}`
      }
      if (selectedUserId) {
        url += `&user_id=${selectedUserId}`
      }

      const response = await fetch(url)
      const result = await response.json()

      if (!response.ok) {
        setError(result.error || '集計データの取得に失敗しました')
        return
      }

      setSummary(result.data || [])
    } catch (err) {
      console.error('Summary fetch error:', err)
      setError('集計データの取得中にエラーが発生しました')
    } finally {
      setLoadingSummary(false)
    }
  }

  // 期間選択時の処理
  const handlePeriodChange = (period: CalculatedPeriod) => {
    setSelectedPeriod(period)
    setSelectedVendorId('')
    setSelectedUserId('')
    fetchSummary(period)
  }

  // フィルタ変更時の処理
  const handleFilterChange = () => {
    if (selectedPeriod) {
      fetchSummary(selectedPeriod)
    }
  }

  // CSVダウンロード
  const handleDownloadCSV = () => {
    if (!selectedPeriod) {
      setError('締日期間を選択してください')
      return
    }

    let url = `/api/admin/reports/csv?start_date=${selectedPeriod.start_date}&end_date=${selectedPeriod.end_date}`
    if (selectedVendorId) {
      url += `&vendor_id=${selectedVendorId}`
    }
    if (selectedUserId) {
      url += `&user_id=${selectedUserId}`
    }

    window.location.href = url
  }

  // ユーザーごとの合計金額CSVダウンロード
  const handleDownloadCSVByUser = () => {
    if (!selectedPeriod) {
      setError('締日期間を選択してください')
      return
    }

    let url = `/api/admin/reports/csv-by-user?start_date=${selectedPeriod.start_date}&end_date=${selectedPeriod.end_date}`
    if (selectedVendorId) {
      url += `&vendor_id=${selectedVendorId}`
    }
    if (selectedUserId) {
      url += `&user_id=${selectedUserId}`
    }

    window.location.href = url
  }

  // 合計金額を計算
  const totalAmount = summary.reduce((sum, item) => sum + item.subtotal, 0)

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">📄 レポート・CSV出力</h1>
        <p className="text-gray-500 mt-1">締日期間を選択して集計データを確認・ダウンロード</p>
      </div>

      {/* エラーメッセージ */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <p>{error}</p>
        </div>
      )}

      {/* 締日期間選択 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-800">
            締日期間を選択
          </h2>
          {closingDay !== undefined && (
            <div className="text-xs text-gray-600">
              <span className="font-medium">システム設定の締日: </span>
              {closingDay === null ? '月末締め' : `${closingDay}日`}
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-2 text-sm">
            読み込み中...
          </div>
        ) : closingDay === undefined ? (
          <div className="text-center text-gray-500 py-2 text-sm">
            システム設定の締日を読み込み中...
          </div>
        ) : calculatedPeriods.length === 0 ? (
          <div className="text-center text-gray-500 py-2 text-sm">
            締日期間を計算できませんでした
          </div>
        ) : (
          <select
            value={selectedPeriod ? `${selectedPeriod.start_date}_${selectedPeriod.end_date}` : ''}
            onChange={(e) => {
              const [startDate, endDate] = e.target.value.split('_')
              const period = calculatedPeriods.find(
                (p) => p.start_date === startDate && p.end_date === endDate
              )
              if (period) {
                handlePeriodChange(period)
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
          >
            <option value="">締日期間を選択してください</option>
            {calculatedPeriods.map((period, index) => (
              <option
                key={index}
                value={`${period.start_date}_${period.end_date}`}
              >
                {period.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* フィルタ */}
      {selectedPeriod && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            フィルタ
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                業者で絞り込み
              </label>
              <select
                value={selectedVendorId}
                onChange={(e) => setSelectedVendorId(e.target.value)}
                disabled={loadingFilters}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">すべて</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id.toString()}>
                    {vendor.code} - {vendor.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ユーザーで絞り込み
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                disabled={loadingFilters}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">すべて</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.employee_code} - {user.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 集計結果 */}
      {selectedPeriod && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              集計結果
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handleDownloadCSV}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
              >
                明細CSV
              </button>
              <button
                onClick={handleDownloadCSVByUser}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                ユーザー別合計CSV
              </button>
            </div>
          </div>

          <div className="mb-4 text-sm text-gray-600">
            {selectedPeriod.label}
          </div>

          {loadingSummary ? (
            <div className="text-center text-gray-500 py-8">
              集計データを読み込み中...
            </div>
          ) : summary.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              この期間に注文がありません
            </div>
          ) : (
            <>
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">
                  合計件数: {summary.length}件
                </div>
                <div className="text-lg font-semibold text-gray-800 mt-1">
                  合計金額: ¥{totalAmount.toLocaleString()}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                        注文日
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                        社員コード
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                        氏名
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                        業者
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                        メニュー
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                        数量
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                        単価
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                        小計
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {summary.map((item, index) => (
                      <tr 
                        key={item.order_id || index} 
                        className={`hover:bg-gray-50 ${item.is_admin_order ? 'bg-amber-50 border-l-4 border-amber-500' : ''}`}
                      >
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="flex items-center gap-2">
                            {item.order_date}
                            {item.is_admin_order && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                代理
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.employee_code}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.full_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.vendor_code} - {item.vendor_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.menu_name}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-900">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-900">
                          ¥{item.unit_price.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                          ¥{item.subtotal.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-3 text-right text-sm font-medium text-gray-700"
                      >
                        合計
                      </td>
                      <td className="px-4 py-3 text-right text-lg font-bold text-gray-900">
                        ¥{totalAmount.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
