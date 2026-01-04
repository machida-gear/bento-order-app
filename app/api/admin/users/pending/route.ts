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

    // 承認待ちユーザー一覧取得
    // 承認待ち = is_active=false かつ 退職日が未設定または未来の日付（今日より後）
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]
    // 明日の日付を計算（未来の日付のみを対象にするため）
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/31bb64a1-4cff-45b1-a971-f1576e521fb8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/users/pending/route.ts:52',message:'GET pending: Query params',data:{todayStr,tomorrowStr,queryCondition:`is_active=false AND (left_date IS NULL OR left_date >= ${tomorrowStr})`},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('is_active', false)
      .or(`left_date.is.null,left_date.gte.${tomorrowStr}`)
      .order('created_at', { ascending: false })
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/31bb64a1-4cff-45b1-a971-f1576e521fb8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/users/pending/route.ts:62',message:'GET pending: Results',data:{count:data?.length,users:data?.map(u=>({id:u.id,employee_code:u.employee_code,is_active:u.is_active,left_date:u.left_date}))},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

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
