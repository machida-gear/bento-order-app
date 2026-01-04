import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * 退職日の自動無効化API
 * 退職日が過去の日付のユーザーを自動的にis_active=falseにする
 * 
 * このAPIは、Vercel Cron Jobsから毎日実行されることを想定しています
 * vercel.jsonに設定を追加してください
 */
export async function POST(request: NextRequest) {
  try {
    // 認証チェック（Vercel Cron Jobsからの呼び出し、または手動実行時の認証）
    const authHeader = request.headers.get('authorization')
    const vercelCronHeader = request.headers.get('x-vercel-cron')
    const autoOrderSecret = process.env.AUTO_ORDER_SECRET

    // Vercel Cron Jobsからの呼び出し、または手動実行時の認証
    if (!vercelCronHeader && (!authHeader || authHeader !== `Bearer ${autoOrderSecret}`)) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      )
    }

    // 今日の日付を取得（JST基準）
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 退職日が過去の日付で、かつis_active=trueのユーザーを取得
    const { data: expiredUsers, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, employee_code, full_name, left_date')
      .eq('is_active', true)
      .not('left_date', 'is', null)
      .lt('left_date', today.toISOString().split('T')[0])

    if (fetchError) {
      console.error('Failed to fetch expired users:', fetchError)
      return NextResponse.json(
        { error: '退職済みユーザーの取得に失敗しました', details: fetchError.message },
        { status: 500 }
      )
    }

    if (!expiredUsers || expiredUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: '退職済みユーザーはありません',
        deactivatedCount: 0,
      })
    }

    // 退職済みユーザーを無効化
    const userIds = expiredUsers.map(u => u.id)
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ is_active: false })
      .in('id', userIds)

    if (updateError) {
      console.error('Failed to deactivate expired users:', updateError)
      return NextResponse.json(
        { error: '退職済みユーザーの無効化に失敗しました', details: updateError.message },
        { status: 500 }
      )
    }

    console.log(`✅ ${expiredUsers.length}人の退職済みユーザーを無効化しました`)
    console.log('無効化されたユーザー:', expiredUsers.map(u => ({
      employee_code: u.employee_code,
      full_name: u.full_name,
      left_date: u.left_date,
    })))

    return NextResponse.json({
      success: true,
      message: `${expiredUsers.length}人の退職済みユーザーを無効化しました`,
      deactivatedCount: expiredUsers.length,
      deactivatedUsers: expiredUsers.map(u => ({
        employee_code: u.employee_code,
        full_name: u.full_name,
        left_date: u.left_date,
      })),
    })
  } catch (error) {
    console.error('Deactivate expired users API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: '退職済みユーザーの無効化処理中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}
