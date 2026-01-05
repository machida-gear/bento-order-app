import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Link from 'next/link'
import DateCalendar from './date-calendar'
import ChangeUserButton from './change-user-button'

/**
 * 注文一覧ページ（日付指定可能）
 * 管理者が指定日のすべての注文を確認できる
 */
export default async function TodayOrdersPage({
  searchParams,
}: {
  searchParams:
    | Promise<{ date?: string }>
    | { date?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Next.js 16ではsearchParamsがPromiseの場合があるため、awaitで解決
  const params =
    searchParams instanceof Promise ? await searchParams : searchParams

  // 管理者権限チェック
  const { data: currentProfile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const profileTyped = currentProfile as { role?: string; [key: string]: any } | null
  if (profileTyped?.role !== 'admin') {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          管理者権限が必要です
        </div>
      </div>
    )
  }

  // 日付を取得（URLパラメータがあればそれを使用、なければ今日）
  const today = new Date().toISOString().split('T')[0]
  const targetDate = params.date || today

  // 注文がある日付のリストを取得（Service Role Keyを使用してRLSをバイパス）
  const { data: orderDatesData, error: orderDatesError } = await supabaseAdmin
    .from('orders')
    .select('order_date')
    .eq('status', 'ordered')
    .order('order_date', { ascending: false })

  // ユニークな日付のリストを作成（降順でソート）
  const availableDates = orderDatesData
    ? [...new Set(orderDatesData.map((item: any) => item.order_date))]
        .sort((a, b) => (a > b ? -1 : 1))
    : []

  // 指定日の注文を取得（Service Role Keyを使用してRLSをバイパス）
  const { data: orders, error: ordersError } = await supabaseAdmin
    .from('orders')
    .select(`
      id,
      user_id,
      menu_item_id,
      order_date,
      quantity,
      unit_price_snapshot,
      status,
      created_at,
      profiles:user_id (
        id,
        employee_code,
        full_name
      )
    `)
    .eq('order_date', targetDate)
    .eq('status', 'ordered')
    .order('created_at', { ascending: false })

  if (ordersError) {
    console.error('Error fetching orders:', ordersError)
  }

  // メニューIDを取得
  const menuItemIds = orders
    ? [...new Set(orders.map((order: any) => order.menu_item_id).filter(Boolean))]
    : []

  // メニュー情報を取得
  let menuItemsMap = new Map()
  if (menuItemIds.length > 0) {
    const { data: menuItems, error: menuItemsError } = await supabaseAdmin
      .from('menu_items')
      .select(`
        id,
        name,
        vendor_id,
        vendors (
          id,
          code,
          name
        )
      `)
      .in('id', menuItemIds)
      .eq('is_active', true)

    if (!menuItemsError && menuItems) {
      menuItemsMap = new Map(
        menuItems.map((item: any) => [
          item.id,
          {
            name: item.name,
            vendor: item.vendors,
          },
        ])
      )
    }
  }

  // 注文データにメニュー情報を結合
  const ordersWithDetails = orders
    ? orders.map((order: any) => {
        const menuItem = menuItemsMap.get(order.menu_item_id)
        return {
          ...order,
          menu_name: menuItem?.name || 'メニュー不明',
          vendor_name: menuItem?.vendor?.name || '業者不明',
          vendor_code: menuItem?.vendor?.code || '',
          vendor_id: menuItem?.vendor?.id || null,
          menu_item_id_for_group: order.menu_item_id,
          user_name: order.profiles?.full_name || 'ユーザー不明',
          employee_code: order.profiles?.employee_code || '',
          total_price: (order.unit_price_snapshot || 0) * (order.quantity || 1),
        }
      })
    : []

  // 注文時刻順でソート（新しい順）
  ordersWithDetails.sort((a: any, b: any) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  // 業者ごとにグループ化
  const groupedByVendor = ordersWithDetails.reduce((acc: any, order: any) => {
    const vendorKey = order.vendor_id || 'unknown'
    const vendorName = order.vendor_name || '業者不明'
    
    if (!acc[vendorKey]) {
      acc[vendorKey] = {
        vendor_id: vendorKey,
        vendor_name: vendorName,
        vendor_code: order.vendor_code || '',
        menus: {} as any,
      }
    }

    // メニューごとにグループ化
    const menuKey = order.menu_item_id_for_group || 'unknown'
    const menuName = order.menu_name || 'メニュー不明'
    
    if (!acc[vendorKey].menus[menuKey]) {
      acc[vendorKey].menus[menuKey] = {
        menu_item_id: menuKey,
        menu_name: menuName,
        orders: [] as any[],
      }
    }

    acc[vendorKey].menus[menuKey].orders.push(order)
    return acc
  }, {} as any)

  // 業者ごとの合計金額を計算
  const vendorTotals = Object.values(groupedByVendor).map((vendor: any) => {
    const total = Object.values(vendor.menus).reduce((sum: number, menu: any) => {
      return sum + menu.orders.reduce((menuSum: number, order: any) => {
        return menuSum + order.total_price
      }, 0)
    }, 0)
    return { vendor_id: vendor.vendor_id, total }
  })

  // 合計金額を計算
  const totalAmount = ordersWithDetails.reduce(
    (sum, order) => sum + order.total_price,
    0
  )

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📦 注文一覧</h1>
          <p className="text-gray-500 mt-1">{targetDate} の注文状況</p>
        </div>
        <Link
          href="/admin"
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
        >
          ダッシュボードに戻る
        </Link>
      </div>

      {/* 日付選択カレンダー */}
      {orderDatesError ? (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-sm text-red-600">
            注文日付の取得に失敗しました
          </div>
        </div>
      ) : (
        <DateCalendar
          availableDates={availableDates}
          currentDate={targetDate}
          today={today}
        />
      )}

      {/* サマリー */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-gray-500">注文件数</div>
            <div className="text-2xl font-bold text-gray-800 mt-1">
              {ordersWithDetails.length} 件
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">注文者数</div>
            <div className="text-2xl font-bold text-gray-800 mt-1">
              {new Set(ordersWithDetails.map((o: any) => o.user_id)).size} 人
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">合計金額</div>
            <div className="text-2xl font-bold text-gray-800 mt-1">
              ¥{totalAmount.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* エラーメッセージ */}
      {ordersError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <p className="font-medium">データの取得に失敗しました</p>
          <p className="text-sm mt-1">{ordersError.message}</p>
        </div>
      )}

      {/* 注文一覧 */}
      {ordersWithDetails.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          {targetDate === today ? '本日の注文はありません' : `${targetDate} の注文はありません`}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.values(groupedByVendor).map((vendor: any) => {
            const vendorTotal = vendorTotals.find((vt: any) => vt.vendor_id === vendor.vendor_id)?.total || 0
            return (
              <div key={vendor.vendor_id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* 業者ヘッダー */}
                <div className="bg-amber-50 border-b border-amber-200 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-amber-900">
                      🏢 {vendor.vendor_name}
                    </h2>
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-amber-700">
                        小計: <span className="font-bold">¥{vendorTotal.toLocaleString()}</span>
                      </div>
                      <a
                        href={`/api/admin/orders/today/pdf?date=${targetDate}&vendor_id=${vendor.vendor_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                      >
                        📄 PDF出力
                      </a>
                    </div>
                  </div>
                </div>

                {/* メニューごとのグループ */}
                <div className="divide-y divide-gray-100">
                  {Object.values(vendor.menus).map((menu: any) => {
                    const menuTotal = menu.orders.reduce((sum: number, order: any) => sum + order.total_price, 0)
                    const menuQuantity = menu.orders.reduce((sum: number, order: any) => sum + order.quantity, 0)
                    return (
                      <div key={menu.menu_item_id} className="divide-y divide-gray-50">
                        {/* メニューヘッダー */}
                        <div className="bg-gray-50 px-6 py-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-base font-semibold text-gray-800">
                              🍱 {menu.menu_name}
                            </h3>
                            <div className="text-sm text-gray-600">
                              数量: <span className="font-medium">{menuQuantity}</span> | 
                              小計: <span className="font-medium">¥{menuTotal.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        {/* 注文一覧テーブル */}
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">
                                  注文時刻
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">
                                  社員コード
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">
                                  氏名
                                </th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">
                                  数量
                                </th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">
                                  単価
                                </th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">
                                  小計
                                </th>
                                <th className="px-4 py-2 text-center text-xs font-medium text-gray-700">
                                  操作
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {menu.orders.map((order: any) => (
                                <tr key={order.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-2 text-xs text-gray-900">
                                    {new Date(order.created_at).toLocaleTimeString('ja-JP', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </td>
                                  <td className="px-4 py-2 text-xs text-gray-900">
                                    {order.employee_code || '-'}
                                  </td>
                                  <td className="px-4 py-2 text-xs text-gray-900">
                                    <Link
                                      href={`/calendar?user_id=${order.user_id}`}
                                      className="text-blue-600 hover:text-blue-800 hover:underline"
                                    >
                                      {order.user_name}
                                    </Link>
                                  </td>
                                  <td className="px-4 py-2 text-xs text-gray-900 text-right">
                                    {order.quantity}
                                  </td>
                                  <td className="px-4 py-2 text-xs text-gray-900 text-right">
                                    ¥{(order.unit_price_snapshot || 0).toLocaleString()}
                                  </td>
                                  <td className="px-4 py-2 text-xs font-medium text-gray-900 text-right">
                                    ¥{order.total_price.toLocaleString()}
                                  </td>
                                  <td className="px-4 py-2 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                      <Link
                                        href={`/orders/${order.id}/edit?user_id=${order.user_id}`}
                                        className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                      >
                                        詳細
                                      </Link>
                                      <span className="text-gray-300">|</span>
                                      <ChangeUserButton
                                        orderId={order.id}
                                        currentUserId={order.user_id}
                                        currentUserName={order.user_name}
                                      />
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* 全体合計 */}
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-6">
            <div className="flex items-center justify-between">
              <div className="text-lg font-bold text-amber-900">合計金額</div>
              <div className="text-2xl font-bold text-amber-900">
                ¥{totalAmount.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
