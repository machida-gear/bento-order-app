import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'

/**
 * システム設定API
 * GET /api/admin/settings - 設定を取得
 * PUT /api/admin/settings - 設定を更新
 */

/**
 * 設定を取得
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
      .select('role, is_active')
      .eq('id', user.id)
      .single()

    const profileTyped = profile as { role?: string; is_active?: boolean; [key: string]: any } | null
    if (!profileTyped || profileTyped.role !== 'admin' || !profileTyped.is_active) {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .eq('id', 1)
      .single()

    if (error) {
      console.error('Settings fetch error:', error)
      return NextResponse.json(
        { error: '設定の取得に失敗しました', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Settings API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: '設定の取得中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}

/**
 * 設定を更新
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // 管理者権限チェック
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single()

    const profileTyped = profile as { role?: string; is_active?: boolean; [key: string]: any } | null
    if (!profileTyped || profileTyped.role !== 'admin' || !profileTyped.is_active) {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const body = await request.json()
    const {
      default_deadline_time,
      closing_day,
      max_order_days_ahead,
      day_of_week_settings,
      company_name,
      company_postal_code,
      company_address1,
      company_address2,
      company_phone,
      company_fax,
      company_email,
    } = body

    // バリデーション
    if (default_deadline_time && !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(default_deadline_time)) {
      return NextResponse.json(
        { error: '締切時刻の形式が正しくありません（HH:MM形式で入力してください）' },
        { status: 400 }
      )
    }

    if (closing_day !== undefined && closing_day !== null && (closing_day < 1 || closing_day > 31)) {
      return NextResponse.json(
        { error: '締め日は1〜31の範囲で指定してください（月末締めの場合はnullを指定）' },
        { status: 400 }
      )
    }

    if (max_order_days_ahead !== undefined && (max_order_days_ahead < 1 || max_order_days_ahead > 365)) {
      return NextResponse.json(
        { error: '最大注文可能日数は1〜365の範囲で指定してください' },
        { status: 400 }
      )
    }

    // 現在の設定を取得（default_deadline_timeの変更を検知するため）
    const { data: currentSettings } = await supabase
      .from('system_settings')
      .select('default_deadline_time')
      .eq('id', 1)
      .single()

    // 時刻形式を統一して比較（DBはHH:MM:SS形式、リクエストはHH:MM形式）
    let hasDeadlineTimeChanged = false
    if (default_deadline_time) {
      // データベースの時刻をHH:MM形式に変換（HH:MM:SS → HH:MM）
      const currentSettingsTyped = currentSettings as { default_deadline_time?: string | null; [key: string]: any } | null
      const currentTimeFormatted = currentSettingsTyped?.default_deadline_time
        ? currentSettingsTyped.default_deadline_time.toString().slice(0, 5) // "10:00:00" → "10:00"
        : null
      
      hasDeadlineTimeChanged = currentTimeFormatted !== default_deadline_time
      
      console.log('=== Deadline Time Change Check ===')
      console.log('Current DB value:', currentSettingsTyped?.default_deadline_time)
      console.log('Current formatted:', currentTimeFormatted)
      console.log('New value:', default_deadline_time)
      console.log('Has changed:', hasDeadlineTimeChanged)
    }

    // システム設定を更新（Service Role Keyを使用）
    const { data, error } = await (supabaseAdmin
      .from('system_settings') as any)
      .update({
        default_deadline_time: default_deadline_time || undefined,
        closing_day: closing_day !== undefined ? closing_day : undefined,
        max_order_days_ahead: max_order_days_ahead !== undefined ? max_order_days_ahead : undefined,
        day_of_week_settings: day_of_week_settings || undefined,
        company_name: company_name !== undefined ? company_name : undefined,
        company_postal_code: company_postal_code !== undefined ? company_postal_code : undefined,
        company_address1: company_address1 !== undefined ? company_address1 : undefined,
        company_address2: company_address2 !== undefined ? company_address2 : undefined,
        company_phone: company_phone !== undefined ? company_phone : undefined,
        company_fax: company_fax !== undefined ? company_fax : undefined,
        company_email: company_email !== undefined ? company_email : undefined,
      })
      .eq('id', 1)
      .select()
      .single()

    if (error) {
      console.error('Settings update error:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      
      // カラムが存在しない場合のエラーメッセージを改善
      if (error.message && error.message.includes('column') && error.message.includes('does not exist')) {
        return NextResponse.json(
          { 
            error: 'データベースのマイグレーションが必要です。company_address1とcompany_address2カラムが存在しません。',
            details: error.message,
            hint: 'マイグレーションファイル 058_split_company_address_to_two_columns.sql を実行してください。'
          },
          { status: 500 }
        )
      }
      
      return NextResponse.json(
        { error: '設定の更新に失敗しました', details: error.message },
        { status: 500 }
      )
    }

    // デフォルト締切時刻が変更された場合、order_calendarテーブルの今日以降のdeadline_timeを更新
    if (default_deadline_time && hasDeadlineTimeChanged) {
      // TIME型に変換（HH:MM形式をHH:MM:SS形式に変換）
      const defaultDeadlineTimeFormatted = default_deadline_time.includes(':')
        ? default_deadline_time.split(':').length === 2
          ? `${default_deadline_time}:00`
          : default_deadline_time
        : default_deadline_time

      // 今日の日付を取得（YYYY-MM-DD形式）
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStr = today.toISOString().split('T')[0]

      // 今日以降で、deadline_timeがNULLでないレコードの締切時刻を新しいデフォルト値で更新
      console.log('Updating order_calendar with conditions:')
      console.log('- target_date >=', todayStr)
      console.log('- deadline_time IS NOT NULL')
      console.log('- new deadline_time:', defaultDeadlineTimeFormatted)
      
      const { data: updatedRecords, error: calendarUpdateError } = await (supabaseAdmin
        .from('order_calendar') as any)
        .update({ deadline_time: defaultDeadlineTimeFormatted })
        .gte('target_date', todayStr)
        .not('deadline_time', 'is', null)
        .select()

      if (calendarUpdateError) {
        console.error('Order calendar update error:', calendarUpdateError)
        // エラーが発生してもシステム設定の更新は成功しているので、警告のみ
        console.warn('注文カレンダーの締切時刻更新に失敗しましたが、システム設定は更新されました')
      } else {
        console.log(`注文カレンダーの締切時刻を更新しました（${updatedRecords?.length || 0}件のレコード）`)
        if (updatedRecords && updatedRecords.length > 0) {
          console.log('Updated records:', (updatedRecords as Array<{ target_date: string; deadline_time: string | null; [key: string]: any }>).slice(0, 5).map((r: any) => ({
            target_date: r.target_date,
            deadline_time: r.deadline_time,
          })))
        }
      }
    }

    // 監査ログ記録
    try {
      const headersList = await headers()
      const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'
      
      await (supabaseAdmin.from('audit_logs') as any).insert({
        actor_id: user.id,
        action: 'settings.update',
        target_table: 'system_settings',
        target_id: '1',
        details: {
          default_deadline_time: default_deadline_time || null,
          closing_day: closing_day !== undefined ? closing_day : null,
          max_order_days_ahead: max_order_days_ahead !== undefined ? max_order_days_ahead : null,
          day_of_week_settings: day_of_week_settings || null,
          company_name: company_name || null,
          company_postal_code: company_postal_code || null,
          company_address1: company_address1 || null,
          company_address2: company_address2 || null,
          company_phone: company_phone || null,
          company_fax: company_fax || null,
          company_email: company_email || null,
        },
        ip_address: ipAddress,
      })
    } catch (logError) {
      console.error('Audit log insert error:', logError)
      // ログ記録の失敗は無視して処理を続行
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Settings API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: '設定の更新中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}
