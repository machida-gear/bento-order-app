import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * 招待コード管理API
 * GET /api/admin/invitation-code - 招待コード情報を取得
 * PUT /api/admin/invitation-code - 招待コードを更新
 */

/**
 * 招待コード情報を取得
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

    const profileTyped = profile as { role?: string; [key: string]: any } | null
    if (!profileTyped || profileTyped.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    // 招待コード情報を取得
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('invitation_code, invitation_code_max_uses, invitation_code_used_count')
      .eq('id', 1)
      .single()

    if (error) {
      console.error('Invitation code fetch error:', error)
      return NextResponse.json(
        { error: '招待コード情報の取得に失敗しました', details: error.message },
        { status: 500 }
      )
    }

    const dataTyped = data as { invitation_code?: string | null; invitation_code_max_uses?: number | null; invitation_code_used_count?: number; [key: string]: any } | null
    return NextResponse.json({ 
      success: true, 
      data: {
        invitation_code: dataTyped?.invitation_code || null,
        invitation_code_max_uses: dataTyped?.invitation_code_max_uses ?? null,
        invitation_code_used_count: dataTyped?.invitation_code_used_count || 0,
      }
    })
  } catch (error) {
    console.error('Invitation code API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: '招待コード情報の取得中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}

/**
 * 招待コードを更新
 */
export async function PUT(request: NextRequest) {
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

    const body = await request.json()
    const { invitation_code, invitation_code_max_uses } = body

    // バリデーション
    if (invitation_code !== undefined && invitation_code !== null) {
      const codeStr = invitation_code.toString().trim()
      if (codeStr.length > 0 && (codeStr.length !== 4 || !/^\d{4}$/.test(codeStr))) {
        return NextResponse.json(
          { error: '招待コードは4桁の数字で入力してください' },
          { status: 400 }
        )
      }
    }

    if (invitation_code_max_uses !== undefined && invitation_code_max_uses !== null) {
      if (typeof invitation_code_max_uses !== 'number' || invitation_code_max_uses < 1 || invitation_code_max_uses > 9999) {
        return NextResponse.json(
          { error: '最大使用回数は1〜9999の範囲で入力してください' },
          { status: 400 }
        )
      }
    }

    // 現在の設定を取得（招待コードの変更を検知するため）
    const { data: currentSettings } = await supabaseAdmin
      .from('system_settings')
      .select('invitation_code')
      .eq('id', 1)
      .single()

    const currentSettingsTyped = currentSettings as { invitation_code?: string | null; [key: string]: any } | null

    // 招待コードが変更された場合、使用回数をリセット
    let shouldResetUsageCount = false
    if (invitation_code !== undefined) {
      const currentCode = currentSettingsTyped?.invitation_code?.trim() || ''
      const newCode = invitation_code?.toString().trim() || ''
      if (currentCode !== newCode) {
        shouldResetUsageCount = true
        console.log('=== Invitation Code Changed ===')
        console.log('Current code:', currentCode)
        console.log('New code:', newCode)
        console.log('Will reset usage count')
      }
    }

    // システム設定を更新
    const updateData: any = {
      invitation_code: invitation_code !== undefined ? (invitation_code?.toString().trim() || null) : undefined,
      invitation_code_max_uses: invitation_code_max_uses !== undefined ? invitation_code_max_uses : undefined,
    }

    // 招待コードが変更された場合、使用回数を0にリセット
    if (shouldResetUsageCount) {
      updateData.invitation_code_used_count = 0
    }

    const { data, error } = await (supabaseAdmin
      .from('system_settings') as any)
      .update(updateData)
      .eq('id', 1)
      .select('invitation_code, invitation_code_max_uses, invitation_code_used_count')
      .single()

    if (error) {
      console.error('Invitation code update error:', error)
      return NextResponse.json(
        { error: '招待コードの更新に失敗しました', details: error.message },
        { status: 500 }
      )
    }

    // 監査ログ記録
    // currentSettingsTypedをtryブロックの外で定義済みなので、ここで使用可能
    const previousInvitationCode = currentSettingsTyped?.invitation_code || null
    try {
      const headersList = await request.headers
      const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'
      
      await (supabaseAdmin.from('audit_logs') as any).insert({
        actor_id: user.id,
        action: 'invitation_code.update',
        target_table: 'system_settings',
        target_id: '1',
        details: {
          invitation_code: (data as any)?.invitation_code || null,
          invitation_code_max_uses: (data as any)?.invitation_code_max_uses ?? null,
          invitation_code_used_count: (data as any)?.invitation_code_used_count || 0,
          previous: {
            invitation_code: previousInvitationCode,
          },
          usage_count_reset: shouldResetUsageCount,
        },
        ip_address: ipAddress,
      })
    } catch (logError) {
      console.error('Audit log insert error:', logError)
      // ログ記録の失敗は無視して処理を続行
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Invitation code API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: '招待コードの更新中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}
