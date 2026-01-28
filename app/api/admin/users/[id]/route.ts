import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'

/**
 * ユーザー管理API（個別）
 * PUT /api/admin/users/[id] - ユーザー更新
 * DELETE /api/admin/users/[id] - ユーザー削除（is_active=falseに設定）
 */

/**
 * ユーザー更新
 */
export async function PUT(
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

    const profileTyped = profile as { role?: string; [key: string]: any } | null
    if (!profileTyped || profileTyped.role !== 'admin') {
      console.error('User is not admin. Role:', profileTyped?.role)
      return NextResponse.json(
        { error: '管理者権限が必要です。現在の権限: ' + (profileTyped?.role || 'unknown') },
        { status: 403 }
      )
    }

    if (!profileTyped.is_active) {
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

    // 現在のユーザー情報を取得（変更前の社員コードを記録するため）
    const { data: currentUser, error: currentUserError } = await supabaseAdmin
      .from('profiles')
      .select('employee_code')
      .eq('id', id)
      .single()

    if (currentUserError || !currentUser) {
      return NextResponse.json(
        { error: 'ユーザー情報の取得に失敗しました', details: currentUserError?.message },
        { status: 500 }
      )
    }

    const currentUserTyped = currentUser as { employee_code: string; [key: string]: any }
    const oldEmployeeCode = currentUserTyped.employee_code
    const newEmployeeCode = employee_code.trim().padStart(4, '0')

    // 社員コードが変更される場合のみ処理
    if (oldEmployeeCode !== newEmployeeCode) {
      // 新しい社員コードの重複チェック（自分以外）
      const { data: existing } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('employee_code', newEmployeeCode)
        .neq('id', id)
        .maybeSingle()

      if (existing) {
        return NextResponse.json(
          { error: 'この社員コードは既に使用されています' },
          { status: 409 }
        )
      }

      // 新しい社員コードがemployee_codesテーブルに存在し、未登録かチェック
      const { data: newEmployeeCodeMaster, error: newEmployeeCodeError } = await supabaseAdmin
        .from('employee_codes')
        .select('id, is_registered')
        .eq('employee_code', newEmployeeCode)
        .maybeSingle()

      const newEmployeeCodeMasterTyped = newEmployeeCodeMaster as { id: number; is_registered: boolean; [key: string]: any } | null
      if (newEmployeeCodeMasterTyped) {
        // employee_codesテーブルに存在する場合、未登録のみ許可
        if (newEmployeeCodeMasterTyped.is_registered) {
          return NextResponse.json(
            { error: 'この社員コードは既に登録済みです' },
            { status: 409 }
          )
        }
      }

      // 古い社員コードをemployee_codesテーブルで解放
      if (oldEmployeeCode) {
        const { data: oldEmployeeCodeMaster } = await supabaseAdmin
          .from('employee_codes')
          .select('id')
          .eq('employee_code', oldEmployeeCode)
          .maybeSingle()

        const oldEmployeeCodeMasterTyped = oldEmployeeCodeMaster as { id: number; [key: string]: any } | null
        if (oldEmployeeCodeMasterTyped) {
          await (supabaseAdmin
            .from('employee_codes') as any)
            .update({
              is_registered: false,
              registered_user_id: null,
            })
            .eq('id', oldEmployeeCodeMasterTyped.id)
        }
      }

      // 新しい社員コードをemployee_codesテーブルで登録済みに更新（存在する場合）
      if (newEmployeeCodeMasterTyped) {
        await (supabaseAdmin
          .from('employee_codes') as any)
          .update({
            is_registered: true,
            registered_user_id: id,
          })
          .eq('id', newEmployeeCodeMasterTyped.id)
      }
    }

    // 退職日の処理
    // - 退職日が設定されていて、かつ過去の日付の場合は、自動的にis_active=falseにする
    // - 退職日が未来の日付の場合は、まだ在籍中なのでis_activeの値をそのまま使用
    let finalIsActive = is_active ?? true
    if (left_date) {
      const leftDate = new Date(left_date)
      const today = new Date()
      today.setHours(0, 0, 0, 0) // 時刻を0時にリセット
      leftDate.setHours(0, 0, 0, 0)
      
      // 退職日が過去の場合は、自動的にis_active=falseにする
      if (leftDate < today) {
        finalIsActive = false
      }
      // 退職日が未来の場合は、is_activeの値をそのまま使用（在籍中）
    }

    // Service Role Keyを使用して更新（RLSをバイパス）
    const { data, error } = await (supabaseAdmin
      .from('profiles') as any)
      .update({
        employee_code: newEmployeeCode,
        full_name,
        email: email || null,
        role: role || 'user',
        joined_date: joined_date || null,
        left_date: left_date || null,
        is_active: finalIsActive,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('User update error:', error)
      return NextResponse.json(
        { error: 'ユーザーの更新に失敗しました', details: error.message },
        { status: 500 }
      )
    }

    // 監査ログ記録
    try {
      const headersList = await headers()
      const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'
      
      const logDetails: any = {
        user_id: id,
        employee_code: newEmployeeCode,
        full_name,
        email: email || null,
        role: role || 'user',
        joined_date: joined_date || null,
        left_date: left_date || null,
        is_active: finalIsActive,
      }

      // 社員コードが変更された場合、変更前後の社員コードを記録
      if (oldEmployeeCode !== newEmployeeCode) {
        logDetails.old_employee_code = oldEmployeeCode
        logDetails.new_employee_code = newEmployeeCode
        logDetails.employee_code_changed = true
      }
      
      await (supabaseAdmin.from('audit_logs') as any).insert({
        actor_id: user.id,
        action: 'user.update',
        target_table: 'profiles',
        target_id: id,
        details: logDetails,
        ip_address: ipAddress,
      })
    } catch (logError) {
      console.error('Audit log insert error:', logError)
      // ログ記録の失敗は無視して処理を続行
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('User PUT API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'ユーザーの更新中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}

/**
 * ユーザー削除（is_active=falseに設定）
 * 
 * 注意事項:
 * - このAPIは物理削除ではなく、論理削除（is_active=false）のみ行います
 * - 注文データは保持されるため、会計・集計に影響しません
 * - 外部キー制約により、注文データがあるユーザーは物理削除できません（保護機能）
 * - 退職者対応など、ユーザーを無効化する場合はこのAPIを使用してください
 */
export async function DELETE(
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

    const profileTyped = profile as { role?: string; [key: string]: any } | null
    if (!profileTyped || profileTyped.role !== 'admin') {
      console.error('User is not admin. Role:', profileTyped?.role)
      return NextResponse.json(
        { error: '管理者権限が必要です。現在の権限: ' + (profileTyped?.role || 'unknown') },
        { status: 403 }
      )
    }

    if (!profileTyped.is_active) {
      console.error('User is not active')
      return NextResponse.json(
        { error: 'アカウントが無効化されています。管理者に連絡してください。' },
        { status: 403 }
      )
    }

    // 自分自身を削除できないようにチェック
    if (id === user.id) {
      return NextResponse.json(
        { error: '自分自身を無効化することはできません' },
        { status: 400 }
      )
    }

    // 注文データがあるかチェック（物理削除を防止するため）
    // 注意: このAPIは論理削除（is_active=false）のみ行いますが、
    // 将来の物理削除に備えて注文データの存在を警告します
    const { count: orderCount, error: orderCountError } = await supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', id)
      .eq('status', 'ordered') // 注文済みの注文のみカウント

    if (orderCountError) {
      console.error('Order count error:', orderCountError)
      // エラーが発生しても処理は続行（警告のみ）
    } else if (orderCount && orderCount > 0) {
      // 注文データがある場合、警告ログを出力（削除は続行）
      console.warn(`⚠️ 警告: ユーザー ${id} には ${orderCount} 件の注文データがあります。`)
      console.warn('   このユーザーを無効化しても、注文データは保持されます。')
      console.warn('   会計・集計のため、注文データは削除されません。')
    }

    // 削除時にleft_dateを今日の日付に設定することで、
    // 承認待ちリストではなく無効なユーザーリストに表示されるようにする
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]
    
    // is_active=false、left_date=今日の日付に設定（物理削除ではない）
    // 注文データは保持されるため、会計・集計に影響なし
    // Service Role Keyを使用して更新（RLSをバイパス）
    const { data, error } = await (supabaseAdmin
      .from('profiles') as any)
      .update({ 
        is_active: false,
        left_date: todayStr  // 今日の日付を設定
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('User delete error:', error)
      return NextResponse.json(
        { error: 'ユーザーの削除に失敗しました', details: error.message },
        { status: 500 }
      )
    }

    // 監査ログ記録
    try {
      const headersList = await headers()
      const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'
      
      await (supabaseAdmin.from('audit_logs') as any).insert({
        actor_id: user.id,
        action: 'user.delete',
        target_table: 'profiles',
        target_id: id,
        details: {
          user_id: id,
          employee_code: data.employee_code,
          full_name: data.full_name,
        },
        ip_address: ipAddress,
      })
    } catch (logError) {
      console.error('Audit log insert error:', logError)
      // ログ記録の失敗は無視して処理を続行
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('User DELETE API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'ユーザーの削除中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}
