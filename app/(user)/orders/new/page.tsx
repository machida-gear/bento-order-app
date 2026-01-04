import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OrderForm from '@/components/order-form'

/**
 * 注文画面
 * URLパラメータ date から注文日を取得し、注文フォームを表示
 */
export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; user_id?: string }>
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

  const isAdmin = (currentProfile as { role?: string } | null)?.role === 'admin'

  // Next.js 16ではsearchParamsがPromise型のため、awaitで解決
  const resolvedSearchParams = await searchParams
  const orderDate = resolvedSearchParams.date
  const targetUserId = (isAdmin && resolvedSearchParams.user_id) ? resolvedSearchParams.user_id : user.id

  if (!orderDate) {
    redirect('/calendar')
  }

  // 注文日のバリデーション（YYYY-MM-DD形式）
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(orderDate)) {
    redirect('/calendar')
  }

  // 注文日のDateオブジェクトを作成
  const orderDateObj = new Date(orderDate + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 過去の日付は注文不可
  if (orderDateObj < today) {
    redirect('/calendar')
  }

  // システム設定を取得（max_order_days_ahead）
  const { data: systemSettings } = await supabase
    .from('system_settings')
    .select('max_order_days_ahead')
    .eq('id', 1)
    .single()

  // 最大注文可能日数をチェック
  const systemSettingsTyped = systemSettings as { max_order_days_ahead?: number } | null
  if (systemSettingsTyped?.max_order_days_ahead) {
    const diffTime = orderDateObj.getTime() - today.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays > systemSettingsTyped.max_order_days_ahead) {
      redirect('/calendar')
    }
  }

  // 注文可能日をチェック
  const { data: orderDay } = await supabase
    .from('order_calendar')
    .select('*')
    .eq('target_date', orderDate)
    .single()

  const orderDayTyped = orderDay as { is_available: boolean; deadline_time?: string | null } | null
  if (!orderDayTyped || !orderDayTyped.is_available) {
    redirect('/calendar')
  }

  // 今日の場合、締切時刻をチェック
  const isToday = orderDateObj.getTime() === today.getTime()
  if (isToday && orderDayTyped.deadline_time) {
    const now = new Date()
    const [hours, minutes] = orderDayTyped.deadline_time.split(':').map(Number)
    const deadline = new Date(today)
    deadline.setHours(hours, minutes, 0, 0)

    if (now >= deadline) {
      redirect('/calendar')
    }
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
  const vendorIds = (vendors as Array<{ id: number | string }> | null)?.map(v => v.id) || []
  let menuItems = null
  let menuItemsError = null

  if (vendorIds.length > 0) {
    // JOINを使わず、メニューを直接取得（vendor_idでフィルタリング）
    const result = await supabase
      .from('menu_items')
      .select('*')
      .eq('is_active', true)
      .in('vendor_id', vendorIds)
      .order('name', { ascending: true })
    
    menuItems = result.data
    menuItemsError = result.error
  } else {
    // 業者が存在しない場合は空配列
    menuItems = []
  }

  if (menuItemsError) {
    // エラーは無視（空の配列として扱う）
  }

  // 業者別にメニューをグループ化（vendor_idを使用）
  type MenuItem = { vendor_id: number | string; [key: string]: any }
  const menusByVendor = new Map() as Map<number, MenuItem[]>
  (menuItems as MenuItem[] | null)?.forEach((menu) => {
    const vendorId = typeof menu.vendor_id === 'string' ? parseInt(menu.vendor_id, 10) : menu.vendor_id
    if (isNaN(vendorId)) return
    if (!menusByVendor.has(vendorId)) {
      menusByVendor.set(vendorId, [])
    }
    menusByVendor.get(vendorId)?.push(menu)
  })

  return (
    <div className="space-y-6 pb-20">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">📝 新規注文</h1>
        <p className="text-gray-500 mt-1">
          {orderDateObj.getFullYear()}年{orderDateObj.getMonth() + 1}月{orderDateObj.getDate()}日
          {isToday && orderDayTyped?.deadline_time && (
            <span className="ml-2 text-sm text-amber-600">
              （締切: {orderDayTyped.deadline_time}）
            </span>
          )}
        </p>
      </div>

      {/* 管理者モードの表示 */}
      {isAdmin && targetUserId !== user.id && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm mb-4">
          <p className="font-medium">管理者モード: 代理で注文を作成します</p>
        </div>
      )}

      {/* 注文フォーム */}
      <OrderForm
        orderDate={orderDate}
        vendors={vendors || []}
        menusByVendor={menusByVendor as any}
        deadlineTime={orderDayTyped?.deadline_time || null}
        targetUserId={isAdmin && targetUserId !== user.id ? targetUserId : undefined}
      />
    </div>
  )
}
