"use client";

import { useState, useEffect, useRef } from "react";
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
  // 月変更時のちらつきを防ぐため、useRefとlocalStorageで値を保持
  const todayRef = useRef<Date | null>(null);
  const nowRef = useRef<Date | null>(null);
  
  // サーバー側とクライアント側で同じ初期値を返す（hydration mismatchを防ぐ）
  // localStorageからの復元はuseEffectで行う
  const [today, setToday] = useState<Date | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // クライアント側でのみ実行
    // localStorageから値を復元（月変更時のちらつき防止）
    try {
      const savedToday = localStorage.getItem('calendar_today');
      const savedNow = localStorage.getItem('calendar_now');
      if (savedToday && savedNow) {
        const savedTodayDate = new Date(savedToday);
        const savedNowDate = new Date(savedNow);
        // 保存された値が今日の日付であれば使用（1日以上古い値は使用しない）
        const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;
        const savedTodayStr = `${savedTodayDate.getFullYear()}-${String(savedTodayDate.getMonth() + 1).padStart(2, "0")}-${String(savedTodayDate.getDate()).padStart(2, "0")}`;
        if (savedTodayStr === todayStr) {
          setToday(savedTodayDate);
          setNow(savedNowDate);
          todayRef.current = savedTodayDate;
          nowRef.current = savedNowDate;
          // 次のフレームでisMountedをtrueにする（レイアウトの再計算を防ぐ）
          requestAnimationFrame(() => {
            setIsMounted(true);
          });
          return;
        }
      }
    } catch (e) {
      // localStorageが使用できない場合は無視
    }
    
    // localStorageに値がない場合、または古い値の場合は新規作成
    const currentDate = new Date();
    const currentNow = new Date();
    todayRef.current = currentDate;
    nowRef.current = currentNow;
    setToday(currentDate);
    setNow(currentNow);
    // 次のフレームでisMountedをtrueにする（レイアウトの再計算を防ぐ）
    requestAnimationFrame(() => {
      setIsMounted(true);
    });
    
    // localStorageに値を保存（月変更時のちらつき防止）
    try {
      localStorage.setItem('calendar_today', currentDate.toISOString());
      localStorage.setItem('calendar_now', currentNow.toISOString());
    } catch (e) {
      // localStorageが使用できない場合は無視
    }
  }, []);

  // 年月が変更されたときに、localStorageから値を復元（ちらつき防止）
  // ただし、既にisMountedがtrueの場合は、値を保持する（再マウントされていない場合）
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 既にisMountedがtrueで、todayとnowが設定されている場合は、値を保持（再マウントされていない）
      if (isMounted && today && now) {
        return;
      }
      
      // isMountedがfalseの場合、またはtoday/nowがnullの場合は、localStorageから値を復元
      try {
        const savedToday = localStorage.getItem('calendar_today');
        const savedNow = localStorage.getItem('calendar_now');
        if (savedToday && savedNow) {
          const savedTodayDate = new Date(savedToday);
          const savedNowDate = new Date(savedNow);
          // 保存された値が今日の日付であれば使用（1日以上古い値は使用しない）
          const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;
          const savedTodayStr = `${savedTodayDate.getFullYear()}-${String(savedTodayDate.getMonth() + 1).padStart(2, "0")}-${String(savedTodayDate.getDate()).padStart(2, "0")}`;
          if (savedTodayStr === todayStr) {
            setToday(savedTodayDate);
            setNow(savedNowDate);
            todayRef.current = savedTodayDate;
            nowRef.current = savedNowDate;
            // 次のフレームでisMountedをtrueにする（レイアウトの再計算を防ぐ）
            requestAnimationFrame(() => {
              setIsMounted(true);
            });
            return;
          }
        }
      } catch (e) {
        // localStorageが使用できない場合は無視
      }
      
      // localStorageに値がない場合は新規作成
      const currentDate = new Date();
      const currentNow = new Date();
      todayRef.current = currentDate;
      nowRef.current = currentNow;
      setToday(currentDate);
      setNow(currentNow);
      // 次のフレームでisMountedをtrueにする（レイアウトの再計算を防ぐ）
      requestAnimationFrame(() => {
        setIsMounted(true);
      });
      
      // localStorageに値を保存
      try {
        localStorage.setItem('calendar_today', currentDate.toISOString());
        localStorage.setItem('calendar_now', currentNow.toISOString());
      } catch (e) {
        // localStorageが使用できない場合は無視
      }
    }
  }, [year, month, isMounted, today, now]);

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

  // サーバー側レンダリング時のみ空の状態を返す（hydration mismatchを防ぐ）
  // クライアント側では、isMountedがtrueの場合、年月が変わっても空のカレンダーを表示しない（ちらつき防止）
  // サーバー側（typeof window === 'undefined'）の場合のみ空のカレンダーを表示
  if (typeof window === 'undefined') {
    // サーバー側でのみ空のカレンダーを表示
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
              className="border border-transparent rounded-lg p-1.5 sm:p-2 md:p-2 min-h-[90px] sm:min-h-[100px] md:min-h-[90px]"
            />
          ))}
        </div>
      </div>
    );
  }

  // クライアント側で初回マウント前の場合のみ空のカレンダーを表示
  // 年月が変わっても、isMountedがtrueでtodayとnowが設定されていれば、空のカレンダーを表示しない（ちらつき防止）
  // useRefの値もチェック（localStorageから復元された値がある場合）
  const effectiveToday = today || todayRef.current;
  const effectiveNow = now || nowRef.current;
  
  if (!isMounted || !effectiveToday || !effectiveNow) {
    // 初回マウント前のみ空のカレンダーを表示
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
              className="border border-transparent rounded-lg p-1.5 sm:p-2 md:p-2 min-h-[90px] sm:min-h-[100px] md:min-h-[90px]"
            />
          ))}
        </div>
      </div>
    );
  }

  // クライアント側で初回マウント前の場合のみ空のカレンダーを表示
  if (!isMounted || !today || !now) {
    // 初回マウント前のみ空のカレンダーを表示
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
              className="border border-transparent rounded-lg p-1.5 sm:p-2 md:p-2 min-h-[90px] sm:min-h-[100px] md:min-h-[90px]"
            />
          ))}
        </div>
      </div>
    );
  }

  // effectiveTodayとeffectiveNowを使用（useRefから復元された値も考慮）
  // レンダリング条件でnullチェック済みのため、ここでは非nullアサーションを使用
  const todayYear = effectiveToday!.getFullYear();
  const todayMonth = effectiveToday!.getMonth();
  const todayDate = effectiveToday!.getDate();
  

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
    const dateStr = formatDateLocal(date);
    // 管理者モードの場合は注文可能日チェックをスキップ（過去の日付も選択可能）
    if (isAdminMode) {
      return true;
    }

    if (!orderDay?.is_available) {
      return false;
    }

    // 過去の日付は注文不可
    if (isPast(date)) {
      return false;
    }

    // 最大注文可能日数を超えている場合は注文不可
    const daysAhead = getDaysAhead(date);
    if (daysAhead > maxOrderDaysAhead) {
      return false;
    }

    // 今日の場合、締切時刻をチェック
    if (isToday(date) && orderDay.deadline_time && now) {
      const [hours, minutes] = orderDay.deadline_time.split(":").map(Number);
      const deadline = new Date(today);
      deadline.setHours(hours, minutes, 0, 0);

      if (effectiveNow! >= deadline) {
        return false;
      }
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
                className="border border-transparent rounded-lg p-1.5 sm:p-2 md:p-2 min-h-[90px] sm:min-h-[100px] md:min-h-[90px]"
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

          // 注文がある場合、編集可能かどうかをチェック
          let canEditOrderValue = false;
          if (order && orderDay) {
            // 管理者モードの場合は過去の日付も編集可能
            if (isAdminMode) {
              canEditOrderValue = true;
            } else {
              // 過去の日付は変更不可
              // order.order_dateがDateオブジェクトの場合、YYYY-MM-DD形式に変換
              // 型定義ではstringだが、実行時にはDateオブジェクトの可能性があるため、型アサーションを使用
              let orderDateStr: string;
              const orderDateValue = order.order_date as string | Date;
              if (orderDateValue instanceof Date) {
                // Dateオブジェクトの場合、YYYY-MM-DD形式に変換
                orderDateStr = `${orderDateValue.getFullYear()}-${String(orderDateValue.getMonth() + 1).padStart(2, "0")}-${String(orderDateValue.getDate()).padStart(2, "0")}`;
              } else if (typeof orderDateValue === 'string') {
                // 文字列の場合、YYYY-MM-DD形式を抽出
                orderDateStr = orderDateValue.split('T')[0].split(' ')[0];
              } else {
                // その他の場合、一度Dateオブジェクトに変換してからYYYY-MM-DD形式に変換
                const orderDate = new Date(orderDateValue);
                orderDateStr = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, "0")}-${String(orderDate.getDate()).padStart(2, "0")}`;
              }
              
              const todayStr = `${effectiveToday!.getFullYear()}-${String(effectiveToday!.getMonth() + 1).padStart(2, "0")}-${String(effectiveToday!.getDate()).padStart(2, "0")}`;
              
              // 過去の日付は変更不可（文字列比較でタイムゾーンの影響を排除）
              if (orderDateStr < todayStr) {
                canEditOrderValue = false;
              } else {
                // 今日の場合、締切時刻をチェック
                const isTodayDate = orderDateStr === todayStr;
                if (isTodayDate && orderDay.deadline_time) {
                  const [hours, minutes] = orderDay.deadline_time.split(":").map(Number);
                  const deadline = new Date(effectiveToday!);
                  deadline.setHours(hours, minutes, 0, 0);
                  canEditOrderValue = effectiveNow!.getTime() < deadline.getTime();
                } else {
                  canEditOrderValue = true;
                }
              }
            }
          }

          // 過去の日付、または注文不可の日、または最大日数を超えている日はグレーにする
          // 注文がある場合、編集不可能な場合はグレーにする（管理者モードの場合は過去の日付はグレーにしない）
          const shouldBeGray =
            !isAdminMode && (
              !isAvailable || 
              isPastDate || 
              !canOrderToday || 
              exceedsMaxDays ||
              (order && !canEditOrderValue) // 過去の注文で編集不可能な場合はグレー
            ) ||
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
                today={effectiveToday!}
                now={effectiveNow!}
                canEditOrderValue={canEditOrderValue}
                shouldBeGray={shouldBeGray}
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
  canEditOrderValue: boolean;
  shouldBeGray: boolean;
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
  canEditOrderValue,
  shouldBeGray,
}: CalendarCellProps) {
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

  // 注文済みの場合、締切時刻前かどうかをチェック
  // CalendarGridで計算したcanEditOrderValueを使用（重複計算を避ける）
  // shouldBeGrayがtrueの場合は、canEditOrderValueをfalseに上書き（グレーアウトされている場合編集不可）
  const canEdit = shouldBeGray ? false : canEditOrderValue;

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
                onClick={(e) => {
                  e.stopPropagation();
                  // shouldBeGrayがtrueの場合、またはcanEditOrderValueがfalseの場合はクリックを防ぐ
                  if (shouldBeGray || !canEditOrderValue) {
                    e.preventDefault();
                    alert('締切時刻を過ぎているため、注文を変更できません');
                  }
                }}
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
