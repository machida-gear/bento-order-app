import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * ユーザー向け締日期間取得API
 * GET /api/user/closing-period - 現在の締日期間と次の締日期間を取得
 */

type CalculatedPeriod = {
  start_date: string
  end_date: string
  label: string
}

/**
 * 締日期間を計算する関数
 */
function calculateClosingPeriods(closingDay: number | null, monthsCount: number): CalculatedPeriod[] {
  const periods: CalculatedPeriod[] = []
  const today = new Date()
  
  for (let i = 0; i < monthsCount; i++) {
    // 現在からiヶ月前の月を計算
    const targetMonth = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const year = targetMonth.getFullYear()
    const month = targetMonth.getMonth() // 0-11
    
    // 前月の情報
    const prevMonth = new Date(year, month, 0) // 前月の最終日
    const prevYear = prevMonth.getFullYear()
    const prevMonthIndex = prevMonth.getMonth() // 0-11
    
    let startDate: Date
    let endDate: Date
    
    if (closingDay === null) {
      // 月末締めの場合
      // 開始日：前月の最終日の次の日（=当月の1日）
      startDate = new Date(year, month, 1)
      // 終了日：当月の最終日
      endDate = new Date(year, month + 1, 0)
    } else {
      // 指定日締めの場合
      // 開始日：前月の締日+1日
      startDate = new Date(prevYear, prevMonthIndex, closingDay + 1)
      // 終了日：当月の締日
      endDate = new Date(year, month, closingDay)
      
      // 日付が有効でない場合（例：2月31日など）は月末にする
      if (endDate.getMonth() !== month) {
        endDate = new Date(year, month + 1, 0) // 当月の最終日
      }
    }
    
    // YYYY-MM-DD形式に変換
    const formatDate = (date: Date): string => {
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    }
    
    const startDateStr = formatDate(startDate)
    const endDateStr = formatDate(endDate)
    
    // ラベルを生成（例：2025年12月11日 ～ 2026年1月10日）
    const startLabel = `${startDate.getFullYear()}年${startDate.getMonth() + 1}月${startDate.getDate()}日`
    const endLabel = `${endDate.getFullYear()}年${endDate.getMonth() + 1}月${endDate.getDate()}日`
    
    periods.push({
      start_date: startDateStr,
      end_date: endDateStr,
      label: `${startLabel} ～ ${endLabel}`,
    })
  }
  
  return periods
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // システム設定から締日を取得
    const { data: settings } = await supabase
      .from('system_settings')
      .select('closing_day')
      .eq('id', 1)
      .single()

    const closingDay = (settings as { closing_day?: number | null } | null)?.closing_day ?? null

    // 現在の日付を取得
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0] // YYYY-MM-DD

    // 過去12ヶ月分の締日期間を計算
    const periods = calculateClosingPeriods(closingDay, 12)

    // 現在の日付が含まれる期間を探す
    let currentPeriod: CalculatedPeriod | null = null
    let nextPeriod: CalculatedPeriod | null = null

    for (let i = 0; i < periods.length; i++) {
      const period = periods[i]
      if (todayStr >= period.start_date && todayStr <= period.end_date) {
        currentPeriod = period
        // 次の期間は1つ前の期間（より未来）
        if (i > 0) {
          nextPeriod = periods[i - 1]
        }
        break
      }
    }

    // 現在の期間が見つからない場合は、最新の期間を使用
    if (!currentPeriod && periods.length > 0) {
      currentPeriod = periods[0]
      if (periods.length > 1) {
        nextPeriod = periods[1]
      }
    }

    return NextResponse.json({
      success: true,
      currentPeriod,
      nextPeriod,
    })
  } catch (error) {
    console.error('Closing period API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: '締日期間の取得中にエラーが発生しました: ' + errorMessage },
      { status: 500 }
    )
  }
}
