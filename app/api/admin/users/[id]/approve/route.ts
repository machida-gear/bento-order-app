import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'

/**
 * ユーザー承認API
 * POST /api/admin/users/[id]/approve - ユーザーを承認（is_active=trueに設定）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const id = resolvedParams.id

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // 管理者権限チェック（Service Role Keyを使用してRLSをバイパス）
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'プロフィールの取得に失敗しました', details: profileError?.message },
        { status: 500 }
      )
    }

    if (profile.role !== 'admin') {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      )
    }

    if (!profile.is_active) {
      return NextResponse.json(
        { error: 'アカウントが無効化されています' },
        { status: 403 }
      )
    }

    // 承認対象ユーザーの情報を取得
    const { data: targetUser, error: targetUserError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()

    if (targetUserError || !targetUser) {
      return NextResponse.json(
        { error: '承認対象のユーザーが見つかりません', details: targetUserError?.message },
        { status: 404 }
      )
    }

    // 既に承認済みの場合はエラー
    if (targetUser.is_active) {
      return NextResponse.json(
        { error: 'このユーザーは既に承認済みです' },
        { status: 400 }
      )
    }

    // 社員コードの重複チェック
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('employee_code', targetUser.employee_code)
      .neq('id', id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'この社員コードは既に使用されています' },
        { status: 409 }
      )
    }

    // ユーザーを承認（is_active=trueに設定）
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ is_active: true })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('User approval error:', error)
      return NextResponse.json(
        { error: 'ユーザーの承認に失敗しました', details: error.message },
        { status: 500 }
      )
    }

    // 監査ログ記録
    try {
      const headersList = await headers()
      const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'
      
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: user.id,
        action: 'user.approve',
        target_table: 'profiles',
        target_id: id,
        details: {
          user_id: id,
          employee_code: targetUser.employee_code,
          full_name: targetUser.full_name,
          email: targetUser.email,
        },
        ip_address: ipAddress,
      })
    } catch (logError) {
      console.error('Audit log insert error:', logError)
      // ログ記録の失敗は無視して処理を続行
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('User approval API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'ユーザーの承認中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}
