import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * 締日期間API
 * GET /api/admin/closing-periods - 締日期間一覧取得
 */

/**
 * 締日期間一覧取得
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

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('closing_periods')
      .select('*')
      .order('start_date', { ascending: false })

    if (error) {
      console.error('Closing periods fetch error:', error)
      return NextResponse.json(
        { error: '締日期間一覧の取得に失敗しました', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Closing periods API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: '締日期間一覧の取得中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}
