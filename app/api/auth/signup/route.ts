/**
 * サインアップ API Route Handler
 * ユーザー登録 + profiles テーブルへの自動登録
 */
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, employeeCode, invitationCode } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'メールアドレスとパスワードは必須です' },
        { status: 400 }
      )
    }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: '氏名は必須です' },
        { status: 400 }
      )
    }

    if (!employeeCode || employeeCode.length !== 4) {
      return NextResponse.json(
        { error: '社員コードは4桁で入力してください' },
        { status: 400 }
      )
    }

    if (!invitationCode || !invitationCode.trim()) {
      return NextResponse.json(
        { error: '招待コードは必須です' },
        { status: 400 }
      )
    }

    // 招待コードのチェック
    const { data: systemSettings, error: settingsError } = await supabaseAdmin
      .from('system_settings')
      .select('invitation_code, invitation_code_max_uses, invitation_code_used_count')
      .eq('id', 1)
      .single()

    if (settingsError || !systemSettings) {
      console.error('System settings fetch error:', settingsError)
      return NextResponse.json(
        { error: 'システム設定の取得に失敗しました' },
        { status: 500 }
      )
    }

    const systemSettingsTyped = systemSettings as {
      invitation_code?: string | null;
      invitation_code_max_uses?: number | null;
      invitation_code_used_count?: number | null;
      [key: string]: any;
    }

    if (!systemSettingsTyped.invitation_code || systemSettingsTyped.invitation_code.trim() === '') {
      return NextResponse.json(
        { error: '招待コードが設定されていません。管理者に連絡してください。' },
        { status: 403 }
      )
    }

    // 招待コードの正規化（4桁の数字に統一）
    const normalizedInvitationCode = invitationCode.trim().padStart(4, '0')
    const normalizedSystemCode = systemSettingsTyped.invitation_code.trim().padStart(4, '0')

    if (normalizedSystemCode !== normalizedInvitationCode) {
      return NextResponse.json(
        { error: '招待コードが正しくありません' },
        { status: 403 }
      )
    }

    // 使用回数制限のチェック
    const maxUses = systemSettingsTyped.invitation_code_max_uses
    const usedCount = systemSettingsTyped.invitation_code_used_count || 0

    if (maxUses !== null && maxUses !== undefined && usedCount >= maxUses) {
      return NextResponse.json(
        { error: '招待コードの使用回数が上限に達しています。管理者に連絡してください。' },
        { status: 403 }
      )
    }

    // 社員コードの正規化
    const normalizedEmployeeCode = employeeCode.trim().padStart(4, '0')

    // 社員コードの重複チェック（既に使用されている社員コードは登録不可）
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('employee_code', normalizedEmployeeCode)
      .maybeSingle()

    if (existingProfile) {
      return NextResponse.json(
        { error: 'この社員コードは既に使用されています' },
        { status: 409 }
      )
    }

    const supabase = await createClient()

    // 本番環境のURLを環境変数から取得、なければリクエストのオリジンを fallback として使用
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin

    // 1. ユーザー登録
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${siteUrl}/calendar`,
      },
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'ユーザー作成に失敗しました' }, { status: 500 })
    }

    // 2. profiles テーブルにレコードを作成
    // Service Role Keyを使用してRLSをバイパス
    
    // profilesテーブルの実際の構造に合わせてデータを準備
    // 注意: カラム名は`name`ではなく`full_name`
    // 新規登録時はis_active=false（承認待ち）にする
    const profileDataToInsert = {
      id: authData.user.id,
      employee_code: normalizedEmployeeCode, // 4桁にパディング（例：1 → 0001）
      full_name: name.trim(), // ユーザーが入力した名前を使用
      email: email,
      role: 'user' as const,
      is_active: false, // 管理者の承認待ち
    }
    
    console.log('📝 Inserting profile:', JSON.stringify(profileDataToInsert, null, 2))
    
    const { error: profileError, data: profileData } = await (supabaseAdmin
      .from('profiles') as any)
      .insert(profileDataToInsert)
      .select()

    if (profileError) {
      console.error('❌ Profile creation error:', profileError)
      console.error('Error details:', JSON.stringify(profileError, null, 2))
      console.error('User ID:', authData.user.id)
      console.error('Email:', email)
      // プロファイル作成に失敗した場合はエラーを返す
      return NextResponse.json(
        { 
          error: 'プロファイルの作成に失敗しました: ' + profileError.message,
          details: profileError.message,
          code: profileError.code,
          hint: profileError.hint
        },
        { status: 500 }
      )
    }

    console.log('✅ Profile created successfully:', profileData)

    // 管理者に通知（監査ログに記録）
    try {
      await (supabaseAdmin.from('audit_logs') as any).insert({
        actor_id: authData.user.id,
        action: 'user.signup.pending',
        target_table: 'profiles',
        target_id: authData.user.id,
        details: {
          user_id: authData.user.id,
          employee_code: normalizedEmployeeCode,
          full_name: name.trim(),
          email: email,
          status: 'pending_approval',
        },
        ip_address: 'system',
      })
    } catch (logError) {
      console.error('Audit log insert error:', logError)
      // ログ記録の失敗は無視して処理を続行
    }

    // 招待コードの使用回数をカウントアップ
    const { error: updateInvitationCodeError } = await (supabaseAdmin
      .from('system_settings') as any)
      .update({
        invitation_code_used_count: (usedCount || 0) + 1,
      })
      .eq('id', 1)

    if (updateInvitationCodeError) {
      console.error('❌ Invitation code usage count update error:', updateInvitationCodeError)
      // エラーをログに記録するが、登録は成功しているので続行
    } else {
      console.log('✅ Invitation code usage count updated successfully')
    }

    return NextResponse.json({
      success: true,
      message: 'アカウントを作成しました。管理者の承認をお待ちください。確認メールを送信しました。',
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
      pending_approval: true,
    })
  } catch (error) {
    console.error('Signup route error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Error stack:', errorStack)
    return NextResponse.json(
      { 
        error: '登録処理中にエラーが発生しました: ' + errorMessage,
        details: errorMessage
      },
      { status: 500 }
    )
  }
}

