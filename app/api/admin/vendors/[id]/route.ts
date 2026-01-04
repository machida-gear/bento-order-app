import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'

/**
 * 業者管理API（個別）
 * PUT /api/admin/vendors/[id] - 業者更新
 * DELETE /api/admin/vendors/[id] - 業者削除（is_active=falseに設定）
 */

/**
 * 業者更新
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

    const profileTyped = profile as { role?: string; [key: string]: any } | null
    if (!profileTyped || profileTyped.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const body = await request.json()
    const { code, name, is_active } = body

    // バリデーション
    if (!code || !name) {
      return NextResponse.json(
        { error: '業者コードと業者名は必須です' },
        { status: 400 }
      )
    }

    // 業者コードの重複チェック（自分以外）
    const { data: existing } = await supabase
      .from('vendors')
      .select('id')
      .eq('code', code)
      .neq('id', id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'この業者コードは既に使用されています' },
        { status: 409 }
      )
    }

    const { data, error } = await (supabase
      .from('vendors') as any)
      .update({
        code,
        name,
        is_active: is_active ?? true,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Vendor update error:', error)
      return NextResponse.json(
        { error: '業者の更新に失敗しました', details: error.message },
        { status: 500 }
      )
    }

    // 監査ログ記録
    try {
      const headersList = await headers()
      const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'
      
      await (supabaseAdmin.from('audit_logs') as any).insert({
        actor_id: user.id,
        action: 'vendor.update',
        target_table: 'vendors',
        target_id: id.toString(),
        details: {
          vendor_id: id,
          code: code,
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
    console.error('Vendor PUT API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: '業者の更新中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}

/**
 * 業者削除（is_active=falseに設定）
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

    const profileTyped = profile as { role?: string; [key: string]: any } | null
    if (!profileTyped || profileTyped.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    // is_active=falseに設定（物理削除ではない）
    const { data, error } = await (supabase
      .from('vendors') as any)
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Vendor delete error:', error)
      return NextResponse.json(
        { error: '業者の削除に失敗しました', details: error.message },
        { status: 500 }
      )
    }

    // 監査ログ記録
    try {
      const headersList = await headers()
      const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'
      
      await (supabaseAdmin.from('audit_logs') as any).insert({
        actor_id: user.id,
        action: 'vendor.delete',
        target_table: 'vendors',
        target_id: id.toString(),
        details: {
          vendor_id: id,
          code: data.code,
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
    console.error('Vendor DELETE API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: '業者の削除中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}
