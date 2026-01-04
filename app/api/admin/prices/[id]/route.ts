import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'

/**
 * 価格管理API（個別）
 * PUT /api/admin/prices/[id] - 価格更新
 * DELETE /api/admin/prices/[id] - 価格削除
 */

/**
 * 価格更新
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const id = parseInt(resolvedParams.id, 10)

    if (isNaN(id)) {
      return NextResponse.json(
        { error: '無効なIDです' },
        { status: 400 }
      )
    }

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

    // 価格の存在確認と現在の情報を取得
    // Service Role Keyを使用してRLSをバイパス
    const { data: currentPrice } = await (supabaseAdmin as any)
      .from('menu_prices')
      .select('menu_item_id, start_date, end_date')
      .eq('id', id)
      .single()

    if (!currentPrice) {
      return NextResponse.json(
        { error: '価格が見つかりません' },
        { status: 404 }
      )
    }

    // 編集時の自動調整: 新しい開始日より前の期間に有効な価格（自分以外）のend_dateを自動設定
    // 新しい開始日が既存の価格の期間内に入っている場合、その価格を新しい開始日の前日で終了させる
    // 自分以外の価格で、新しい開始日と期間が重複しているものを探す
    const { data: overlappingPrices } = await (supabaseAdmin as any)
      .from('menu_prices')
      .select('id, start_date, end_date')
      .eq('menu_item_id', menu_item_id)
      .neq('id', id)

    if (overlappingPrices && overlappingPrices.length > 0) {
      // 新しい開始日より前から開始され、新しい開始日以降も有効な価格を探す
      const pricesToUpdate = overlappingPrices.filter((existing: any) => {
        const existingEnd = existing.end_date || '9999-12-31'
        // 既存の価格が新しい開始日以前に開始し、新しい開始日以降も有効な場合
        return existing.start_date <= start_date && existingEnd >= start_date
      })

      // 見つかった価格のend_dateを新しい開始日の前日に設定
      for (const priceToUpdate of pricesToUpdate) {
        const startDateObj = new Date(start_date)
        startDateObj.setDate(startDateObj.getDate() - 1)
        const previousDay = startDateObj.toISOString().split('T')[0] // YYYY-MM-DD形式

        const { error: updateError } = await (supabaseAdmin as any)
          .from('menu_prices')
          .update({ end_date: previousDay })
          .eq('id', priceToUpdate.id)

        if (updateError) {
          console.error('Overlapping price update error:', updateError)
          return NextResponse.json(
            { error: '既存の価格設定の自動調整に失敗しました', details: updateError.message },
            { status: 500 }
          )
        }
      }
    }

    // Service Role Keyを使用してRLSをバイパス
    // 注意: 実際のDBではmenu_item_idカラム名を使用
    const { data, error } = await (supabaseAdmin as any)
      .from('menu_prices')
      .update({
        menu_item_id,
        price,
        start_date,
        end_date: end_date || null,
      })
      .eq('id', id)
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
      console.error('Price update error:', error)
      return NextResponse.json(
        { error: '価格の更新に失敗しました', details: error.message },
        { status: 500 }
      )
    }

    // 監査ログ記録
    try {
      const headersList = await headers()
      const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'
      
      await (supabaseAdmin.from('audit_logs') as any).insert({
        actor_id: user.id,
        action: 'price.update',
        target_table: 'menu_prices',
        target_id: id.toString(),
        details: {
          price_id: id,
          menu_item_id: menu_item_id,
          price: price,
          start_date: start_date,
          end_date: end_date || null,
          previous_start_date: currentPrice.start_date,
          previous_end_date: currentPrice.end_date || null,
        },
        ip_address: ipAddress,
      })
    } catch (logError) {
      console.error('Audit log insert error:', logError)
      // ログ記録の失敗は無視して処理を続行
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Price PUT API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: '価格の更新中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}

/**
 * 価格削除
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const id = parseInt(resolvedParams.id, 10)

    if (isNaN(id)) {
      return NextResponse.json(
        { error: '無効なIDです' },
        { status: 400 }
      )
    }

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
    const { data, error } = await (supabaseAdmin as any)
      .from('menu_prices')
      .delete()
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Price delete error:', error)
      return NextResponse.json(
        { error: '価格の削除に失敗しました', details: error.message },
        { status: 500 }
      )
    }

    // 監査ログ記録
    try {
      const headersList = await headers()
      const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'
      
      await (supabaseAdmin.from('audit_logs') as any).insert({
        actor_id: user.id,
        action: 'price.delete',
        target_table: 'menu_prices',
        target_id: id.toString(),
        details: {
          price_id: id,
          menu_item_id: data.menu_item_id,
          price: data.price,
          start_date: data.start_date,
          end_date: data.end_date || null,
        },
        ip_address: ipAddress,
      })
    } catch (logError) {
      console.error('Audit log insert error:', logError)
      // ログ記録の失敗は無視して処理を続行
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Price DELETE API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: '価格の削除中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}
