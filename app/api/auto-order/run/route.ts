import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * 自動注文実行API
 * GET/POST /api/auto-order/run
 * 
 * 締切時刻を過ぎた後、自動的に翌営業日の注文を作成
 * スケジューラー（Cron Job）から呼び出される
 */
async function runAutoOrder(request: NextRequest) {
  const formatErrorForResponse = (err: unknown): string => {
    if (err instanceof Error) return err.message
    if (typeof err === 'string') return err
    if (err && typeof err === 'object') {
      const anyErr = err as any
      const parts: string[] = []
      if (typeof anyErr.message === 'string' && anyErr.message) {
        parts.push(anyErr.message)
      }
      if (typeof anyErr.code === 'string' && anyErr.code) {
        parts.push(`code=${anyErr.code}`)
      }
      if (typeof anyErr.details === 'string' && anyErr.details) {
        parts.push(`details=${anyErr.details}`)
      }
      if (parts.length > 0) return parts.join(' | ')
      try {
        return JSON.stringify(anyErr)
      } catch {
        return 'Unknown error (non-serializable)'
      }
    }
    return 'Unknown error'
  }

  let runId: number | null = null
  let runRecordLogDetails: any = null

  try {
    // Vercel Cron Jobsからの呼び出しを確認
    // Vercel Cron Jobsは自動的に `x-vercel-cron` ヘッダーを付与します
    const isVercelCron = request.headers.get('x-vercel-cron') === '1'
    
    console.log('=== Auto Order Run API Called ===')
    console.log('method:', request.method)
    console.log('isVercelCron:', isVercelCron)

    // 実行元のメタ情報（DB側のlog_detailsにも保存して、Cron実行の有無を追跡できるようにする）
    const invocation = {
      invoked_by: isVercelCron ? 'vercel_cron' : 'manual',
      method: request.method,
      isVercelCron,
      at: new Date().toISOString(),
    }
    
    // 開発環境や手動実行の場合は、Authorizationヘッダーで認証
    if (!isVercelCron) {
      const authHeader = request.headers.get('authorization')
      const expectedSecret = process.env.AUTO_ORDER_SECRET
      
      if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
        console.log('Authentication failed: Authorization header does not match')
        return NextResponse.json(
          { error: '認証が必要です。Authorization: Bearer <AUTO_ORDER_SECRET> ヘッダーを設定してください。' },
          { status: 401 }
        )
      }
    }

    // 現在の日時を取得（JST）
    // Intl.DateTimeFormatを使用してJST時刻の日付文字列を取得
    const now = new Date()
    const jstDateFormatter = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const parts = jstDateFormatter.formatToParts(now)
    const year = parts.find(p => p.type === 'year')?.value || ''
    const month = parts.find(p => p.type === 'month')?.value || ''
    const day = parts.find(p => p.type === 'day')?.value || ''
    const todayStr = `${year}-${month}-${day}`
    const today = new Date(`${todayStr}T00:00:00+09:00`) // JST基準のDateオブジェクトを作成

    console.log('Today (JST):', todayStr)

    // 退職済みユーザーの自動無効化処理（毎日実行）
    try {
      const { data: expiredUsers, error: fetchError } = await supabaseAdmin
        .from('profiles')
        .select('id, employee_code, full_name, left_date')
        .eq('is_active', true)
        .not('left_date', 'is', null)
        .lt('left_date', todayStr)

      if (!fetchError && expiredUsers && expiredUsers.length > 0) {
        const expiredUsersTyped = expiredUsers as Array<{ id: string; [key: string]: any }>
        const userIds = expiredUsersTyped.map(u => u.id)
        await (supabaseAdmin
          .from('profiles') as any)
          .update({ is_active: false })
          .in('id', userIds)
        
        console.log(`✅ ${expiredUsersTyped.length}人の退職済みユーザーを無効化しました`)
      }
    } catch (deactivateError) {
      // 退職済みユーザー無効化のエラーはログに記録するが、自動注文処理は続行
      console.error('退職済みユーザーの無効化処理中にエラーが発生しました:', deactivateError)
    }

    // 翌営業日を取得（is_available = true の最初の日）
    let targetDate: string | null = null
    let targetDateObj: Date | null = null
    
    // 最大30日先まで検索
    for (let i = 1; i <= 30; i++) {
      const checkDate = new Date(today)
      checkDate.setDate(checkDate.getDate() + i)
      // JST基準の日付文字列を取得
      const checkDateParts = jstDateFormatter.formatToParts(checkDate)
      const checkYear = checkDateParts.find(p => p.type === 'year')?.value || ''
      const checkMonth = checkDateParts.find(p => p.type === 'month')?.value || ''
      const checkDay = checkDateParts.find(p => p.type === 'day')?.value || ''
      const checkDateStr = `${checkYear}-${checkMonth}-${checkDay}`

      const { data: orderDay } = await supabaseAdmin
        .from('order_calendar')
        .select('*')
        .eq('target_date', checkDateStr)
        .maybeSingle()

      const orderDayTyped = orderDay as { is_available?: boolean; [key: string]: any } | null
      if (orderDayTyped && orderDayTyped.is_available) {
        targetDate = checkDateStr
        targetDateObj = checkDate
        break
      }
    }

    if (!targetDate || !targetDateObj) {
      console.log('Next business day not found')
      return NextResponse.json(
        { error: '翌営業日が見つかりませんでした' },
        { status: 404 }
      )
    }

    console.log('Target date (next business day):', targetDate)

    // 実行履歴を作成
    const { data: runRecord, error: runError } = await (supabaseAdmin
      .from('auto_order_runs') as any)
      .insert({
        run_date: todayStr,
        executed_at: now.toISOString(),
        // NOTE:
        // 本番DBのCHECK制約: status は 'success' | 'failed' | 'partial' のみ許可
        // 開始時点では暫定で success とし、最後に集計して success/partial/failed を確定する
        status: 'success',
        log_details: {
          target_date: targetDate,
          executed_at: now.toISOString(),
          stage: 'started',
          invocation,
        },
      })
      .select()
      .single()

    if (runError) {
      // UNIQUE制約違反の場合は既に実行済み
      if (runError.code === '23505') {
        return NextResponse.json(
          { error: '今日の自動注文は既に実行済みです' },
          { status: 409 }
        )
      }
      console.error('auto_order_runs insert error:', runError)
      throw runError
    }

    const createdRunId = runRecord.id
    runId = createdRunId
    runRecordLogDetails = runRecord.log_details

    // 有効なユーザーとテンプレートを取得
    const { data: users, error: usersError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('is_active', true)

    if (usersError) {
      console.error('profiles fetch error:', usersError)
      throw usersError
    }

    const usersTyped = users as Array<{ id: string; [key: string]: any }> | null

    console.log('Active users count:', usersTyped?.length || 0)

    if (!usersTyped || usersTyped.length === 0) {
      // 実行履歴を更新
      await (supabaseAdmin
        .from('auto_order_runs') as any)
        .update({
          status: 'success',
          log_details: {
            ...runRecord.log_details,
            message: '有効なユーザーが存在しません',
            stage: 'completed',
          },
        })
        .eq('id', createdRunId)

      return NextResponse.json({
        success: true,
        message: '有効なユーザーが存在しません',
        run_id: createdRunId,
      })
    }

    const results: Array<{
      user_id: string
      result: 'created' | 'skipped' | 'error'
      detail: string
    }> = []

    // 各ユーザーに対して自動注文を実行
    for (const user of usersTyped) {
      try {
        // 対象日の既存注文をチェック
        const { data: existingOrder } = await supabaseAdmin
          .from('orders')
          .select('id')
          .eq('user_id', user.id)
          .eq('order_date', targetDate)
          .eq('status', 'ordered')
          .maybeSingle()

        if (existingOrder) {
          // 既存注文がある場合はスキップ
          results.push({
            user_id: user.id,
            result: 'skipped',
            detail: '既に注文があります',
          })
          continue
        }

        // 対象日の曜日を取得（0=日曜、1=月曜、...、6=土曜）
        const dayOfWeek = targetDateObj.getDay()

        // テンプレートを取得（毎日テンプレートまたは該当曜日のテンプレート）
        // nullsFirstオプションはSupabaseのJavaScriptクライアントでサポートされていない可能性があるため削除
        const { data: templates, error: templatesError } = await supabaseAdmin
          .from('auto_order_templates')
          .select('*')
          .eq('user_id', user.id)
          .or(`day_of_week.is.null,day_of_week.eq.${dayOfWeek}`)
          .order('day_of_week', { ascending: true })

        if (templatesError) {
          console.error('templates fetch error:', templatesError)
          throw templatesError
        }

        const templatesTyped = templates as Array<{ day_of_week?: number | null; menu_id: number; [key: string]: any }> | null

        // テンプレートがない場合はスキップ
        if (!templatesTyped || templatesTyped.length === 0) {
          results.push({
            user_id: user.id,
            result: 'skipped',
            detail: 'テンプレートが設定されていません',
          })
          continue
        }

        // 優先順位: 特定の曜日のテンプレート > 毎日テンプレート
        const specificDayTemplate = templatesTyped.find(t => t.day_of_week === dayOfWeek)
        const template = specificDayTemplate || templatesTyped.find(t => t.day_of_week === null)

        if (!template) {
          results.push({
            user_id: user.id,
            result: 'skipped',
            detail: '該当するテンプレートがありません',
          })
          continue
        }

        // メニューの存在確認
        const templateTyped = template as { menu_id: number; quantity?: number; id?: number; [key: string]: any }
        const { data: menu, error: menuError } = await supabaseAdmin
          .from('menu_items')
          .select('id, is_active, vendor_id')
          .eq('id', templateTyped.menu_id)
          .single()

        const menuTyped = menu as { is_active?: boolean; [key: string]: any } | null
        if (menuError || !menuTyped || !menuTyped.is_active) {
          if (menuError) console.error('menu fetch error:', menuError)
          results.push({
            user_id: user.id,
            result: 'error',
            detail: 'メニューが存在しないか、無効です',
          })
          continue
        }

        // 価格ID取得
        const { data: priceId, error: priceError } = await (supabaseAdmin
          .rpc as any)('get_menu_price_id', {
            p_menu_id: templateTyped.menu_id,
            p_order_date: targetDate,
          })

        if (priceError || !priceId) {
          if (priceError) console.error('get_menu_price_id error:', priceError)
          results.push({
            user_id: user.id,
            result: 'error',
            detail: `価格情報の取得に失敗: ${priceError?.message || '価格が見つかりません'}`,
          })
          continue
        }

        // 価格情報を取得（unit_price_snapshot用）
        const { data: priceInfo, error: priceInfoError } = await supabaseAdmin
          .from('menu_prices')
          .select('price')
          .eq('id', priceId)
          .single()

        const priceInfoTyped = priceInfo as { price: number; [key: string]: any } | null
        if (priceInfoError || !priceInfoTyped) {
          if (priceInfoError) console.error('price fetch error:', priceInfoError)
          results.push({
            user_id: user.id,
            result: 'error',
            detail: '価格情報の取得に失敗しました',
          })
          continue
        }

        // 注文を作成
        const { error: orderError, data: orderData } = await (supabaseAdmin
          .from('orders') as any)
          .insert({
            user_id: user.id,
            menu_item_id: templateTyped.menu_id,
            menu_price_id: priceId,
            order_date: targetDate,
            quantity: templateTyped.quantity || 1,
            unit_price_snapshot: priceInfoTyped.price,
            status: 'ordered',
            source: 'auto',
          })
          .select()
          .single()

        if (orderError) {
          // UNIQUE制約違反の場合は既に注文がある（レースコンディション）
          if (orderError.code === '23505') {
            results.push({
              user_id: user.id,
              result: 'skipped',
              detail: '既に注文があります（レースコンディション）',
            })
          } else {
            results.push({
              user_id: user.id,
              result: 'error',
              detail: `注文の作成に失敗: ${orderError.message}`,
            })
          }
          continue
        }

        // 監査ログ記録
        try {
          const orderDataTyped = orderData as { id: number; [key: string]: any }
          await (supabaseAdmin.from('audit_logs') as any).insert({
            actor_id: user.id,
            action: 'order.create.auto',
            details: {
              order_id: orderDataTyped.id,
              menu_item_id: templateTyped.menu_id,
              order_date: targetDate,
              quantity: templateTyped.quantity || 1,
              template_id: templateTyped.id,
            },
            target_table: 'orders',
            target_id: orderDataTyped.id.toString(),
          })
        } catch (auditLogError) {
          // 監査ログの記録エラーは無視
          console.error('Audit log insert error:', auditLogError)
        }

        const orderDataTyped = orderData as { id: number; [key: string]: any }
        results.push({
          user_id: user.id,
          result: 'created',
          detail: `注文を作成しました（注文ID: ${orderDataTyped.id}）`,
        })
      } catch (error) {
        console.error(`Error processing user ${user.id}:`, error)
        results.push({
          user_id: user.id,
          result: 'error',
          detail: error instanceof Error ? error.message : '不明なエラー',
        })
      }
    }

    // 実行履歴アイテムを記録
    for (const result of results) {
      try {
        await (supabaseAdmin.from('auto_order_run_items') as any).insert({
          run_id: runId,
          user_id: result.user_id,
          target_date: targetDate,
          result: result.result,
          detail: result.detail,
        })
      } catch (itemError) {
        // UNIQUE制約違反の場合は無視（レースコンディション）
        const itemErrorTyped = itemError as { code?: string; [key: string]: any }
        if (itemErrorTyped.code !== '23505') {
          console.error('Failed to insert run item:', itemError)
        }
      }
    }

    // 実行履歴を更新
    const createdCount = results.filter(r => r.result === 'created').length
    const skippedCount = results.filter(r => r.result === 'skipped').length
    const errorCount = results.filter(r => r.result === 'error').length
    const totalCount = results.length

    // 本番DBのstatus制約に合わせて最終ステータスを決定
    const finalStatus =
      errorCount === 0 ? 'success' : createdCount + skippedCount === 0 ? 'failed' : 'partial'

    console.log('Auto order results:', {
      created: createdCount,
      skipped: skippedCount,
      errors: errorCount,
      total: results.length,
    })

    await (supabaseAdmin
      .from('auto_order_runs') as any)
      .update({
        status: finalStatus,
        log_details: {
          ...runRecord.log_details,
          target_date: targetDate,
          created: createdCount,
          skipped: skippedCount,
          errors: errorCount,
          total: totalCount,
          stage: 'completed',
          final_status: finalStatus,
        },
      })
      .eq('id', runId)

    console.log('Auto order run completed successfully')

    return NextResponse.json({
      success: true,
      run_id: runId,
      target_date: targetDate,
      results: {
        created: createdCount,
        skipped: skippedCount,
        errors: errorCount,
        total: results.length,
      },
      invocation,
    })
  } catch (error) {
    console.error('=== Auto Order Run Error ===')
    console.error('Error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    const errorMessage = formatErrorForResponse(error)

    // 実行履歴が作成済みなら、失敗内容を log_details に残す（statusは 'completed' に統一）
    if (runId) {
      try {
        await (supabaseAdmin.from('auto_order_runs') as any)
          .update({
            status: 'failed',
            log_details: {
              ...(runRecordLogDetails || {}),
              stage: 'error',
              error: errorMessage,
            },
          })
          .eq('id', runId)
      } catch (updateErr) {
        console.error('Failed to update auto_order_runs on error:', updateErr)
      }
    }
    return NextResponse.json(
      { error: '自動注文の実行に失敗しました: ' + errorMessage },
      { status: 500 }
    )
  }
}

// Vercel Cron は GET で呼ばれるため、GET でも実行できるようにする
export async function GET(request: NextRequest) {
  return runAutoOrder(request)
}

// 手動実行（curl等）は POST を想定（Authorizationヘッダーで保護）
export async function POST(request: NextRequest) {
  return runAutoOrder(request)
}
