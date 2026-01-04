import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'

/**
 * カレンダー管理API
 * PUT /api/admin/calendar - 日付の設定を更新
 */

/**
 * カレンダー設定を更新
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
      console.error('Auth error:', authError)
      return NextResponse.json({ error: '認証エラーが発生しました', details: authError.message }, { status: 401 })
    }

    if (!user) {
      console.error('No user found')
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    console.log('User authenticated:', { userId: user.id, email: user.email })

    // 管理者権限チェック（is_activeも確認）
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, is_active, full_name, employee_code')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Profile fetch error:', profileError)
      console.error('Profile error details:', JSON.stringify(profileError, null, 2))
      return NextResponse.json(
        { error: 'プロフィールの取得に失敗しました', details: profileError.message, code: profileError.code },
        { status: 500 }
      )
    }

    if (!profile) {
      console.error('Profile not found for user:', user.id)
      return NextResponse.json({ error: 'プロフィールが見つかりません' }, { status: 403 })
    }

    console.log('Profile found:', { userId: user.id, role: profile.role, is_active: profile.is_active, name: profile.full_name })

    if (profile.role !== 'admin') {
      console.error('User is not admin:', { userId: user.id, role: profile.role })
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    if (!profile.is_active) {
      console.error('User account is inactive:', { userId: user.id })
      return NextResponse.json({ error: 'アカウントが無効化されています' }, { status: 403 })
    }

    console.log('Admin check passed:', { userId: user.id, role: profile.role, is_active: profile.is_active })

    const body = await request.json()
    const { target_date, is_available, deadline_time, note } = body

    // バリデーション
    if (!target_date) {
      return NextResponse.json(
        { error: 'target_dateは必須です' },
        { status: 400 }
      )
    }

    // 日付形式のバリデーション
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(target_date)) {
      return NextResponse.json(
        { error: '日付の形式が正しくありません（YYYY-MM-DD形式で入力してください）' },
        { status: 400 }
      )
    }

    // 時刻形式のバリデーション（指定されている場合）
    if (deadline_time && deadline_time !== null) {
      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/
      if (!timeRegex.test(deadline_time)) {
        return NextResponse.json(
          { error: '締切時刻の形式が正しくありません（HH:MM形式で入力してください）' },
          { status: 400 }
        )
      }
    }

    // deadline_timeの処理
    // is_availableがfalseの場合は締切時刻は不要（NULLを設定）
    // is_availableがtrueの場合は、指定された時刻またはデフォルトの'10:00'を設定
    let finalDeadlineTime: string | null = null
    if (is_available) {
      finalDeadlineTime = deadline_time || '10:00'
    }

    // upsert（既に存在する場合は更新、存在しない場合は作成）
    const { data, error } = await supabase
      .from('order_calendar')
      .upsert({
        target_date,
        is_available: is_available ?? true,
        deadline_time: finalDeadlineTime,
        note: note || null,
      }, {
        onConflict: 'target_date',
      })
      .select()
      .single()

    if (error) {
      console.error('Calendar update error:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      console.error('Request body:', JSON.stringify({ target_date, is_available, deadline_time: finalDeadlineTime, note }, null, 2))
      return NextResponse.json(
        { 
          error: 'カレンダー設定の更新に失敗しました', 
          details: error.message,
          code: error.code,
          hint: error.hint,
          fullError: JSON.stringify(error)
        },
        { status: 500 }
      )
    }

    // 監査ログ記録
    try {
      const headersList = await headers()
      const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'
      
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: user.id,
        action: 'calendar.update',
        target_table: 'order_calendar',
        target_id: target_date,
        details: {
          target_date: target_date,
          is_available: is_available ?? true,
          deadline_time: finalDeadlineTime,
          note: note || null,
        },
        ip_address: ipAddress,
      })
    } catch (logError) {
      console.error('Audit log insert error:', logError)
      // ログ記録の失敗は無視して処理を続行
    }

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('Calendar API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'カレンダー設定の更新中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}
