import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'

/**
 * 価格管理API
 * GET /api/admin/prices - 価格一覧取得
 * POST /api/admin/prices - 価格作成
 */

/**
 * 価格一覧取得（メニュー情報も含む）
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

    const profileTyped = profile as { role?: string; [key: string]: any } | null
    if (!profileTyped || profileTyped.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    // Service Role Keyを使用してRLSをバイパス
    // 注意: 実際のDBではmenu_item_idカラム名を使用
    // 型定義との不一致があるため、any型を使用
    const { data, error } = await (supabaseAdmin as any)
      .from('menu_prices')
      .select(`
        *,
        menu_items:menu_item_id (
          id,
          name,
          vendor_id,
          vendors (
            id,
            code,
            name
          )
        )
      `)
      .order('menu_item_id', { ascending: true })
      .order('start_date', { ascending: false })

    if (error) {
      console.error('Prices fetch error:', error)
      return NextResponse.json(
        { error: '価格一覧の取得に失敗しました', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Prices API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: '価格一覧の取得中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}

/**
 * 価格作成
 */
export async function POST(request: NextRequest) {
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

    const profileTyped = profile as { role?: string; [key: string]: any } | null
    if (!profileTyped || profileTyped.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const body = await request.json()
    const { menu_item_id, price, start_date, end_date } = body

    // バリデーション
    if (!menu_item_id || price === undefined || !start_date) {
      return NextResponse.json(
        { error: 'メニューID、価格、開始日は必須です' },
        { status: 400 }
      )
    }

    if (price < 0) {
      return NextResponse.json(
        { error: '価格は0以上である必要があります' },
        { status: 400 }
      )
    }

    // 日付形式のバリデーション
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(start_date)) {
      return NextResponse.json(
        { error: '開始日の形式が正しくありません（YYYY-MM-DD形式で入力してください）' },
        { status: 400 }
      )
    }

    if (end_date && !dateRegex.test(end_date)) {
      return NextResponse.json(
        { error: '終了日の形式が正しくありません（YYYY-MM-DD形式で入力してください）' },
        { status: 400 }
      )
    }

    // 終了日が開始日より前でないかチェック
    if (end_date && end_date < start_date) {
      return NextResponse.json(
        { error: '終了日は開始日以降である必要があります' },
        { status: 400 }
      )
    }

    // メニューの存在確認
    const { data: menu } = await supabase
      .from('menu_items')
      .select('id')
      .eq('id', menu_item_id)
      .single()

    if (!menu) {
      return NextResponse.json(
        { error: '指定されたメニューが存在しません' },
        { status: 404 }
      )
    }

    // 既存の有効な価格（end_dateがNULL）を確認
    // Service Role Keyを使用してRLSをバイパス
    const { data: activePrice } = await (supabaseAdmin as any)
      .from('menu_prices')
      .select('id, start_date, end_date')
      .eq('menu_item_id', menu_item_id)
      .is('end_date', null)
      .maybeSingle()

    // 新しい価格のstart_dateが未来の日付で、既存の有効な価格がある場合
    // 既存の価格のend_dateを新しい価格のstart_dateの前日に自動設定
    if (activePrice && start_date > activePrice.start_date) {
      // start_dateの前日を計算
      const startDateObj = new Date(start_date)
      startDateObj.setDate(startDateObj.getDate() - 1)
      const previousDay = startDateObj.toISOString().split('T')[0] // YYYY-MM-DD形式

      // 既存の価格のend_dateを更新
      const { error: updateError } = await (supabaseAdmin as any)
        .from('menu_prices')
        .update({ end_date: previousDay })
        .eq('id', activePrice.id)

      if (updateError) {
        console.error('Active price update error:', updateError)
        return NextResponse.json(
          { error: '既存の価格設定の更新に失敗しました', details: updateError.message },
          { status: 500 }
        )
      }
    } else if (activePrice) {
      // 新しい価格のstart_dateが既存の有効な価格のstart_date以前の場合
      // または、期間が重複する場合はエラー
      const endDateForCheck = end_date || '9999-12-31'
      const activePriceEnd = activePrice.end_date || '9999-12-31'
      
      // 重複チェック: 既存の有効な価格と新しい価格が重複しているか
      if (activePrice.start_date <= endDateForCheck && activePriceEnd >= start_date) {
        return NextResponse.json(
          { error: 'この期間に重複する価格設定が存在します。既存の有効な価格を先に終了してください。' },
          { status: 409 }
        )
      }
    }

    // その他の既存価格との重複チェック（end_dateが設定されているもの）
    const endDateForCheck = end_date || '9999-12-31'
    const { data: otherPrices } = await (supabaseAdmin as any)
      .from('menu_prices')
      .select('id, start_date, end_date')
      .eq('menu_item_id', menu_item_id)
      .not('end_date', 'is', null)

    if (otherPrices && otherPrices.length > 0) {
      const hasOverlap = otherPrices.some((existing: any) => {
        return existing.start_date <= endDateForCheck && existing.end_date >= start_date
      })

      if (hasOverlap) {
        return NextResponse.json(
          { error: 'この期間に重複する価格設定が存在します' },
          { status: 409 }
        )
      }
    }

    // Service Role Keyを使用してRLSをバイパス
    // 注意: 実際のDBではmenu_item_idカラム名を使用
    const { data, error } = await (supabaseAdmin as any)
      .from('menu_prices')
      .insert({
        menu_item_id,
        price,
        start_date,
        end_date: end_date || null,
      })
      .select(`
        *,
        menu_items:menu_item_id (
          id,
          name,
          vendor_id,
          vendors (
            id,
            code,
            name
          )
        )
      `)
      .single()

    if (error) {
      console.error('Price insert error:', error)
      return NextResponse.json(
        { error: '価格の作成に失敗しました', details: error.message },
        { status: 500 }
      )
    }

    // 監査ログ記録
    try {
      const headersList = await headers()
      const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'
      
      await (supabaseAdmin.from('audit_logs') as any).insert({
        actor_id: user.id,
        action: 'price.create',
        target_table: 'menu_prices',
        target_id: data.id.toString(),
        details: {
          price_id: data.id,
          menu_item_id: menu_item_id,
          price: price,
          start_date: start_date,
          end_date: end_date || null,
        },
        ip_address: ipAddress,
      })
    } catch (logError) {
      console.error('Audit log insert error:', logError)
      // ログ記録の失敗は無視して処理を続行
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Price POST API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: '価格の作成中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}
