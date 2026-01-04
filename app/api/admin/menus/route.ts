import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'

/**
 * メニュー管理API
 * GET /api/admin/menus - メニュー一覧取得
 * POST /api/admin/menus - メニュー作成
 */

/**
 * メニュー一覧取得（業者情報も含む）
 */
export async function GET() {
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

    const { data, error } = await supabase
      .from('menu_items')
      .select(`
        *,
        vendors (
          id,
          code,
          name
        )
      `)
      .order('vendor_id', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      console.error('Menus fetch error:', error)
      return NextResponse.json(
        { error: 'メニュー一覧の取得に失敗しました', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Menus API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'メニュー一覧の取得中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}

/**
 * メニュー作成
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { vendor_id, name, is_active } = body

    // バリデーション
    if (!vendor_id || !name) {
      return NextResponse.json(
        { error: '業者IDとメニュー名は必須です' },
        { status: 400 }
      )
    }

    // 業者の存在確認
    const { data: vendor } = await supabase
      .from('vendors')
      .select('id')
      .eq('id', vendor_id)
      .single()

    if (!vendor) {
      return NextResponse.json(
        { error: '指定された業者が存在しません' },
        { status: 404 }
      )
    }

    const { data, error } = await (supabase
      .from('menu_items') as any)
      .insert({
        vendor_id,
        name,
        is_active: is_active ?? true,
      })
      .select(`
        *,
        vendors (
          id,
          code,
          name
        )
      `)
      .single()

    if (error) {
      console.error('Menu insert error:', error)
      return NextResponse.json(
        { error: 'メニューの作成に失敗しました', details: error.message },
        { status: 500 }
      )
    }

    // 監査ログ記録
    try {
      const headersList = await headers()
      const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'
      
      await (supabaseAdmin.from('audit_logs') as any).insert({
        actor_id: user.id,
        action: 'menu.create',
        target_table: 'menu_items',
        target_id: data.id.toString(),
        details: {
          menu_item_id: data.id,
          vendor_id: vendor_id,
          name: name,
          is_active: is_active ?? true,
        },
        ip_address: ipAddress,
      })
    } catch (logError) {
      console.error('Audit log insert error:', logError)
      // ログ記録の失敗は無視して処理を続行
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Menu POST API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'メニューの作成中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}
