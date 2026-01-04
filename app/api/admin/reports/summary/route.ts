import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * 集計データ取得API
 * GET /api/admin/reports/summary?period_id=XXX - 集計データを取得
 */

/**
 * 集計データ取得
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // 管理者権限チェック
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const profileTyped = profile as { role?: string; [key: string]: any } | null
    if (!profileTyped || profileTyped.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const periodId = searchParams.get('period_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const vendorId = searchParams.get('vendor_id')
    const userId = searchParams.get('user_id')

    let periodStartDate: string
    let periodEndDate: string

    // period_idまたはstart_date/end_dateのどちらかが必要
    if (periodId) {
      // 既存のperiod_idから取得
      const periodIdNum = parseInt(periodId, 10)
      if (isNaN(periodIdNum)) {
        return NextResponse.json(
          { error: '無効なperiod_idです' },
          { status: 400 }
        )
      }

      const { data: period, error: periodError } = await supabaseAdmin
        .from('closing_periods')
        .select('*')
        .eq('id', periodIdNum)
        .single()

      if (periodError || !period) {
        return NextResponse.json(
          { error: '締日期間が見つかりません' },
          { status: 404 }
        )
      }

      const periodTyped = period as { start_date: string; end_date: string; [key: string]: any }
      periodStartDate = periodTyped.start_date
      periodEndDate = periodTyped.end_date
    } else if (startDate && endDate) {
      // start_date/end_dateから直接使用
      periodStartDate = startDate
      periodEndDate = endDate
    } else {
      return NextResponse.json(
        { error: 'period_idまたはstart_date/end_dateは必須です' },
        { status: 400 }
      )
    }

    // 注文データを取得（status = 'ordered'のみ）
    // Service Role Keyを使用してRLSをバイパス（管理者が代理で作成した注文のプロフィール情報も取得するため）
    let query = supabaseAdmin
      .from('orders')
      .select(`
        *,
        profiles!orders_user_id_fkey (
          employee_code,
          full_name
        ),
        menu_items!orders_menu_item_id_fkey (
          name,
          vendor_id,
          vendors (
            id,
            code,
            name
          )
        )
      `)
      .eq('status', 'ordered')
      .gte('order_date', periodStartDate)
      .lte('order_date', periodEndDate)

    // フィルタ適用（user_idは直接フィルタ可能）
    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data: orders, error: ordersError } = await query
      .order('order_date', { ascending: true })
      .order('created_at', { ascending: true })

    if (ordersError) {
      console.error('Orders fetch error:', ordersError)
      return NextResponse.json(
        { error: '注文データの取得に失敗しました', details: ordersError.message },
        { status: 500 }
      )
    }

    // vendor_idフィルタを適用（Supabaseの制限により、取得後にフィルタリング）
    let filteredOrders = orders || []
    if (vendorId) {
      const vendorIdNum = parseInt(vendorId, 10)
      if (!isNaN(vendorIdNum)) {
        filteredOrders = filteredOrders.filter((order: any) => {
          return order.menu_items?.vendor_id === vendorIdNum
        })
      }
    }

    // 代理注文を識別するため、監査ログを取得
    const orderIds = filteredOrders.map((order: any) => order.id.toString())
    const { data: auditLogs } = await supabaseAdmin
      .from('audit_logs')
      .select('target_id, action')
      .eq('target_table', 'orders')
      .in('target_id', orderIds)
      .or('action.eq.order.create.admin,action.eq.order.update.admin,action.eq.order.cancel.admin')

    // 代理注文のIDセットを作成（target_idは文字列型）
    const adminOrderIds = new Set(
      (auditLogs || [])
        .filter((log: any) => log.action?.includes('.admin'))
        .map((log: any) => parseInt(log.target_id || '0', 10))
    )

    // 集計データに変換
    const summary = filteredOrders.map((order: any) => {
      const profile = order.profiles
      const menuItem = order.menu_items
      const vendor = menuItem?.vendors
      
      const quantity = order.quantity || 0
      const unitPrice = order.unit_price_snapshot || 0
      const subtotal = quantity * unitPrice
      const isAdminOrder = adminOrderIds.has(order.id)

      return {
        order_id: order.id,
        order_date: order.order_date,
        employee_code: profile?.employee_code || '',
        full_name: profile?.full_name || '',
        vendor_code: vendor?.code || '',
        vendor_name: vendor?.name || '',
        menu_name: menuItem?.name || '',
        quantity,
        unit_price: unitPrice,
        subtotal,
        is_admin_order: isAdminOrder, // 代理注文フラグ
      }
    })

    return NextResponse.json({ success: true, data: summary })
  } catch (error) {
    console.error('Summary API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: '集計データの取得中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}
