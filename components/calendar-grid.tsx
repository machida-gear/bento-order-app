"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Database } from "@/lib/database.types";

type OrderDay = Database["public"]["Tables"]["order_calendar"]["Row"];
type Order = Database["public"]["Tables"]["orders"]["Row"] & {
  menu_items?: {
    id: number;
    name: string;
    vendors?: {
      id: number;
      name: string;
    };
  } | null;
  menu_prices?: {
    price: number;
  } | null;
};

interface CalendarGridProps {
  year: number;
  month: number;
  orderDaysMap: Map<string, OrderDay> | Record<string, OrderDay>;
  ordersMap: Map<string, Order> | Record<string, Order>;
  maxOrderDaysAhead: number;
  targetUserId?: string; // 管理者が代理操作する場合の対象ユーザーID
  isAdminMode?: boolean; // 管理者モード（user_idパラメータが指定されている場合）
}

/**
 * 月間カレンダーグリッドコンポーネント
 */
export default function CalendarGrid({
  year,
  month,
  orderDaysMap,
  ordersMap,
  maxOrderDaysAhead,
  targetUserId,
  isAdminMode = false,
}: CalendarGridProps) {
  // クライアント側でのみ日付を計算（hydration mismatchを防ぐ）
  const [today, setToday] = useState<Date | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // クライアント側でのみ実行
    setIsMounted(true);
    const currentDate = new Date();
    setToday(currentDate);
    setNow(new Date());
  }, []);

  // デバッグ用: propsが正しく渡されているか確認（本番環境でも確認可能）
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const orderDaysMapKeys = orderDaysMap instanceof Map ? [] : Object.keys(orderDaysMap || {});
        const ordersMapKeys = ordersMap instanceof Map ? [] : Object.keys(ordersMap || {});
        console.log('[CalendarGrid] Props check:', {
          year,
          month,
          orderDaysMapType: typeof orderDaysMap,
          ordersMapType: typeof ordersMap,
          orderDaysMapIsMap: orderDaysMap instanceof Map,
          ordersMapIsMap: ordersMap instanceof Map,
          orderDaysMapKeysCount: orderDaysMapKeys.length,
          ordersMapKeysCount: ordersMapKeys.length,
          orderDaysMapSample: orderDaysMapKeys.slice(0, 3),
          ordersMapSample: ordersMapKeys.slice(0, 3),
        });
      } catch (error) {
        console.error('[CalendarGrid] Error in props check:', error);
      }
    }
  }, [year, month, orderDaysMap, ordersMap]);

  // サーバー側レンダリング時は空の状態を返す（hydration mismatchを防ぐ）
  if (!isMounted || !today || !now) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-2 sm:p-3 md:p-2">
        <div className="grid grid-cols-7 gap-1 mb-1 sm:mb-1 md:mb-1">
          {["日", "月", "火", "水", "木", "金", "土"].map((day) => (
            <div
              key={day}
              className="text-center text-xs sm:text-sm md:text-xs font-medium text-gray-600 py-1 sm:py-1.5 md:py-1"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 auto-rows-fr md:gap-1.5 md:calendar-grid-desktop">
          {Array.from({ length: 42 }).map((_, index) => (
            <div
              key={index}
              className="border border-transparent rounded-lg min-h-[90px] sm:min-h-[100px] md:min-h-[90px]"
            />
          ))}
        </div>
      </div>
    );
  }

  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDate = today.getDate();

  // ローカルタイムゾーンで日付文字列を取得（YYYY-MM-DD形式）
  const formatDateLocal = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  // その日が今日かどうか（ローカルタイムゾーンで比較）
  const isToday = (date: Date): boolean => {
    return (
      date.getFullYear() === todayYear &&
      date.getMonth() === todayMonth &&
      date.getDate() === todayDate
    );
  };

  // その日が今日より前かどうか
  const isPast = (date: Date): boolean => {
    const dateStr = formatDateLocal(date);
    const todayStr = formatDateLocal(today);
    return dateStr < todayStr;
  };

  // その日が今日から何日先かを計算
  const getDaysAhead = (date: Date): number => {
    const dateStr = formatDateLocal(date);
    const todayStr = formatDateLocal(today);
    if (dateStr <= todayStr) return 0;

    const dateObj = new Date(dateStr + "T00:00:00");
    const todayObj = new Date(todayStr + "T00:00:00");
    const diffTime = dateObj.getTime() - todayObj.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // その日が注文可能かどうか（締切時刻と日数制限を考慮）
  const canOrder = (date: Date, orderDay?: OrderDay | null): boolean => {
    // 管理者モードの場合は注文可能日チェックをスキップ（過去の日付も選択可能）
    if (isAdminMode) {
      return true;
    }

    if (!orderDay?.is_available) return false;

    // 過去の日付は注文不可
    if (isPast(date)) return false;

    // 最大注文可能日数を超えている場合は注文不可
    const daysAhead = getDaysAhead(date);
    if (daysAhead > maxOrderDaysAhead) return false;

    // 今日の場合、締切時刻をチェック
    if (isToday(date) && orderDay.deadline_time && now) {
      const [hours, minutes] = orderDay.deadline_time.split(":").map(Number);
      const deadline = new Date(today);
      deadline.setHours(hours, minutes, 0, 0);

      if (now >= deadline) return false;
    }

    return true;
  };

  // 月の最初の日と最後の日
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // 今月の日付のみを生成
  const calendarDays: (Date | null)[] = [];

  // 1日の曜日までの空セルを追加
  const firstDayOfWeek = firstDayOfMonth.getDay();
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarDays.push(null);
  }

  // 今月の日付を追加
  const daysInMonth = lastDayOfMonth.getDate();
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(new Date(year, month, i));
  }

  // 7の倍数になるように空セルを追加
  const remainingCells = 7 - (calendarDays.length % 7);
  if (remainingCells < 7) {
    for (let i = 0; i < remainingCells; i++) {
      calendarDays.push(null);
    }
  }

  // 曜日ヘッダー
  const weekDays = ["日", "月", "火", "水", "木", "金", "土"];

  // カレンダーの行数を計算
  const weekCount = Math.ceil(calendarDays.length / 7);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-2 sm:p-3 md:p-2">
      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 gap-1 mb-1 sm:mb-1 md:mb-1">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-xs sm:text-sm md:text-xs font-medium text-gray-600 py-1 sm:py-1.5 md:py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* カレンダーグリッド */}
      <div className="grid grid-cols-7 gap-1 auto-rows-fr md:gap-1.5 md:calendar-grid-desktop">
        {calendarDays.map((date, index) => {
          // 空セルの場合
          if (!date) {
            return (
              <div
                key={index}
                className="border border-transparent rounded-lg min-h-[90px] sm:min-h-[100px] md:min-h-[90px]"
              />
            );
          }

          const dateStr = formatDateLocal(date);
          // オブジェクト型の場合の安全なアクセス
          let orderDay: OrderDay | undefined;
          let order: Order | undefined;
          
          try {
            if (orderDaysMap instanceof Map) {
              orderDay = orderDaysMap.get(dateStr);
            } else if (orderDaysMap && typeof orderDaysMap === 'object' && !Array.isArray(orderDaysMap)) {
              orderDay = (orderDaysMap as Record<string, OrderDay>)[dateStr];
            }
          } catch (error) {
            console.error('Error accessing orderDaysMap:', error, { dateStr, orderDaysMapType: typeof orderDaysMap });
          }
          
          try {
            if (ordersMap instanceof Map) {
              order = ordersMap.get(dateStr);
            } else if (ordersMap && typeof ordersMap === 'object' && !Array.isArray(ordersMap)) {
              order = (ordersMap as Record<string, Order>)[dateStr];
            }
          } catch (error) {
            console.error('Error accessing ordersMap:', error, { dateStr, ordersMapType: typeof ordersMap });
          }
          const isAvailable = orderDay?.is_available ?? false;
          const isTodayDay = isToday(date);
          const canOrderToday = canOrder(date, orderDay);
          const isPastDate = isPast(date);
          const daysAhead = getDaysAhead(date);
          const exceedsMaxDays = daysAhead > maxOrderDaysAhead;

          // 過去の日付、または注文不可の日、または最大日数を超えている日はグレーにする（管理者モードの場合は過去の日付はグレーにしない）
          const shouldBeGray =
            !isAdminMode && (!isAvailable || isPastDate || !canOrderToday || exceedsMaxDays) ||
            (isAdminMode && !isAvailable);

          return (
            <div
              key={index}
              className={`
                border rounded-lg p-1.5 sm:p-2 md:p-2 transition-all relative
                flex flex-col min-h-[90px] sm:min-h-[100px] md:min-h-[90px]
                ${shouldBeGray ? "bg-gray-100 opacity-60" : "bg-white"}
                ${
                  isTodayDay
                    ? "ring-2 ring-amber-500 ring-offset-1 animate-pulse-border"
                    : "border-gray-200"
                }
                ${
                  canOrderToday && !isTodayDay
                    ? "hover:border-amber-300 hover:shadow-sm"
                    : ""
                }
              `}
            >
              <CalendarCell
                date={date}
                dateStr={dateStr}
                orderDay={orderDay}
                order={order}
                isToday={isTodayDay}
                canOrder={canOrderToday}
                exceedsMaxDays={exceedsMaxDays}
                targetUserId={targetUserId}
                isAdminMode={isAdminMode}
                today={today}
                now={now}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface CalendarCellProps {
  date: Date;
  dateStr: string;
  orderDay?: OrderDay | null;
  order?: Order | null;
  isToday: boolean;
  canOrder: boolean;
  exceedsMaxDays: boolean;
  targetUserId?: string;
  isAdminMode?: boolean;
  today: Date;
  now: Date;
}

function CalendarCell({
  date,
  dateStr,
  orderDay,
  order,
  isToday,
  canOrder,
  exceedsMaxDays,
  targetUserId,
  isAdminMode = false,
  today,
  now,
}: CalendarCellProps & { today: Date; now: Date }) {
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

  // 注文済みの場合、締切時刻前かどうかをチェック
  const canEditOrder = (): boolean => {
    if (!order || !orderDay) return false;

    // 管理者モードの場合は過去の日付も編集可能
    if (isAdminMode) {
      return true;
    }

    // 過去の日付は変更不可
    const orderDateObj = new Date(order.order_date + "T00:00:00");
    const todayDate = new Date(today);
    todayDate.setHours(0, 0, 0, 0);
    if (orderDateObj < todayDate) return false;

    // 今日の場合、締切時刻をチェック
    const isTodayDate = orderDateObj.getTime() === todayDate.getTime();
    if (isTodayDate && orderDay.deadline_time) {
      const [hours, minutes] = orderDay.deadline_time.split(":").map(Number);
      const deadline = new Date(todayDate);
      deadline.setHours(hours, minutes, 0, 0);

      if (now >= deadline) return false;
    }

    return true;
  };

  const canEdit = canEditOrder();

  return (
    <div className="h-full flex flex-col">
      {/* 日付 */}
      <div className="flex items-center justify-between mb-0.5 sm:mb-1 md:mb-0.5">
        <span
          className={`
            text-base sm:text-lg md:text-base font-medium
            ${isWeekend ? "text-red-600" : "text-gray-800"}
            ${isToday ? "font-bold" : ""}
          `}
        >
          {date.getDate()}
        </span>
        {/* 注文済みインジケーター */}
        {order && (
          <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-2 md:h-2 rounded-full bg-blue-500 shrink-0"></div>
        )}
      </div>

      {/* 注文内容（クリック可能な場合はリンク） */}
      {order && (
        <div className="flex-1 overflow-hidden mt-0.5 sm:mt-1 md:mt-0.5 min-h-0">
          {(() => {
            const orderAny = order as any;
            // メニュー情報を確実に取得
            const menuItems = orderAny.menu_items;
            const menuName = menuItems?.name || "注文済み";
            const quantity = order.quantity || 1;

            return canEdit ? (
              <Link
                href={`/orders/${order.id}/edit${
                  targetUserId ? `?user_id=${targetUserId}` : ""
                }`}
                className="block"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-xs sm:text-xs md:text-xs text-blue-700 font-medium truncate leading-tight hover:text-blue-800 hover:underline cursor-pointer">
                  {menuName}
                </div>
                <div className="text-xs sm:text-xs md:text-xs text-blue-600 mt-0.5">
                  数量: {quantity}
                </div>
                <div className="text-[10px] sm:text-[10px] md:text-[10px] text-blue-500 mt-0.5">
                  変更可
                </div>
              </Link>
            ) : (
              <div>
                <div className="text-xs sm:text-xs md:text-xs text-gray-700 font-medium truncate leading-tight">
                  {menuName}
                </div>
                <div className="text-xs sm:text-xs md:text-xs text-gray-500 mt-0.5">
                  数量: {quantity}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 注文可ボタン（注文がない場合のみ表示） */}
      {!order && (
        <div className="mt-auto pt-0.5 sm:pt-1 md:pt-0.5">
          {canOrder ? (
            <Link
              href={`/orders/new?date=${dateStr}${
                targetUserId ? `&user_id=${targetUserId}` : ""
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-xs sm:text-xs md:text-xs bg-green-500 text-white rounded px-1.5 sm:px-2 md:px-1.5 py-1 sm:py-1.5 md:py-1 text-center font-medium hover:bg-green-600 transition-colors">
                注文可
              </div>
            </Link>
          ) : exceedsMaxDays && orderDay?.is_available !== false ? (
            // 最大日数を超えているが、注文可能設定の場合はグレーアウト表示
            <div className="text-xs sm:text-xs md:text-xs bg-gray-400 text-white rounded px-1.5 sm:px-2 md:px-1.5 py-1 sm:py-1.5 md:py-1 text-center font-medium cursor-not-allowed opacity-60">
              注文可
            </div>
          ) : null}
        </div>
      )}

      {/* メモ（週末など） */}
      {orderDay?.note && !order && !canOrder && (
        <div className="text-[10px] sm:text-[10px] md:text-[10px] text-gray-400 mt-auto pt-0.5 sm:pt-1 md:pt-0.5 line-clamp-1">
          {orderDay.note}
        </div>
      )}
    </div>
  );
}
