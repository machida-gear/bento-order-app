import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * 社員コードマスター管理API（個別）
 * PUT /api/admin/employee-codes/[id] - 更新
 * DELETE /api/admin/employee-codes/[id] - 削除
 */

/**
 * 更新
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const profileTyped = profile as { role?: string; [key: string]: any } | null
    if (!profileTyped || profileTyped.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const resolvedParams = await Promise.resolve(params)
    const id = parseInt(resolvedParams.id, 10)
    if (isNaN(id)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 })
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

    // 既存データを取得
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('employee_codes')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: '社員コードマスターが見つかりません' },
        { status: 404 }
      )
    }

    // 登録済みの場合は編集不可
    const existingTyped = existing as { is_registered?: boolean; [key: string]: any } | null
    if (existingTyped?.is_registered) {
      return NextResponse.json(
        { error: '登録済みの社員コードは編集できません' },
        { status: 400 }
      )
    }

    // 社員コードを4桁に正規化
    const normalizedEmployeeCode = employee_code.trim().padStart(4, '0')

    // 社員コードの重複チェック（自分以外）
    if (normalizedEmployeeCode !== existingTyped?.employee_code) {
      const { data: duplicate } = await supabaseAdmin
        .from('employee_codes')
        .select('id')
        .eq('employee_code', normalizedEmployeeCode)
        .neq('id', id)
        .single()

      if (duplicate) {
        return NextResponse.json(
          { error: 'この社員コードは既に登録されています' },
          { status: 400 }
        )
      }
    }

    // 社員コードマスターを更新
    const { data, error } = await (supabaseAdmin
      .from('employee_codes') as any)
      .update({
        employee_code: normalizedEmployeeCode,
        full_name: full_name.trim(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Employee code update error:', error)
      return NextResponse.json(
        { error: '社員コードマスターの更新に失敗しました', details: error.message },
        { status: 500 }
      )
    }

    // 監査ログ記録
    try {
      const headersList = await request.headers
      const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'
      
      await (supabaseAdmin.from('audit_logs') as any).insert({
        actor_id: user.id,
        action: 'employee_code.update',
        target_table: 'employee_codes',
        target_id: id.toString(),
        details: {
          employee_code: normalizedEmployeeCode,
          full_name: full_name.trim(),
          previous: {
            employee_code: existingTyped?.employee_code,
            full_name: existingTyped?.full_name,
          },
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
      { error: '社員コードマスターの更新中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}

/**
 * 削除
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const profileTyped = profile as { role?: string; [key: string]: any } | null
    if (!profileTyped || profileTyped.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const resolvedParams = await Promise.resolve(params)
    const id = parseInt(resolvedParams.id, 10)
    if (isNaN(id)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 })
    }

    // 既存データを取得
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('employee_codes')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: '社員コードマスターが見つかりません' },
        { status: 404 }
      )
    }

    // 登録済みの場合は削除不可
    const existingTypedDelete = existing as { is_registered?: boolean; employee_code?: string; full_name?: string; [key: string]: any } | null
    if (existingTypedDelete?.is_registered) {
      return NextResponse.json(
        { error: '登録済みの社員コードは削除できません' },
        { status: 400 }
      )
    }

    // 社員コードマスターを削除
    const { error } = await supabaseAdmin
      .from('employee_codes')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Employee code deletion error:', error)
      return NextResponse.json(
        { error: '社員コードマスターの削除に失敗しました', details: error.message },
        { status: 500 }
      )
    }

    // 監査ログ記録
    try {
      const headersList = await request.headers
      const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'
      
      await (supabaseAdmin.from('audit_logs') as any).insert({
        actor_id: user.id,
        action: 'employee_code.delete',
        target_table: 'employee_codes',
        target_id: id.toString(),
        details: {
          employee_code: existingTypedDelete?.employee_code,
          full_name: existingTypedDelete?.full_name,
        },
        ip_address: ipAddress,
      })
    } catch (logError) {
      console.error('Audit log insert error:', logError)
      // ログ記録の失敗は無視して処理を続行
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Employee codes API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: '社員コードマスターの削除中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}
