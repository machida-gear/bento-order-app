import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'

/**
 * メニュー管理API（個別）
 * PUT /api/admin/menus/[id] - メニュー更新
 * DELETE /api/admin/menus/[id] - メニュー削除（is_active=falseに設定）
 */

/**
 * メニュー更新
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const id = parseInt(resolvedParams.id, 10)

    if (isNaN(id)) {
      return NextResponse.json(
        { error: '無効なIDです' },
        { status: 400 }
      )
    }

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

    if (!profile || profile.role !== 'admin') {
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

    const { data, error } = await supabase
      .from('menu_items')
      .update({
        vendor_id,
        name,
        is_active: is_active ?? true,
      })
      .eq('id', id)
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
      console.error('Menu update error:', error)
      return NextResponse.json(
        { error: 'メニューの更新に失敗しました', details: error.message },
        { status: 500 }
      )
    }

    // 監査ログ記録
    try {
      const headersList = await headers()
      const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'
      
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: user.id,
        action: 'menu.update',
        target_table: 'menu_items',
        target_id: id.toString(),
        details: {
          menu_item_id: id,
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
    console.error('Menu PUT API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'メニューの更新中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}

/**
 * メニュー削除（is_active=falseに設定）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const id = parseInt(resolvedParams.id, 10)

    if (isNaN(id)) {
      return NextResponse.json(
        { error: '無効なIDです' },
        { status: 400 }
      )
    }

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

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    // is_active=falseに設定（物理削除ではない）
    const { data, error } = await supabase
      .from('menu_items')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Menu delete error:', error)
      return NextResponse.json(
        { error: 'メニューの削除に失敗しました', details: error.message },
        { status: 500 }
      )
    }

    // 監査ログ記録
    try {
      const headersList = await headers()
      const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'
      
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: user.id,
        action: 'menu.delete',
        target_table: 'menu_items',
        target_id: id.toString(),
        details: {
          menu_item_id: id,
          vendor_id: data.vendor_id,
          name: data.name,
        },
        ip_address: ipAddress,
      })
    } catch (logError) {
      console.error('Audit log insert error:', logError)
      // ログ記録の失敗は無視して処理を続行
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Menu DELETE API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'メニューの削除中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}
