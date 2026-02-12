import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import path from 'path'
import fs from 'fs'

/**
 * 注文者一覧PDF出力API
 * GET /api/admin/orders/today/order-list-pdf?date=YYYY-MM-DD
 * 
 * お弁当保管場所に掲示するための注文者一覧を出力
 * お弁当の種類ごとに社員番号、氏名、数量を記載
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

    // 指定日の注文を取得
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select(`
        id,
        user_id,
        menu_item_id,
        order_date,
        quantity,
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
      .order('created_at', { ascending: true })

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
        user_name: order.profiles?.full_name || 'ユーザー不明',
        employee_code: order.profiles?.employee_code || '',
      }
    })

    // 社員コード順でソート
    ordersWithDetails.sort((a: any, b: any) => {
      const codeA = a.employee_code || ''
      const codeB = b.employee_code || ''
      return codeA.localeCompare(codeB)
    })

    // メニューごとにグループ化
    const groupedByMenu = ordersWithDetails.reduce((acc: any, order: any) => {
      const menuKey = order.menu_item_id || 'unknown'
      const menuName = order.menu_name || 'メニュー不明'
      const vendorName = order.vendor_name || '業者不明'
      
      if (!acc[menuKey]) {
        acc[menuKey] = {
          menu_item_id: menuKey,
          menu_name: menuName,
          vendor_name: vendorName,
          orders: [] as any[],
        }
      }

      acc[menuKey].orders.push(order)
      return acc
    }, {} as any)

    // 合計数量を計算
    const totalQuantity = ordersWithDetails.reduce(
      (sum: number, order: any) => sum + (order.quantity || 0),
      0
    )

    // PDFを生成
    const chunks: Buffer[] = []
    
    // pdfkitのフォント設定（既存のコードと同じロジック）
    const fontDataDir = path.join(process.cwd(), 'node_modules', 'pdfkit', 'js', 'data')
    const possibleTargetDirs = [
      path.join(process.cwd(), '.next', 'dev', 'server', 'vendor-chunks', 'data'),
      path.join(process.cwd(), '.next', 'server', 'vendor-chunks', 'data'),
      path.join(process.cwd(), '.next', 'static', 'chunks', 'data'),
    ]
    
    if (fs.existsSync(fontDataDir)) {
      const fontFiles = fs.readdirSync(fontDataDir).filter((file: string) => file.endsWith('.afm'))
      
      for (const targetDir of possibleTargetDirs) {
        if (!fs.existsSync(targetDir)) {
          try {
            fs.mkdirSync(targetDir, { recursive: true })
          } catch (error) {
            console.warn(`Failed to create directory ${targetDir}:`, error)
            continue
          }
        }
        
        for (const fontFile of fontFiles) {
          const sourcePath = path.join(fontDataDir, fontFile)
          const targetPath = path.join(targetDir, fontFile)
          
          try {
            if (fs.existsSync(sourcePath) && !fs.existsSync(targetPath)) {
              fs.copyFileSync(sourcePath, targetPath)
            }
          } catch (error) {
            console.warn(`Failed to copy ${fontFile} to ${targetDir}:`, error)
          }
        }
      }
    }
    
    let pdfkitFontPath: string | undefined
    for (const targetDir of possibleTargetDirs) {
      const helveticaPath = path.join(targetDir, 'Helvetica.afm')
      if (fs.existsSync(helveticaPath)) {
        pdfkitFontPath = targetDir
        process.env.PDFKIT_FONT_DATA_PATH = targetDir
        break
      }
    }
    
    if (!pdfkitFontPath && fs.existsSync(fontDataDir)) {
      const helveticaPath = path.join(fontDataDir, 'Helvetica.afm')
      if (fs.existsSync(helveticaPath)) {
        process.env.PDFKIT_FONT_DATA_PATH = fontDataDir
        pdfkitFontPath = fontDataDir
      }
    }
    
    const doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: 40,
        bottom: 60,
        left: 40,
        right: 40,
      },
    })
    
    // 日本語フォントを登録
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
            console.log(`✓ Japanese font registered successfully: ${fontPath}`)
            break
          } catch (fontError) {
            console.error(`Failed to register font ${fontPath}:`, fontError)
          }
        }
      }
      
      if (!japaneseFontRegistered) {
        console.warn('⚠ Japanese font not found. PDF may display garbled text.')
      }
    } catch (error) {
      console.error('Failed to register Japanese font:', error)
    }

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))

    // 日付フォーマット（YYYY年MM月DD日形式）
    const dateObj = new Date(date)
    const formattedDate = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日`

    // ヘッダー（グリーンのバナー）
    const headerHeight = 60
    const headerY = doc.page.margins.top
    doc.rect(0, headerY, doc.page.width, headerHeight)
      .fillColor('#059669')
      .fill()
    
    doc.fillColor('#ffffff')
      .fontSize(24)
      .text('注文者一覧', 0, headerY + 10, {
        width: doc.page.width,
        align: 'center',
      })
    
    doc.fillColor('#ffffff')
      .fontSize(14)
      .text(formattedDate, 0, headerY + 38, {
        width: doc.page.width,
        align: 'center',
      })
    
    let currentY = headerY + headerHeight + 30

    // メニューごとの注文者一覧
    for (const menu of Object.values(groupedByMenu) as any[]) {
      const menuQuantity = menu.orders.reduce(
        (sum: number, order: any) => sum + (order.quantity || 0),
        0
      )

      // メニュー名と業者名（背景色付き）
      const menuHeaderHeight = 30
      doc.rect(doc.page.margins.left, currentY, doc.page.width - doc.page.margins.left - doc.page.margins.right, menuHeaderHeight)
        .fillColor('#f3f4f6')
        .fill()
      
      doc.fillColor('#000000')
        .fontSize(14)
        .text(
          `${menu.menu_name} (${menu.vendor_name})`,
          doc.page.margins.left + 10,
          currentY + 8,
          { width: 400 }
        )
      
      doc.fontSize(12)
        .text(
          `数量: ${menuQuantity}`,
          doc.page.width - doc.page.margins.right - 100,
          currentY + 10,
          { width: 100, align: 'right' }
        )
      
      currentY += menuHeaderHeight + 5

      // テーブルヘッダー
      const tableTop = currentY
      const colWidths = [100, 250, 80] // 社員番号、氏名、数量
      const headers = ['社員番号', '氏名', '数量']
      
      doc.fillColor('#000000').fontSize(15)
      let x = doc.page.margins.left
      headers.forEach((header, i) => {
        doc.text(header, x, tableTop, { 
          width: colWidths[i], 
          align: i === 2 ? 'center' : 'left' 
        })
        x += colWidths[i]
      })
      
      // テーブルの罫線（ヘッダー下）
      doc.moveTo(doc.page.margins.left, tableTop + 20)
        .lineTo(doc.page.margins.left + colWidths.reduce((a, b) => a + b, 0), tableTop + 20)
        .strokeColor('#000000')
        .lineWidth(0.5)
        .stroke()
      
      currentY = tableTop + 25

      // 注文者一覧
      for (const order of menu.orders) {
        // ページの残りスペースをチェック（フッター用のスペースを確保）
        if (currentY > doc.page.height - doc.page.margins.bottom - 50) {
          doc.addPage()
          currentY = doc.page.margins.top
        }

        x = doc.page.margins.left
        const rowY = currentY
        
        doc.fillColor('#000000').fontSize(15)
        
        // 社員番号
        doc.text(order.employee_code || '-', x, rowY, { width: colWidths[0] })
        x += colWidths[0]

        // 氏名
        doc.text(order.user_name, x, rowY, { width: colWidths[1] })
        x += colWidths[1]

        // 数量（中央寄せ）
        doc.text(String(order.quantity), x, rowY, { width: colWidths[2], align: 'center' })
        
        currentY += 22
      }

      currentY += 20 // 次のメニューとの間隔
    }

    // フッター（合計数量）
    const footerY = doc.page.height - doc.page.margins.bottom - 40
    doc.rect(doc.page.margins.left, footerY, doc.page.width - doc.page.margins.left - doc.page.margins.right, 30)
      .fillColor('#f3f4f6')
      .fill()
    
    doc.fillColor('#000000')
      .fontSize(14)
      .text(
        `合計数量: ${totalQuantity}`,
        doc.page.margins.left + 10,
        footerY + 8,
        { width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 20, align: 'center' }
      )

    // PDFを終了
    doc.end()

    // ストリームからBufferを取得
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks))
      })
      doc.on('error', reject)
    })

    // 監査ログ記録
    try {
      const ipAddress = request.headers.get('x-forwarded-for') || 
                       request.headers.get('x-real-ip') || 
                       'unknown'
      
      await (supabaseAdmin
        .from('audit_logs') as any)
        .insert({
          actor_id: user.id,
          action: 'pdf.generate.order_list',
          target_table: 'orders',
          target_id: null,
          details: {
            date: date,
            total_quantity: totalQuantity,
            order_count: ordersWithDetails.length,
            menu_count: Object.keys(groupedByMenu).length,
          },
          ip_address: ipAddress,
        })
    } catch (logError) {
      console.error('Audit log insert error:', logError)
    }

    // PDFファイルとして返す
    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="order_list_${date}.pdf"`,
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
