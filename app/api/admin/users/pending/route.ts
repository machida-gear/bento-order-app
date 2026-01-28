import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * 承認待ちユーザー一覧取得API
 * GET /api/admin/users/pending - 承認待ちユーザー一覧を取得
 */
export async function GET() {
  try {
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

    const profileTyped = profile as { role?: string; is_active?: boolean; [key: string]: any } | null
    if (!profileTyped || profileTyped.role !== 'admin') {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      )
    }

    if (!profileTyped.is_active) {
      return NextResponse.json(
        { error: 'アカウントが無効化されています' },
        { status: 403 }
      )
    }

    // 承認待ちユーザー一覧取得
    // 承認待ち = is_active=false かつ 退職日が未設定または未来の日付（今日より後）
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]
    // 明日の日付を計算（未来の日付のみを対象にするため）
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('is_active', false)
      .or(`left_date.is.null,left_date.gte.${tomorrowStr}`)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Pending users fetch error:', error)
      return NextResponse.json(
        { error: '承認待ちユーザー一覧の取得に失敗しました', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Pending users API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: '承認待ちユーザー一覧の取得中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}
