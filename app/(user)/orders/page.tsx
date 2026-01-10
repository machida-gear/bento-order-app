import { createClient } from "@/lib/supabase/server";
import { queryDatabase } from "@/lib/database/query";
import OrdersHistoryClient from "@/components/orders-history-client";
import { Suspense } from "react";

type CalculatedPeriod = {
  start_date: string;
  end_date: string;
  label: string;
};

/**
 * 締日期間を計算する関数
 */
function calculateClosingPeriods(
  closingDay: number | null,
  monthsCount: number
): CalculatedPeriod[] {
  const periods: CalculatedPeriod[] = [];
  const today = new Date();

  for (let i = 0; i < monthsCount; i++) {
    // 現在からiヶ月前の月を計算
    const targetMonth = new Date(
      today.getFullYear(),
      today.getMonth() - i,
      1
    );
    const year = targetMonth.getFullYear();
    const month = targetMonth.getMonth(); // 0-11

    // 前月の情報
    const prevMonth = new Date(year, month, 0); // 前月の最終日
    const prevYear = prevMonth.getFullYear();
    const prevMonthIndex = prevMonth.getMonth(); // 0-11

    let startDate: Date;
    let endDate: Date;

    if (closingDay === null) {
      // 月末締めの場合
      // 開始日：前月の最終日の次の日（=当月の1日）
      startDate = new Date(year, month, 1);
      // 終了日：当月の最終日
      endDate = new Date(year, month + 1, 0);
    } else {
      // 指定日締めの場合
      // 開始日：前月の締日+1日
      startDate = new Date(prevYear, prevMonthIndex, closingDay + 1);
      // 終了日：当月の締日
      endDate = new Date(year, month, closingDay);

      // 日付が有効でない場合（例：2月31日など）は月末にする
      if (endDate.getMonth() !== month) {
        endDate = new Date(year, month + 1, 0); // 当月の最終日
      }
    }

    // YYYY-MM-DD形式に変換
    const formatDate = (date: Date): string => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    };

    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);

    // ラベルを生成（例：2025年12月11日 ～ 2026年1月10日）
    const startLabel = `${startDate.getFullYear()}年${startDate.getMonth() + 1}月${startDate.getDate()}日`;
    const endLabel = `${endDate.getFullYear()}年${endDate.getMonth() + 1}月${endDate.getDate()}日`;

    periods.push({
      start_date: startDateStr,
      end_date: endDateStr,
      label: `${startLabel} ～ ${endLabel}`,
    });
  }

  return periods;
}

/**
 * 注文履歴ページ
 * ユーザーの注文一覧を表示（締日期間で集計）
 */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // searchParamsから期間タイプを取得（デフォルトは"current"）
  const params = await searchParams;
  const selectedPeriod = (params.period === "next" ? "next" : "current") as
    | "current"
    | "next";

  // システム設定から締日を取得
  const { data: settings } = await supabase
    .from("system_settings")
    .select("closing_day")
    .eq("id", 1)
    .single();

  const closingDay =
    (settings as { closing_day?: number | null } | null)?.closing_day ?? null;

  // 現在の日付を取得
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD

  // 過去12ヶ月分の締日期間を計算
  const periods = calculateClosingPeriods(closingDay, 12);

  // 現在の日付が含まれる期間を探す
  let currentPeriod: CalculatedPeriod | null = null;
  let currentPeriodIndex = -1;

  for (let i = 0; i < periods.length; i++) {
    const period = periods[i];
    if (todayStr >= period.start_date && todayStr <= period.end_date) {
      currentPeriod = period;
      currentPeriodIndex = i;
      break;
    }
  }

  // 現在の期間が見つからない場合は、最新の期間を使用
  if (!currentPeriod && periods.length > 0) {
    currentPeriod = periods[0];
    currentPeriodIndex = 0;
  }

  // 次の期間（未来の期間）を計算
  let nextPeriod: CalculatedPeriod | null = null;
  if (currentPeriod) {
    // 現在の期間の終了日の翌日から始まる次の期間を計算
    const currentEndDate = new Date(currentPeriod.end_date);
    currentEndDate.setDate(currentEndDate.getDate() + 1);
    
    // 次の期間の開始日は現在の期間の終了日の翌日
    const nextStartDate = new Date(currentEndDate);
    
    // 締日期間を計算する関数を使って次の期間を計算
    const nextYear = nextStartDate.getFullYear();
    const nextMonth = nextStartDate.getMonth(); // 0-11
    
    let nextPeriodStart: Date;
    let nextPeriodEnd: Date;
    
    if (closingDay === null) {
      // 月末締めの場合
      // 開始日：当月の1日
      nextPeriodStart = new Date(nextYear, nextMonth, 1);
      // 終了日：当月の最終日
      nextPeriodEnd = new Date(nextYear, nextMonth + 1, 0);
    } else {
      // 指定日締めの場合
      // 前月の情報
      const prevMonth = new Date(nextYear, nextMonth, 0);
      const prevYear = prevMonth.getFullYear();
      const prevMonthIndex = prevMonth.getMonth();
      
      // 開始日：前月の締日+1日
      nextPeriodStart = new Date(prevYear, prevMonthIndex, closingDay + 1);
      // 終了日：当月の締日
      nextPeriodEnd = new Date(nextYear, nextMonth, closingDay);
      
      // 日付が有効でない場合（例：2月31日など）は月末にする
      if (nextPeriodEnd.getMonth() !== nextMonth) {
        nextPeriodEnd = new Date(nextYear, nextMonth + 1, 0);
      }
    }
    
    // YYYY-MM-DD形式に変換
    const formatDate = (date: Date): string => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    };
    
    const nextStartDateStr = formatDate(nextPeriodStart);
    const nextEndDateStr = formatDate(nextPeriodEnd);
    
    // ラベルを生成
    const nextStartLabel = `${nextPeriodStart.getFullYear()}年${nextPeriodStart.getMonth() + 1}月${nextPeriodStart.getDate()}日`;
    const nextEndLabel = `${nextPeriodEnd.getFullYear()}年${nextPeriodEnd.getMonth() + 1}月${nextPeriodEnd.getDate()}日`;
    
    nextPeriod = {
      start_date: nextStartDateStr,
      end_date: nextEndDateStr,
      label: `${nextStartLabel} ～ ${nextEndLabel}`,
    };
  }

  // 取得する期間の範囲を決定（現在の期間と次の期間の両方を含む）
  // クライアント側でフィルタリングするため、両方の期間の注文を取得
  let startDate: string;
  let endDate: string;

  if (currentPeriod) {
    startDate = currentPeriod.start_date;
    endDate = currentPeriod.end_date;
    // 次の期間も含める（次の期間の終了日が現在の期間の終了日より後の場合）
    if (nextPeriod && nextPeriod.end_date > currentPeriod.end_date) {
      endDate = nextPeriod.end_date;
    }
    // 次の期間の開始日が現在の期間の開始日より前の場合（過去の期間）
    if (nextPeriod && nextPeriod.start_date < currentPeriod.start_date) {
      startDate = nextPeriod.start_date;
    }
  } else {
    // フォールバック：過去3ヶ月分を取得
    const fallbackStart = new Date();
    fallbackStart.setMonth(fallbackStart.getMonth() - 3);
    startDate = fallbackStart.toISOString().split("T")[0];
    endDate = today.toISOString().split("T")[0];
  }

  // Transaction connectionを使用してデータを取得（パフォーマンス向上）
  const { orders, orderDays } = await queryDatabase(async (client) => {
    // 注文データを取得（menu_itemsとvendorsのJOIN）
    const ordersResult = await client.query(
      `SELECT 
        o.*,
        mi.id as menu_item_id_from_menu,
        mi.name as menu_item_name,
        v.id as vendor_id_from_vendor,
        v.name as vendor_name
       FROM orders o
       LEFT JOIN menu_items mi ON o.menu_item_id = mi.id
       LEFT JOIN vendors v ON mi.vendor_id = v.id
       WHERE o.user_id = $1 AND o.order_date >= $2 AND o.order_date <= $3
       ORDER BY o.order_date DESC`,
      [user.id, startDate, endDate]
    );

    // 注文データを整形（Supabaseの形式に合わせる）
    const orders = ordersResult.rows.map((row: any) => ({
      ...row,
      menu_items: row.menu_item_id_from_menu ? {
        id: String(row.menu_item_id_from_menu),
        name: row.menu_item_name,
        vendors: row.vendor_id_from_vendor ? {
          id: String(row.vendor_id_from_vendor),
          name: row.vendor_name,
        } : null,
      } : null,
    }));

    // 注文日付のリストを取得
    const orderDates = orders.map((order: any) => order.order_date).filter(Boolean);

    // カレンダー情報を取得（締切時間チェック用）
    let orderDays: Array<{ target_date: string; deadline_time: string | null }> = [];
    if (orderDates.length > 0) {
      const orderDaysResult = await client.query(
        `SELECT target_date, deadline_time 
         FROM order_calendar 
         WHERE target_date = ANY($1::date[])`,
        [orderDates]
      );
      orderDays = orderDaysResult.rows;
    }

    return { orders, orderDays };
  });

  // 注文データをOrder型に変換
  const ordersTyped = (orders || []).map((order: any) => ({
    id: order.id,
    order_date: order.order_date,
    menu_items: order.menu_items,
    quantity: order.quantity || 1,
    unit_price_snapshot: order.unit_price_snapshot || 0,
    status: order.status || 'ordered',
    ...order,
  }));

  return (
    <Suspense fallback={<div className="text-center py-12 text-gray-500">読み込み中...</div>}>
      <OrdersHistoryClient
        orders={ordersTyped}
        orderDays={orderDays as Array<{ target_date: string; deadline_time: string | null }>}
        currentPeriod={currentPeriod}
        nextPeriod={nextPeriod}
        selectedPeriod={selectedPeriod}
      />
    </Suspense>
  );
}
