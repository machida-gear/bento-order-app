import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * 社員コードマスター管理API
 * GET /api/admin/employee-codes - 一覧取得
 * POST /api/admin/employee-codes - 新規作成
 */

/**
 * 一覧取得
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // 管理者権限チェック
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    // 社員コードマスター一覧を取得（登録済みユーザー情報も結合）
    const { data, error } = await supabaseAdmin
      .from('employee_codes')
      .select(`
        *,
        registered_profile:profiles!employee_codes_registered_user_id_fkey (
          id,
          employee_code,
          full_name,
          email
        )
      `)
      .order('employee_code', { ascending: true })

    if (error) {
      console.error('Employee codes fetch error:', error)
      return NextResponse.json(
        { error: '社員コードマスターの取得に失敗しました', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: data || [] })
  } catch (error) {
    console.error('Employee codes API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: '社員コードマスターの取得中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}

/**
 * 新規作成
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // 管理者権限チェック
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const body = await request.json()
    const { employee_code, full_name } = body

    // バリデーション
    if (!employee_code || !employee_code.trim()) {
      return NextResponse.json(
        { error: '社員コードは必須です' },
        { status: 400 }
      )
    }

    if (!full_name || !full_name.trim()) {
      return NextResponse.json(
        { error: '氏名は必須です' },
        { status: 400 }
      )
    }

    // 社員コードを4桁に正規化
    const normalizedEmployeeCode = employee_code.trim().padStart(4, '0')

    // 社員コードの重複チェック
    const { data: existing } = await supabaseAdmin
      .from('employee_codes')
      .select('id')
      .eq('employee_code', normalizedEmployeeCode)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'この社員コードは既に登録されています' },
        { status: 400 }
      )
    }

    // 社員コードマスターを作成
    const { data, error } = await supabaseAdmin
      .from('employee_codes')
      .insert({
        employee_code: normalizedEmployeeCode,
        full_name: full_name.trim(),
        is_registered: false,
      })
      .select()
      .single()

    if (error) {
      console.error('Employee code creation error:', error)
      return NextResponse.json(
        { error: '社員コードマスターの作成に失敗しました', details: error.message },
        { status: 500 }
      )
    }

    // 監査ログ記録
    try {
      const headersList = await request.headers
      const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'
      
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: user.id,
        action: 'employee_code.create',
        target_table: 'employee_codes',
        target_id: data.id.toString(),
        details: {
          employee_code: normalizedEmployeeCode,
          full_name: full_name.trim(),
        },
        ip_address: ipAddress,
      })
    } catch (logError) {
      console.error('Audit log insert error:', logError)
      // ログ記録の失敗は無視して処理を続行
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Employee codes API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: '社員コードマスターの作成中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}
