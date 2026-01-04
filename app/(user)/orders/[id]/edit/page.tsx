import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OrderEditForm from '@/components/order-edit-form'

/**
 * 注文編集画面
 * URLパラメータ id から注文IDを取得し、注文編集フォームを表示
 */
export default async function EditOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ user_id?: string }> | { user_id?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 管理者権限をチェック
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = currentProfile?.role === 'admin'

  const resolvedParams = await Promise.resolve(params)
  const resolvedSearchParams = await Promise.resolve(searchParams)
  const orderId = parseInt(resolvedParams.id, 10)

  if (isNaN(orderId)) {
    redirect('/calendar')
  }

  // 対象ユーザーIDを決定（管理者がuser_idパラメータを指定した場合はそれを使用、それ以外は現在のユーザーID）
  const targetUserId = (isAdmin && resolvedSearchParams.user_id) ? resolvedSearchParams.user_id : user.id

  // 注文情報を取得（管理者の場合は所有権チェックをスキップ）
  const orderQuery = supabase
    .from('orders')
    .select(`
      *,
      menu_items (
        id,
        name,
        vendor_id
      )
    `)
    .eq('id', orderId)
    .eq('status', 'ordered')

  if (!isAdmin) {
    orderQuery.eq('user_id', user.id)
  } else {
    orderQuery.eq('user_id', targetUserId)
  }

  const { data: order, error: orderError } = await orderQuery.single()

  if (orderError || !order) {
    redirect('/calendar')
  }

  // 注文日の情報を取得
  const { data: orderDay } = await supabase
    .from('order_calendar')
    .select('*')
    .eq('target_date', order.order_date)
    .single()

  if (!orderDay || !orderDay.is_available) {
    redirect('/calendar')
  }

  // 締切時刻をチェック
  const orderDateObj = new Date(order.order_date + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isToday = orderDateObj.getTime() === today.getTime()

  if (isToday && orderDay.deadline_time) {
    const now = new Date()
    const [hours, minutes] = orderDay.deadline_time.split(':').map(Number)
    const deadline = new Date(today)
    deadline.setHours(hours, minutes, 0, 0)

    if (now >= deadline) {
      redirect('/calendar')
    }
  }

  // 過去の日付は変更不可
  if (orderDateObj < today) {
    redirect('/calendar')
  }

  // 有効な業者とメニューを取得
  const { data: vendors, error: vendorsError } = await supabase
    .from('vendors')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (vendorsError) {
    // エラーは無視（空の配列として扱う）
  }

  // 業者が存在する場合のみメニューを取得
  const vendorIds = vendors?.map(v => v.id) || []
  let menuItems = null
  let menuItemsError = null

  if (vendorIds.length > 0) {
    const result = await supabase
      .from('menu_items')
      .select('*')
      .eq('is_active', true)
      .in('vendor_id', vendorIds)
      .order('name', { ascending: true })
    
    menuItems = result.data
    menuItemsError = result.error
  } else {
    menuItems = []
  }

  if (menuItemsError) {
    // エラーは無視（空の配列として扱う）
  }

  // 業者別にメニューをグループ化
  const menusByVendor = new Map<number, typeof menuItems>()
  menuItems?.forEach((menu) => {
    const vendorId = menu.vendor_id
    if (!menusByVendor.has(vendorId)) {
      menusByVendor.set(vendorId, [])
    }
    menusByVendor.get(vendorId)?.push(menu)
  })

  return (
    <div className="space-y-6 pb-20">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">✏️ 注文変更</h1>
        <p className="text-gray-500 mt-1">
          {orderDateObj.getFullYear()}年{orderDateObj.getMonth() + 1}月{orderDateObj.getDate()}日
          {isToday && orderDay.deadline_time && (
            <span className="ml-2 text-sm text-amber-600">
              （締切: {orderDay.deadline_time}）
            </span>
          )}
        </p>
      </div>

      {/* 管理者モードの表示 */}
      {isAdmin && targetUserId !== user.id && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          <p className="font-medium">管理者モード: 代理で注文を編集します</p>
        </div>
      )}

      {/* 現在の注文内容 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm font-medium text-blue-800 mb-2">現在の注文内容</p>
        <p className="text-sm text-blue-700">
          {order.menu_items?.name || 'メニュー名不明'} × {order.quantity}
        </p>
      </div>

      {/* 注文編集フォーム */}
      <OrderEditForm
        orderId={orderId}
        orderDate={order.order_date}
        currentMenuId={order.menu_item_id}
        currentQuantity={order.quantity}
        vendors={vendors || []}
        menusByVendor={menusByVendor}
        deadlineTime={orderDay.deadline_time}
        targetUserId={isAdmin && targetUserId !== user.id ? targetUserId : undefined}
      />
    </div>
  )
}
