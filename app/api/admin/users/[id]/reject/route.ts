import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'

/**
 * 承認待ちユーザー削除（拒否）API
 * POST /api/admin/users/[id]/reject - 承認待ちユーザーを削除（物理削除）
 */
export async function POST(
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

    // 削除対象ユーザーの情報を取得
    const { data: targetUser, error: targetUserError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()

    if (targetUserError || !targetUser) {
      return NextResponse.json(
        { error: '削除対象のユーザーが見つかりません', details: targetUserError?.message },
        { status: 404 }
      )
    }

    // 既に承認済み（is_active=true）の場合はエラー
    const targetUserTyped = targetUser as { is_active?: boolean; employee_code?: string; [key: string]: any } | null
    if (targetUserTyped?.is_active) {
      return NextResponse.json(
        { error: '承認済みのユーザーは削除できません。無効化機能を使用してください。' },
        { status: 400 }
      )
    }

    // 社員コードをemployee_codesテーブルで解放（もし登録されていれば）
    if (targetUserTyped?.employee_code) {
      const { data: employeeCodeMaster } = await supabaseAdmin
        .from('employee_codes')
        .select('id')
        .eq('employee_code', targetUserTyped.employee_code)
        .maybeSingle()

      const employeeCodeMasterTyped = employeeCodeMaster as { id: number; [key: string]: any } | null
      if (employeeCodeMasterTyped) {
        await (supabaseAdmin
          .from('employee_codes') as any)
          .update({
            is_registered: false,
            registered_user_id: null,
          })
          .eq('id', employeeCodeMasterTyped.id)
      }
    }

    // このユーザーに関連する注文を削除（外部キー制約を回避するため）
    const { data: ordersToDelete, error: ordersFetchError } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('user_id', id)

    if (ordersFetchError) {
      console.error('Orders fetch error:', ordersFetchError)
      return NextResponse.json(
        { 
          error: '関連する注文データの取得に失敗しました', 
          details: ordersFetchError.message 
        },
        { status: 500 }
      )
    }

    const orderCount = ordersToDelete?.length || 0
    console.log(`Found ${orderCount} orders for user ${id}`)

    if (orderCount > 0) {
      // 注文を削除
      const { error: ordersDeleteError } = await supabaseAdmin
        .from('orders')
        .delete()
        .eq('user_id', id)

      if (ordersDeleteError) {
        console.error('Orders delete error:', ordersDeleteError)
        return NextResponse.json(
          { 
            error: '関連する注文データの削除に失敗しました', 
            details: ordersDeleteError.message 
          },
          { status: 500 }
        )
      }
      console.log(`Deleted ${orderCount} orders for user ${id}`)
    }

    // このユーザーに関連する自動注文設定を削除
    const { error: autoOrderConfigsDeleteError } = await supabaseAdmin
      .from('auto_order_configs')
      .delete()
      .eq('user_id', id)

    if (autoOrderConfigsDeleteError) {
      console.error('Auto order configs delete error:', autoOrderConfigsDeleteError)
      // エラーをログに記録するが、処理は続行
    }

    // このユーザーに関連する自動注文テンプレートを削除
    const { error: autoOrderTemplatesDeleteError } = await supabaseAdmin
      .from('auto_order_templates')
      .delete()
      .eq('user_id', id)

    if (autoOrderTemplatesDeleteError) {
      console.error('Auto order templates delete error:', autoOrderTemplatesDeleteError)
      // エラーをログに記録するが、処理は続行
    }

    // 監査ログ記録（削除前に記録）
    try {
      const headersList = await headers()
      const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'
      
      await (supabaseAdmin.from('audit_logs') as any).insert({
        actor_id: user.id,
        action: 'user.reject',
        target_table: 'profiles',
        target_id: id,
        details: {
          user_id: id,
          employee_code: targetUserTyped?.employee_code,
          full_name: targetUserTyped?.full_name,
          email: targetUserTyped?.email,
          reason: '承認待ちユーザーの削除（拒否）',
          deleted_orders_count: orderCount,
        },
        ip_address: ipAddress,
      })
    } catch (logError) {
      console.error('Audit log insert error:', logError)
      // ログ記録の失敗は無視して処理を続行
    }

    // profilesテーブルのレコードを削除
    const { error: profileDeleteError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', id)

    if (profileDeleteError) {
      console.error('Profile delete error:', profileDeleteError)
      return NextResponse.json(
        { 
          error: 'ユーザーの削除に失敗しました', 
          details: profileDeleteError.message,
          code: profileDeleteError.code,
          hint: profileDeleteError.hint
        },
        { status: 500 }
      )
    }

    // Supabase Authのユーザーを削除（Admin APIを使用）
    // 注意: auth.admin.deleteUserは、Service Role Keyを使用している場合のみ利用可能
    try {
      console.log('Attempting to delete auth user:', id)
      console.log('supabaseAdmin.auth:', supabaseAdmin.auth)
      console.log('supabaseAdmin.auth.admin:', supabaseAdmin.auth?.admin)
      
      // auth.adminが存在するかチェック
      if (!supabaseAdmin.auth?.admin) {
        console.error('supabaseAdmin.auth.admin is not available')
        // auth.adminが利用できない場合は、profilesテーブルの削除のみで成功とする
        return NextResponse.json(
          { 
            success: true, 
            message: 'ユーザープロフィールは削除しましたが、認証ユーザーの削除機能が利用できません',
            warning: 'Admin APIが利用できません。手動でSupabaseダッシュボードから認証ユーザーを削除してください。'
          },
          { status: 200 }
        )
      }
      
      const { data: deleteData, error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(id)

      console.log('Delete result:', { deleteData, authDeleteError })

      if (authDeleteError) {
        console.error('Auth user delete error:', authDeleteError)
        console.error('Error details:', JSON.stringify(authDeleteError, null, 2))
        // Authユーザーの削除に失敗しても、profilesテーブルは既に削除されているので続行
        // ただし、エラーメッセージを返す
        return NextResponse.json(
          { 
            success: true, 
            message: 'ユーザープロフィールは削除しましたが、認証ユーザーの削除に失敗しました',
            warning: authDeleteError.message || '認証ユーザーの削除に失敗しました',
            error_code: authDeleteError.status,
            error_details: authDeleteError
          },
          { status: 200 }
        )
      }
    } catch (authError) {
      console.error('Auth delete exception:', authError)
      console.error('Exception details:', authError instanceof Error ? authError.stack : authError)
      // 例外が発生した場合でも、profilesは削除済みなので成功として返す
      return NextResponse.json(
        { 
          success: true, 
          message: 'ユーザープロフィールは削除しましたが、認証ユーザーの削除中にエラーが発生しました',
          warning: authError instanceof Error ? authError.message : 'Unknown error',
          error_details: authError instanceof Error ? authError.stack : String(authError)
        },
        { status: 200 }
      )
    }

    return NextResponse.json({ success: true, message: '承認待ちユーザーを削除しました' })
  } catch (error) {
    console.error('User reject API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'ユーザーの削除中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}
