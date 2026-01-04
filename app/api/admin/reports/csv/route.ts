import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'

/**
 * CSV出力API
 * GET /api/admin/reports/csv?period_id=XXX - CSVファイルをダウンロード
 */

/**
 * CSV出力
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

      const { data: period, error: periodError } = await supabase
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

    // CSV形式に変換
    const csvHeader = [
      '注文日',
      '社員コード',
      '氏名',
      '業者コード',
      '業者名',
      'メニュー名',
      '数量',
      '単価',
      '小計',
    ].join(',')

    const csvRows = filteredOrders.map((order: any) => {
      const profile = order.profiles
      const menuItem = order.menu_items
      const vendor = menuItem?.vendors
      
      const orderDate = order.order_date
      const employeeCode = profile?.employee_code || ''
      const fullName = profile?.full_name || ''
      const vendorCode = vendor?.code || ''
      const vendorName = vendor?.name || ''
      const menuName = menuItem?.name || ''
      const quantity = order.quantity || 0
      const unitPrice = order.unit_price_snapshot || 0
      const subtotal = quantity * unitPrice

      return [
        orderDate,
        employeeCode,
        `"${fullName}"`, // カンマを含む可能性があるためクォート
        vendorCode,
        `"${vendorName}"`,
        `"${menuName}"`,
        quantity,
        unitPrice,
        subtotal,
      ].join(',')
    })

    const csvContent = [csvHeader, ...csvRows].join('\n')
    
    // UTF-8 BOMを追加（Excelで正しく開くため）
    const csvWithBOM = '\uFEFF' + csvContent

    // 監査ログ記録
    try {
      const headersList = await headers()
      const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'
      
      await (supabaseAdmin.from('audit_logs') as any).insert({
        actor_id: user.id,
        action: 'csv.download',
        target_table: 'orders',
        target_id: null,
        details: {
          start_date: periodStartDate,
          end_date: periodEndDate,
          vendor_id: vendorId ? parseInt(vendorId, 10) : null,
          user_id: userId || null,
          order_count: filteredOrders.length,
        },
        ip_address: ipAddress,
      })
    } catch (logError) {
      console.error('Audit log insert error:', logError)
      // ログ記録の失敗は無視して処理を続行
    }

    // CSVファイルとして返す
    return new NextResponse(csvWithBOM, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="orders_${periodStartDate}_${periodEndDate}${vendorId ? `_vendor_${vendorId}` : ''}${userId ? `_user_${userId}` : ''}.csv"`,
      },
    })
  } catch (error) {
    console.error('CSV API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'CSV出力中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}
