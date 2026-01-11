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
 * 締日期間を1つ計算する関数
 * @param closingDay 締日（nullの場合は月末締め）
 * @param year 対象年
 * @param month 対象月（0-11）
 */
function calculateSingleClosingPeriod(
  closingDay: number | null,
  year: number,
  month: number
): CalculatedPeriod {
  // 前月の情報
  const prevMonth = new Date(year, month, 0); // 前月の最終日
  const prevYear = prevMonth.getFullYear();
  const prevMonthIndex = prevMonth.getMonth(); // 0-11

  let startDate: Date;
  let endDate: Date;

  if (closingDay === null) {
    // 月末締めの場合
    // 開始日：当月の1日
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

  return {
    start_date: startDateStr,
    end_date: endDateStr,
    label: `${startLabel} ～ ${endLabel}`,
  };
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
  const selectedPeriod = (
    params.period === "next"
      ? "next"
      : params.period === "previous" || params.period === "last"
        ? "previous"
        : "current"
  ) as "previous" | "current" | "next";

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

  // 現在の日付が含まれる月を基準に計算
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-11

  // 今月の期間を計算
  let currentPeriod = calculateSingleClosingPeriod(
    closingDay,
    currentYear,
    currentMonth
  );

  // 今日が今月の期間に含まれているか確認
  // 含まれていない場合は、前月または翌月の期間を今月として使用
  const beforeCheck = todayStr < currentPeriod.start_date;
  const afterCheck = todayStr > currentPeriod.end_date;

  if (beforeCheck) {
    // 今日が期間より前の場合、前月の期間を使用
    const prevDate = new Date(currentYear, currentMonth - 1, 1);
    currentPeriod = calculateSingleClosingPeriod(
      closingDay,
      prevDate.getFullYear(),
      prevDate.getMonth()
    );
  } else if (afterCheck) {
    // 今日が期間より後の場合、翌月の期間を使用
    const nextDate = new Date(currentYear, currentMonth + 1, 1);
    currentPeriod = calculateSingleClosingPeriod(
      closingDay,
      nextDate.getFullYear(),
      nextDate.getMonth()
    );
  }

  // 現在の期間から先月・来月の期間を計算
  // currentPeriod.end_dateから年と月を抽出（例："2026-01-10" -> year=2026, month=0）
  // calculateSingleClosingPeriodは「その月を終了月とする期間」を計算するため、終了月を基準にする
  const [currentEndYear, currentEndMonth] = currentPeriod.end_date.split('-').map(Number);
  const currentPeriodEndMonth = currentEndMonth - 1; // 0-11に変換

  // 先月の期間を計算（現在の期間の終了月から1ヶ月前）
  let prevMonth = currentPeriodEndMonth - 1;
  let prevYear = currentEndYear;
  if (prevMonth < 0) {
    prevMonth = 11;
    prevYear -= 1;
  }
  const previousPeriod = calculateSingleClosingPeriod(
    closingDay,
    prevYear,
    prevMonth
  );

  // 来月の期間を計算（現在の期間の終了月から1ヶ月後）
  let nextMonth = currentPeriodEndMonth + 1;
  let nextYear = currentEndYear;
  if (nextMonth > 11) {
    nextMonth = 0;
    nextYear += 1;
  }
  const nextPeriod = calculateSingleClosingPeriod(
    closingDay,
    nextYear,
    nextMonth
  );

  // 取得する期間の範囲を決定（先月から来月までの全期間）
  const startDate = previousPeriod.start_date;
  const endDate = nextPeriod.end_date;

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
      menu_items: row.menu_item_id_from_menu
        ? {
            id: String(row.menu_item_id_from_menu),
            name: row.menu_item_name,
            vendors: row.vendor_id_from_vendor
              ? {
                  id: String(row.vendor_id_from_vendor),
                  name: row.vendor_name,
                }
              : null,
          }
        : null,
    }));

    // 注文日付のリストを取得
    const orderDates = orders
      .map((order: any) => order.order_date)
      .filter(Boolean);

    // カレンダー情報を取得（締切時間チェック用）
    let orderDays: Array<{ target_date: string; deadline_time: string | null }> =
      [];
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
    status: order.status || "ordered",
    ...order,
  }));

  return (
    <Suspense
      fallback={
        <div className="text-center py-12 text-gray-500">読み込み中...</div>
      }
    >
      <OrdersHistoryClient
        orders={ordersTyped}
        orderDays={
          orderDays as Array<{
            target_date: string;
            deadline_time: string | null;
          }>
        }
        previousPeriod={previousPeriod}
        currentPeriod={currentPeriod}
        nextPeriod={nextPeriod}
        selectedPeriod={selectedPeriod}
      />
    </Suspense>
  );
}
