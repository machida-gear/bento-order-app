import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'

/**
 * 業者管理API
 * GET /api/admin/vendors - 業者一覧取得
 * POST /api/admin/vendors - 業者作成
 * PUT /api/admin/vendors/[id] - 業者更新（別ファイル）
 * DELETE /api/admin/vendors/[id] - 業者削除（別ファイル、is_active=falseに設定）
 */

/**
 * 業者一覧取得
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
      .from('vendors')
      .select('*')
      .order('code', { ascending: true })

    if (error) {
      console.error('Vendors fetch error:', error)
      return NextResponse.json(
        { error: '業者一覧の取得に失敗しました', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Vendors API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: '業者一覧の取得中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}

/**
 * 業者作成
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
    const { code, name, is_active } = body

    // バリデーション
    if (!code || !name) {
      return NextResponse.json(
        { error: '業者コードと業者名は必須です' },
        { status: 400 }
      )
    }

    // 業者コードの重複チェック
    const { data: existing } = await supabase
      .from('vendors')
      .select('id')
      .eq('code', code)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'この業者コードは既に使用されています' },
        { status: 409 }
      )
    }

    const { data, error } = await (supabase
      .from('vendors') as any)
      .insert({
        code,
        name,
        is_active: is_active ?? true,
      })
      .select()
      .single()

    if (error) {
      console.error('Vendor insert error:', error)
      return NextResponse.json(
        { error: '業者の作成に失敗しました', details: error.message },
        { status: 500 }
      )
    }

    // 監査ログ記録
    try {
      const headersList = await headers()
      const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'
      
      await (supabaseAdmin.from('audit_logs') as any).insert({
        actor_id: user.id,
        action: 'vendor.create',
        target_table: 'vendors',
        target_id: data.id.toString(),
        details: {
          vendor_id: data.id,
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
    console.error('Vendor POST API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: '業者の作成中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}
