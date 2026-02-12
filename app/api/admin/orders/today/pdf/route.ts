import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import path from 'path'
import fs from 'fs'

/**
 * PDF出力API
 * GET /api/admin/orders/today/pdf?date=YYYY-MM-DD&vendor_id=XXX
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // 管理者権限チェック
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const profileTyped = profile as { role?: string; [key: string]: any } | null
    if (!profileTyped || profileTyped.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const vendorId = searchParams.get('vendor_id')

    // vendor_idが必須（業者ごとのPDFのみ）
    if (!vendorId) {
      return NextResponse.json(
        { error: 'vendor_idパラメータが必要です' },
        { status: 400 }
      )
    }

    // 指定日の注文を取得
    let query = supabaseAdmin
      .from('orders')
      .select(`
        id,
        user_id,
        menu_item_id,
        order_date,
        quantity,
        unit_price_snapshot,
        status,
        created_at,
        profiles:user_id (
          id,
          employee_code,
          full_name
        )
      `)
      .eq('order_date', date)
      .eq('status', 'ordered')
      .order('created_at', { ascending: false })

    const { data: orders, error: ordersError } = await query

    if (ordersError) {
      console.error('Orders fetch error:', ordersError)
      return NextResponse.json(
        { error: '注文データの取得に失敗しました', details: ordersError.message },
        { status: 500 }
      )
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json(
        { error: '指定日の注文がありません' },
        { status: 404 }
      )
    }

    // メニューIDを取得
    const menuItemIds = [...new Set(orders.map((order: any) => order.menu_item_id).filter(Boolean))]

    // メニュー情報を取得
    let menuItemsMap = new Map()
    if (menuItemIds.length > 0) {
      const { data: menuItems, error: menuItemsError } = await supabaseAdmin
        .from('menu_items')
        .select(`
          id,
          name,
          vendor_id,
          vendors (
            id,
            code,
            name
          )
        `)
        .in('id', menuItemIds)
        .eq('is_active', true)

      if (!menuItemsError && menuItems) {
        menuItemsMap = new Map(
          menuItems.map((item: any) => [
            item.id,
            {
              name: item.name,
              vendor: item.vendors,
            },
          ])
        )
      }
    }

    // 注文データにメニュー情報を結合
    const ordersWithDetails = orders.map((order: any) => {
      const menuItem = menuItemsMap.get(order.menu_item_id)
      return {
        ...order,
        menu_name: menuItem?.name || 'メニュー不明',
        vendor_name: menuItem?.vendor?.name || '業者不明',
        vendor_code: menuItem?.vendor?.code || '',
        vendor_id: menuItem?.vendor?.id || null,
        user_name: order.profiles?.full_name || 'ユーザー不明',
        employee_code: order.profiles?.employee_code || '',
        total_price: (order.unit_price_snapshot || 0) * (order.quantity || 1),
      }
    })

    // 業者IDでフィルタ
    const filteredOrders = ordersWithDetails.filter(
      (order: any) => order.vendor_id?.toString() === vendorId
    )

    if (filteredOrders.length === 0) {
      return NextResponse.json(
        { error: '指定条件の注文がありません' },
        { status: 404 }
      )
    }

    // 業者情報を取得
    const vendor = filteredOrders[0]
    const vendorName = vendor.vendor_name || '業者不明'
    const vendorCode = vendor.vendor_code || ''

    // メニューごとにグループ化
    const groupedByMenu = filteredOrders.reduce((acc: any, order: any) => {
      const menuKey = order.menu_item_id || 'unknown'
      const menuName = order.menu_name || 'メニュー不明'
      
      if (!acc[menuKey]) {
        acc[menuKey] = {
          menu_item_id: menuKey,
          menu_name: menuName,
          orders: [] as any[],
        }
      }

      acc[menuKey].orders.push(order)
      return acc
    }, {} as any)

    // 業者ごとの合計食数を計算
    const totalQuantity = filteredOrders.reduce(
      (sum: number, order: any) => sum + (order.quantity || 0),
      0
    )
    
    // 会社情報を取得（system_settingsテーブルから）
    const { data: companySettings } = await supabaseAdmin
      .from('system_settings')
      .select('company_name, company_postal_code, company_address1, company_address2, company_phone, company_fax, company_email')
      .eq('id', 1)
      .single()
    
    // 送信者情報（会社マスターから取得、なければ環境変数、それもなければ固定値）
    const companySettingsTyped = companySettings as { company_name?: string | null; company_postal_code?: string | null; company_address1?: string | null; company_address2?: string | null; company_phone?: string | null; company_fax?: string | null; [key: string]: any } | null
    const senderCompany = companySettingsTyped?.company_name || process.env.PDF_SENDER_COMPANY || '●●●●株式会社'
    const senderPostalCode = companySettingsTyped?.company_postal_code || process.env.PDF_SENDER_POSTAL_CODE || '〒100-0000'
    
    // 住所を2行で構築（address1とaddress2の両方がある場合は2行、片方のみの場合は1行）
    let senderAddress = ''
    if (companySettingsTyped?.company_address1 || companySettingsTyped?.company_address2) {
      const address1 = companySettingsTyped?.company_address1 || ''
      const address2 = companySettingsTyped?.company_address2 || ''
      if (address1 && address2) {
        senderAddress = `住所:${address1}\n${address2}`
      } else if (address1) {
        senderAddress = `住所:${address1}`
      } else if (address2) {
        senderAddress = `住所:${address2}`
      }
    } else {
      senderAddress = process.env.PDF_SENDER_ADDRESS || '住所:東京都千代田区0-1-2●●ビル 1F'
    }
    
    const senderPhone = companySettingsTyped?.company_phone
      ? `電話: ${companySettingsTyped.company_phone}`
      : process.env.PDF_SENDER_PHONE || '電話: 00-0000-0000'
    
    const senderFax = companySettingsTyped?.company_fax
      ? `FAX: ${companySettingsTyped.company_fax}`
      : process.env.PDF_SENDER_FAX || 'FAX: 00-0000-0000'

    // PDFを生成
    // pdfkitはserverExternalPackages設定により、node_modulesからそのまま読み込まれる
    // これにより.afmフォントファイルが正しく参照される
    const chunks: Buffer[] = []
    
    const doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: 40,
        bottom: 40,
        left: 40,
        right: 40,
      },
    })
    
    // 日本語フォントを登録（IPAフォントまたはNoto Sans JP）
    // フォントファイルが存在する場合は使用、存在しない場合はデフォルトフォント（Helvetica）を使用
    let japaneseFontRegistered = false
    try {
      const possibleFontPaths = [
        path.join(process.cwd(), 'public', 'fonts', 'ipaexg.ttf'),
        path.join(process.cwd(), 'public', 'fonts', 'IPAexGothic.ttf'),
        path.join(process.cwd(), 'public', 'fonts', 'ipag.ttf'),
        path.join(process.cwd(), 'public', 'fonts', 'ipagp.ttf'),
        path.join(process.cwd(), 'public', 'fonts', 'NotoSansJP-Regular.ttf'),
        path.join(process.cwd(), 'public', 'fonts', 'NotoSansCJK-Regular.ttf'),
      ]
      
      for (const fontPath of possibleFontPaths) {
        if (fs.existsSync(fontPath)) {
          try {
            doc.registerFont('Japanese', fontPath)
            doc.font('Japanese')
            japaneseFontRegistered = true
            console.log(`✓ Japanese font registered: ${fontPath}`)
            break
          } catch (fontError) {
            console.error(`Failed to register font ${fontPath}:`, fontError)
          }
        }
      }
      
      if (!japaneseFontRegistered) {
        console.warn('⚠ Japanese font not found. Using default font (Helvetica).')
      }
    } catch (error) {
      console.error('Failed to register Japanese font:', error)
    }

    // データをストリームに書き込む
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))

    // 日付フォーマット（YYYY/M/D形式）
    const dateObj = new Date(date)
    const formattedDate = `${dateObj.getFullYear()}/${dateObj.getMonth() + 1}/${dateObj.getDate()}`

    // 青いバナーヘッダー（発注書）
    const headerHeight = 50
    const headerY = doc.page.margins.top
    doc.rect(0, headerY, doc.page.width, headerHeight)
      .fillColor('#2563eb')
      .fill()
    
    doc.fillColor('#ffffff')
      .fontSize(24)
      .text('発注書', 0, headerY + 10, {
        width: doc.page.width,
        align: 'center',
      })
    
    // 右上に発注日（白文字でバナーの上に表示）
    doc.fillColor('#ffffff')
      .fontSize(12)
      .text(`発注日 ${formattedDate}`, doc.page.width - doc.page.margins.right - 100, headerY + 15, {
        width: 100,
        align: 'right',
      })
    
    let currentY = headerY + headerHeight + 20

    // 左上：業者名「○○○○御中」（長文対応）
    doc.fillColor('#000000')
      .fontSize(14)
      .text(`${vendorName} 御中`, doc.page.margins.left, currentY, {
        width: 300, // 幅を広げて長文に対応
        ellipsis: false // 長文でも切らない
      })
    
    // 右上：送信者情報（長文対応のため幅を広げ、フォントサイズを調整）
    const senderX = doc.page.width - doc.page.margins.right - 200
    const senderWidth = 200
    
    // 会社名（長文対応：フォントサイズを調整）
    doc.fontSize(11)
      .text(senderCompany, senderX, currentY, { 
        width: senderWidth, 
        align: 'right',
        ellipsis: false // 長文でも切らない
      })
    currentY += 18
    
    // 郵便番号
    doc.fontSize(11)
      .text(senderPostalCode, senderX, currentY, { width: senderWidth, align: 'right' })
    currentY += 15
    
    // 住所（2行対応）
    doc.fontSize(10)
    if (companySettingsTyped?.company_address1 || companySettingsTyped?.company_address2) {
      const address1 = companySettingsTyped?.company_address1 || ''
      const address2 = companySettingsTyped?.company_address2 || ''
      
      if (address1 && address2) {
        // 2行で表示
        doc.text(`住所:${address1}`, senderX, currentY, { 
          width: senderWidth, 
          align: 'right',
          ellipsis: false
        })
        currentY += 12
        doc.text(address2, senderX, currentY, { 
          width: senderWidth, 
          align: 'right',
          ellipsis: false
        })
        currentY += 12
      } else if (address1) {
        // 1行目のみ
        doc.text(`住所:${address1}`, senderX, currentY, { 
          width: senderWidth, 
          align: 'right',
          ellipsis: false
        })
        currentY += 12
      } else if (address2) {
        // 2行目のみ
        doc.text(`住所:${address2}`, senderX, currentY, { 
          width: senderWidth, 
          align: 'right',
          ellipsis: false
        })
        currentY += 12
      }
    } else {
      // フォールバック（環境変数または固定値）
      const addressLines = senderAddress.split('\n')
      addressLines.forEach((line: string) => {
        doc.text(line, senderX, currentY, { 
          width: senderWidth, 
          align: 'right',
          ellipsis: false
        })
        currentY += 12
      })
    }
    
    // 電話番号
    doc.text(senderPhone, senderX, currentY, { width: senderWidth, align: 'right' })
    currentY += 12
    
    // FAX番号
    doc.text(senderFax, senderX, currentY, { width: senderWidth, align: 'right' })
    
    currentY += 30

    // 「下記の通り、発注いたします。」
    doc.fontSize(12)
      .text('下記の通り、発注いたします。', doc.page.margins.left, currentY)
    currentY += 25

    // 合計食数（青いボックス）
    const totalBoxWidth = 200
    const totalBoxHeight = 60
    const totalBoxX = doc.page.margins.left
    const totalBoxY = currentY
    
    doc.rect(totalBoxX, totalBoxY, totalBoxWidth, totalBoxHeight)
      .fillColor('#2563eb')
      .fill()
    
    doc.fillColor('#ffffff')
      .fontSize(10)
      .text('合計食数', totalBoxX + 10, totalBoxY + 10, {
        width: totalBoxWidth - 20,
        align: 'center',
      })
    
    doc.fontSize(24)
      .text(`${totalQuantity}食`, totalBoxX + 10, totalBoxY + 25, {
        width: totalBoxWidth - 20,
        align: 'center',
      })
    
    currentY += totalBoxHeight + 20

    // テーブルヘッダー
    doc.fillColor('#000000').fontSize(14)
    const tableTop = currentY
    const colWidths = [400, 100] // 内容、数量
    const headers = ['内容', '数量']
    
    let x = doc.page.margins.left
    headers.forEach((header, i) => {
      doc.text(header, x, tableTop, { width: colWidths[i], align: i === 1 ? 'center' : 'left' })
      x += colWidths[i]
    })
    
    // テーブルの罫線（ヘッダー下）
    doc.moveTo(doc.page.margins.left, tableTop + 18)
      .lineTo(doc.page.margins.left + colWidths.reduce((a, b) => a + b, 0), tableTop + 18)
      .strokeColor('#000000')
      .lineWidth(0.5)
      .stroke()
    
    currentY = tableTop + 28

    // メニューごとの注文（集計して表示）
    Object.values(groupedByMenu).forEach((menu: any) => {
      const menuQuantity = menu.orders.reduce(
        (sum: number, order: any) => sum + (order.quantity || 0),
        0
      )

      // テーブル行
      x = doc.page.margins.left
      const rowY = currentY
      
      // 内容（メニュー名）
      doc.fillColor('#000000').fontSize(14)
      doc.text(menu.menu_name, x, rowY, { width: colWidths[0] })
      x += colWidths[0]

      // 数量（中央寄せ）
      doc.text(String(menuQuantity), x, rowY, { width: colWidths[1], align: 'center' })
      
      currentY += 25
    })

    // フッター
    doc.fontSize(8).fillColor('#9ca3af').text(
      'この注文書はシステムにより自動生成されました',
      doc.page.margins.left,
      doc.page.height - doc.page.margins.bottom - 20,
      { align: 'center', width: doc.page.width - doc.page.margins.left - doc.page.margins.right }
    )

    // PDFを終了
    doc.end()

    // ストリームからBufferを取得（PDF生成を完了）
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks))
      })
      doc.on('error', reject)
    })

    // 監査ログ記録（PDF生成完了後に実行）
    // ログ記録の失敗は無視して処理を続行（PDF生成は成功しているため）
    try {
      // IPアドレスを取得（request.headersから直接取得）
      const ipAddress = request.headers.get('x-forwarded-for') || 
                       request.headers.get('x-real-ip') || 
                       'unknown'
      
      const logData = {
        actor_id: user.id,
        action: 'pdf.generate',
        target_table: 'orders',
        target_id: null,
        details: {
          date: date,
          vendor_id: parseInt(vendorId, 10),
          vendor_name: vendorName,
          total_quantity: totalQuantity,
          order_count: filteredOrders.length,
        },
        ip_address: ipAddress,
      }
      
      console.log('[PDF] Starting audit log insert:', {
        actor_id: logData.actor_id,
        action: logData.action,
        date: logData.details.date,
        vendor_id: logData.details.vendor_id,
      })
      
      const { data: logResult, error: logError } = await (supabaseAdmin
        .from('audit_logs') as any)
        .insert(logData)
        .select()
      
      if (logError) {
        console.error('[PDF] Audit log insert FAILED:', {
          code: logError.code,
          message: logError.message,
          details: logError.details,
          hint: logError.hint,
        })
        console.error('[PDF] Log data that failed:', JSON.stringify(logData, null, 2))
        // エラーの詳細をログに出力して、問題を特定しやすくする
        if (logError.code) {
          console.error('[PDF] Error code:', logError.code)
        }
        if (logError.details) {
          console.error('[PDF] Error details:', logError.details)
        }
        if (logError.hint) {
          console.error('[PDF] Error hint:', logError.hint)
        }
      } else {
        console.log('[PDF] Audit log inserted successfully. ID:', logResult?.[0]?.id)
      }
    } catch (logError) {
      console.error('[PDF] Audit log insert exception:', logError)
      if (logError instanceof Error) {
        console.error('[PDF] Exception message:', logError.message)
        console.error('[PDF] Exception stack:', logError.stack)
      }
      // ログ記録の失敗は無視して処理を続行
    }

    // PDFファイルとして返す
    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="order_${date}_vendor_${vendorId}.pdf"`,
      },
    })
  } catch (error) {
    console.error('PDF generation error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'PDF生成中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}
