import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * ユーザー管理API
 * GET /api/admin/users - ユーザー一覧取得
 * POST /api/admin/users - ユーザー作成（簡易版：profilesのみ作成、認証は別途必要）
 */

/**
 * ユーザー一覧取得
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

    // デバッグ情報をログに出力
    console.log('=== Admin Permission Check ===')
    console.log('User ID:', user.id)
    console.log('Profile:', profile)
    console.log('Profile Error:', profileError)

    if (profileError) {
      console.error('Profile fetch error:', profileError)
      return NextResponse.json(
        { error: 'プロフィールの取得に失敗しました', details: profileError.message },
        { status: 500 }
      )
    }

    if (!profile) {
      console.error('Profile not found for user:', user.id)
      return NextResponse.json(
        { error: 'プロフィールが見つかりません。管理者に連絡してください。' },
        { status: 403 }
      )
    }

    if (profile.role !== 'admin') {
      console.error('User is not admin. Role:', profile.role)
      return NextResponse.json(
        { error: '管理者権限が必要です。現在の権限: ' + profile.role },
        { status: 403 }
      )
    }

    if (!profile.is_active) {
      console.error('User is not active')
      return NextResponse.json(
        { error: 'アカウントが無効化されています。管理者に連絡してください。' },
        { status: 403 }
      )
    }

    // ユーザー一覧取得（Service Role Keyを使用してRLSをバイパス）
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('employee_code', { ascending: true })

    if (error) {
      console.error('Users fetch error:', error)
      return NextResponse.json(
        { error: 'ユーザー一覧の取得に失敗しました', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Users API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'ユーザー一覧の取得中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}

/**
 * ユーザー作成
 * 注意: 新規ユーザー作成は複雑なため、ここではprofilesテーブルのみ作成します
 * 実際の認証ユーザー作成は、認証画面から行うことを推奨します
 */
export async function POST(request: NextRequest) {
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

    // デバッグ情報をログに出力
    console.log('=== Admin Permission Check ===')
    console.log('User ID:', user.id)
    console.log('Profile:', profile)
    console.log('Profile Error:', profileError)

    if (profileError) {
      console.error('Profile fetch error:', profileError)
      return NextResponse.json(
        { error: 'プロフィールの取得に失敗しました', details: profileError.message },
        { status: 500 }
      )
    }

    if (!profile) {
      console.error('Profile not found for user:', user.id)
      return NextResponse.json(
        { error: 'プロフィールが見つかりません。管理者に連絡してください。' },
        { status: 403 }
      )
    }

    if (profile.role !== 'admin') {
      console.error('User is not admin. Role:', profile.role)
      return NextResponse.json(
        { error: '管理者権限が必要です。現在の権限: ' + profile.role },
        { status: 403 }
      )
    }

    if (!profile.is_active) {
      console.error('User is not active')
      return NextResponse.json(
        { error: 'アカウントが無効化されています。管理者に連絡してください。' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { employee_code, full_name, email, role, joined_date, left_date, is_active } = body

    // バリデーション
    if (!employee_code || !full_name) {
      return NextResponse.json(
        { error: '社員コードと氏名は必須です' },
        { status: 400 }
      )
    }

    // 社員コードは4桁の数字
    if (!/^\d{4}$/.test(employee_code)) {
      return NextResponse.json(
        { error: '社員コードは4桁の数字で入力してください' },
        { status: 400 }
      )
    }

    // 社員コードの重複チェック
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('employee_code', employee_code)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'この社員コードは既に使用されています' },
        { status: 409 }
      )
    }

    // 注意: 新規ユーザー作成は、Supabase Authでユーザーを作成する必要があります
    // ここでは簡易的に、一時的なUUIDを生成してprofilesテーブルにレコードを作成します
    // 実際の認証ユーザー作成は、認証画面から行うことを推奨します
    // または、管理者がメールアドレスとパスワードを設定してユーザーを作成する機能を追加することも可能です

    // 一時的なUUIDを生成（実際には認証ユーザーIDが必要）
    // この実装では、認証ユーザーが存在しない場合のエラーを返します
    return NextResponse.json(
      { 
        error: '新規ユーザー作成は、認証画面から行ってください。管理者画面では既存ユーザーの編集のみ可能です。',
        hint: '認証画面（/login）から新規登録を行い、その後この画面でユーザー情報を編集してください。'
      },
      { status: 400 }
    )
  } catch (error) {
    console.error('User POST API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'ユーザーの作成中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}
