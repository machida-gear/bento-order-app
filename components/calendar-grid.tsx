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
    // #region agent log
    const logStart = {location:'calendar-grid.tsx:49',message:'useEffect started',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};
    console.log('[DEBUG]', logStart);
    fetch('http://127.0.0.1:7242/ingest/31bb64a1-4cff-45b1-a971-f1576e521fb8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logStart)}).catch(()=>{});
    // #endregion
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
          setIsMounted(true);
          // #region agent log
          const logRestored = {location:'calendar-grid.tsx:58',message:'useEffect: restored from localStorage',data:{isMounted:true,today:savedTodayDate.toISOString(),now:savedNowDate.toISOString()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};
          console.log('[DEBUG]', logRestored);
          fetch('http://127.0.0.1:7242/ingest/31bb64a1-4cff-45b1-a971-f1576e521fb8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logRestored)}).catch(()=>{});
          // #endregion
          return;
        }
      }
    } catch (e) {
      // localStorageが使用できない場合は無視
    }
    
    // localStorageに値がない場合、または古い値の場合は新規作成
    setIsMounted(true);
    const currentDate = new Date();
    const currentNow = new Date();
    todayRef.current = currentDate;
    nowRef.current = currentNow;
    setToday(currentDate);
    setNow(currentNow);
    
    // localStorageに値を保存（月変更時のちらつき防止）
    try {
      localStorage.setItem('calendar_today', currentDate.toISOString());
      localStorage.setItem('calendar_now', currentNow.toISOString());
    } catch (e) {
      // localStorageが使用できない場合は無視
    }
    
    // #region agent log
    const logComplete = {location:'calendar-grid.tsx:76',message:'useEffect completed',data:{isMounted:true,today:currentDate.toISOString(),now:currentNow.toISOString()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};
    console.log('[DEBUG]', logComplete);
    fetch('http://127.0.0.1:7242/ingest/31bb64a1-4cff-45b1-a971-f1576e521fb8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logComplete)}).catch(()=>{});
    // #endregion
  }, []);

  // 年月が変更されたときに、localStorageから値を復元（ちらつき防止）
  useEffect(() => {
    if (!isMounted && typeof window !== 'undefined') {
      // localStorageから値を復元
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
            setIsMounted(true);
            // #region agent log
            const logRestored = {location:'calendar-grid.tsx:82',message:'useEffect: restored from localStorage (year/month changed)',data:{year,month,isMounted:true,today:savedTodayDate.toISOString(),now:savedNowDate.toISOString()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'};
            console.log('[DEBUG]', logRestored);
            fetch('http://127.0.0.1:7242/ingest/31bb64a1-4cff-45b1-a971-f1576e521fb8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logRestored)}).catch(()=>{});
            // #endregion
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
      setIsMounted(true);
      
      // localStorageに値を保存
      try {
        localStorage.setItem('calendar_today', currentDate.toISOString());
        localStorage.setItem('calendar_now', currentNow.toISOString());
      } catch (e) {
        // localStorageが使用できない場合は無視
      }
    }
  }, [year, month]);

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

  // #region agent log
  if (typeof window !== 'undefined') {
    const logData = {location:'calendar-grid.tsx:82',message:'Mounted state check',data:{isMounted,hasToday:!!today,hasNow:!!now,todayValue:today?.toISOString(),nowValue:now?.toISOString(),year,month},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
    console.log('[DEBUG]', logData);
    fetch('http://127.0.0.1:7242/ingest/31bb64a1-4cff-45b1-a971-f1576e521fb8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
  }
  // #endregion
  // サーバー側レンダリング時のみ空の状態を返す（hydration mismatchを防ぐ）
  // クライアント側では、isMountedがtrueの場合、年月が変わっても空のカレンダーを表示しない（ちらつき防止）
  // サーバー側（typeof window === 'undefined'）の場合のみ空のカレンダーを表示
  if (typeof window === 'undefined') {
    // #region agent log
    // サーバー側ではログを送信しない（fetchが利用できない）
    // #endregion
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
              className="border border-transparent rounded-lg min-h-[90px] sm:min-h-[100px] md:min-h-[90px]"
            />
          ))}
        </div>
      </div>
    );
  }

  // クライアント側で初回マウント前の場合のみ空のカレンダーを表示
  // 年月が変わっても、isMountedがtrueでtodayとnowが設定されていれば、空のカレンダーを表示しない（ちらつき防止）
  if (!isMounted || !today || !now) {
    // #region agent log
    if (typeof window !== 'undefined') {
      const logData = {location:'calendar-grid.tsx:131',message:'Returning empty calendar (client not mounted)',data:{isMounted,hasToday:!!today,hasNow:!!now,year,month},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
      console.log('[DEBUG]', logData);
      fetch('http://127.0.0.1:7242/ingest/31bb64a1-4cff-45b1-a971-f1576e521fb8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
    }
    // #endregion
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
              className="border border-transparent rounded-lg min-h-[90px] sm:min-h-[100px] md:min-h-[90px]"
            />
          ))}
        </div>
      </div>
    );
  }

  // クライアント側で初回マウント前の場合のみ空のカレンダーを表示
  if (!isMounted || !today || !now) {
    // #region agent log
    if (typeof window !== 'undefined') {
      const logData = {location:'calendar-grid.tsx:131',message:'Returning empty calendar (client not mounted)',data:{isMounted,hasToday:!!today,hasNow:!!now,year,month},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
      console.log('[DEBUG]', logData);
      fetch('http://127.0.0.1:7242/ingest/31bb64a1-4cff-45b1-a971-f1576e521fb8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
    }
    // #endregion
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
              className="border border-transparent rounded-lg min-h-[90px] sm:min-h-[100px] md:min-h-[90px]"
            />
          ))}
        </div>
      </div>
    );
  }

  // #region agent log
  if (typeof window !== 'undefined') {
    const orderDaysMapKeys = orderDaysMap instanceof Map ? [] : Object.keys(orderDaysMap || {});
    const logData = {location:'calendar-grid.tsx:107',message:'Calendar rendered (mounted)',data:{year,month,todayYear:today.getFullYear(),todayMonth:today.getMonth(),todayDate:today.getDate(),orderDaysMapKeysCount:orderDaysMapKeys.length,orderDaysMapSample:orderDaysMapKeys.slice(0,5),maxOrderDaysAhead,isAdminMode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'};
    console.log('[DEBUG]', logData);
    fetch('http://127.0.0.1:7242/ingest/31bb64a1-4cff-45b1-a971-f1576e521fb8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
  }
  // #endregion
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
    const dateStr = formatDateLocal(date);
    // 管理者モードの場合は注文可能日チェックをスキップ（過去の日付も選択可能）
    if (isAdminMode) {
      // #region agent log
      if (typeof window !== 'undefined' && (dateStr === '2026-01-17' || dateStr === '2026-01-18' || dateStr === '2026-01-16')) {
        const logData = {location:'calendar-grid.tsx:151',message:'canOrder: admin mode, returning true',data:{dateStr,isAdminMode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'};
        console.log('[DEBUG]', logData);
        fetch('http://127.0.0.1:7242/ingest/31bb64a1-4cff-45b1-a971-f1576e521fb8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
      }
      // #endregion
      return true;
    }

    if (!orderDay?.is_available) {
      // #region agent log
      if (typeof window !== 'undefined' && (dateStr === '2026-01-17' || dateStr === '2026-01-18' || dateStr === '2026-01-16')) {
        const logData = {location:'calendar-grid.tsx:157',message:'canOrder: orderDay not available',data:{dateStr,hasOrderDay:!!orderDay,isAvailable:orderDay?.is_available},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'};
        console.log('[DEBUG]', logData);
        fetch('http://127.0.0.1:7242/ingest/31bb64a1-4cff-45b1-a971-f1576e521fb8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
      }
      // #endregion
      return false;
    }

    // 過去の日付は注文不可
    if (isPast(date)) {
      // #region agent log
      if (typeof window !== 'undefined' && (dateStr === '2026-01-17' || dateStr === '2026-01-18' || dateStr === '2026-01-16')) {
        const logData = {location:'calendar-grid.tsx:161',message:'canOrder: date is past',data:{dateStr,isPastDate:isPast(date)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'};
        console.log('[DEBUG]', logData);
        fetch('http://127.0.0.1:7242/ingest/31bb64a1-4cff-45b1-a971-f1576e521fb8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
      }
      // #endregion
      return false;
    }

    // 最大注文可能日数を超えている場合は注文不可
    const daysAhead = getDaysAhead(date);
    if (daysAhead > maxOrderDaysAhead) {
      // #region agent log
      if (typeof window !== 'undefined' && (dateStr === '2026-01-17' || dateStr === '2026-01-18' || dateStr === '2026-01-16')) {
        const logData = {location:'calendar-grid.tsx:165',message:'canOrder: exceeds max days',data:{dateStr,daysAhead,maxOrderDaysAhead},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'};
        console.log('[DEBUG]', logData);
        fetch('http://127.0.0.1:7242/ingest/31bb64a1-4cff-45b1-a971-f1576e521fb8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
      }
      // #endregion
      return false;
    }

    // 今日の場合、締切時刻をチェック
    if (isToday(date) && orderDay.deadline_time && now) {
      const [hours, minutes] = orderDay.deadline_time.split(":").map(Number);
      const deadline = new Date(today);
      deadline.setHours(hours, minutes, 0, 0);

      if (now >= deadline) {
        // #region agent log
        if (typeof window !== 'undefined') {
          const logData = {location:'calendar-grid.tsx:174',message:'canOrder: deadline passed',data:{dateStr,now:now.toISOString(),deadline:deadline.toISOString()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'};
          console.log('[DEBUG]', logData);
          fetch('http://127.0.0.1:7242/ingest/31bb64a1-4cff-45b1-a971-f1576e521fb8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
        }
        // #endregion
        return false;
      }
    }

    // #region agent log
    if (typeof window !== 'undefined' && (dateStr === '2026-01-17' || dateStr === '2026-01-18' || dateStr === '2026-01-16')) {
      const logData = {location:'calendar-grid.tsx:181',message:'canOrder: returning true',data:{dateStr,isAvailable:orderDay?.is_available,daysAhead,maxOrderDaysAhead},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'};
      console.log('[DEBUG]', logData);
      fetch('http://127.0.0.1:7242/ingest/31bb64a1-4cff-45b1-a971-f1576e521fb8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
    }
    // #endregion
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
          
          // #region agent log
          // 12日、13日、14日のdateStrを確認（formatDateLocalの結果を検証）
          if (typeof window !== 'undefined' && (
            date.getDate() === 12 || date.getDate() === 13 || date.getDate() === 14
          ) && date.getMonth() === 0 && date.getFullYear() === 2026) {
            const logData = {
              location:'calendar-grid.tsx:518',
              message:'Date cell rendering check',
              data:{
                dateStr,
                dateYear:date.getFullYear(),
                dateMonth:date.getMonth(),
                dateDate:date.getDate(),
                dateISO:date.toISOString()
              },
              timestamp:Date.now(),
              sessionId:'debug-session',
              runId:'run1',
              hypothesisId:'I'
            };
            console.log('[DEBUG]', logData);
            fetch('http://127.0.0.1:7242/ingest/31bb64a1-4cff-45b1-a971-f1576e521fb8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
          }
          // #endregion
          
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
              let orderDateStr: string;
              if (order.order_date instanceof Date) {
                // Dateオブジェクトの場合、YYYY-MM-DD形式に変換
                orderDateStr = `${order.order_date.getFullYear()}-${String(order.order_date.getMonth() + 1).padStart(2, "0")}-${String(order.order_date.getDate()).padStart(2, "0")}`;
              } else if (typeof order.order_date === 'string') {
                // 文字列の場合、YYYY-MM-DD形式を抽出
                orderDateStr = order.order_date.split('T')[0].split(' ')[0];
              } else {
                // その他の場合、一度Dateオブジェクトに変換してからYYYY-MM-DD形式に変換
                const orderDate = new Date(order.order_date);
                orderDateStr = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, "0")}-${String(orderDate.getDate()).padStart(2, "0")}`;
              }
              
              const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
              
              // #region agent log
              if (typeof window !== 'undefined' && (dateStr === '2026-01-12' || dateStr === '2026-01-13' || dateStr === '2026-01-14')) {
                const logData = {location:'calendar-grid.tsx:551',message:'orderDateStr calculation',data:{dateStr,orderId:order.id,orderDateType:typeof order.order_date,orderDateIsDate:order.order_date instanceof Date,orderDateOriginal:order.order_date instanceof Date ? order.order_date.toISOString() : String(order.order_date),orderDateStr,todayStr,orderDateStrLessThanToday:orderDateStr < todayStr},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'J'};
                console.log('[DEBUG]', logData);
                fetch('http://127.0.0.1:7242/ingest/31bb64a1-4cff-45b1-a971-f1576e521fb8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
              }
              // #endregion
              
              // 過去の日付は変更不可（文字列比較でタイムゾーンの影響を排除）
              if (orderDateStr < todayStr) {
                canEditOrderValue = false;
              } else {
                // 今日の場合、締切時刻をチェック
                const isTodayDate = orderDateStr === todayStr;
                if (isTodayDate && orderDay.deadline_time) {
                  const [hours, minutes] = orderDay.deadline_time.split(":").map(Number);
                  const deadline = new Date(today);
                  deadline.setHours(hours, minutes, 0, 0);
                  canEditOrderValue = now.getTime() < deadline.getTime();
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

          // #region agent log
          // 過去日付と将来日付の両方で、特定の日付のshouldBeGrayとcanEditOrderValueを検証
          // orderの有無に関わらずログを出力（12日、13日、14日の問題を調査するため）
          if (typeof window !== 'undefined' && (
            dateStr === '2026-01-04' || dateStr === '2026-01-05' || dateStr === '2026-01-06' || dateStr === '2026-01-09' ||
            dateStr === '2026-01-12' || dateStr === '2026-01-13' || dateStr === '2026-01-14'
          )) {
            const logData = {
              location:'calendar-grid.tsx:426',
              message:'shouldBeGray calculation (orders)',
              data:{
                dateStr,
                orderId:order?.id || null,
                hasOrder:!!order,
                hasOrderDay:!!orderDay,
                isAvailable,
                isPastDate,
                canOrderToday,
                exceedsMaxDays,
                canEditOrderValue,
                shouldBeGray,
                isAdminMode,
                orderDate:order?.order_date || null,
                orderDayAvailable:orderDay?.is_available ?? null,
                orderDayDeadlineTime:orderDay?.deadline_time || null
              },
              timestamp:Date.now(),
              sessionId:'debug-session',
              runId:'run1',
              hypothesisId:'G'
            };
            console.log('[DEBUG]', logData);
            fetch('http://127.0.0.1:7242/ingest/31bb64a1-4cff-45b1-a971-f1576e521fb8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
          }
          // #endregion

          // #region agent log
          if (typeof window !== 'undefined' && (dateStr === '2026-01-17' || dateStr === '2026-01-18' || dateStr === '2026-01-16')) {
            const logData = {location:'calendar-grid.tsx:234',message:'Date evaluation (sample dates)',data:{dateStr,isAvailable,isTodayDay,canOrderToday,isPastDate,daysAhead,exceedsMaxDays,shouldBeGray,isAdminMode,hasOrderDay:!!orderDay,hasOrder:!!order,maxOrderDaysAhead},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'};
            console.log('[DEBUG]', logData);
            fetch('http://127.0.0.1:7242/ingest/31bb64a1-4cff-45b1-a971-f1576e521fb8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
          }
          // #endregion

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
                    // #region agent log
                    if (typeof window !== 'undefined') {
                      const logData = {location:'calendar-grid.tsx:726',message:'Link click prevented',data:{orderId:order.id,canEdit,shouldBeGray,canEditOrderValue},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'};
                      console.log('[DEBUG]', logData);
                      fetch('http://127.0.0.1:7242/ingest/31bb64a1-4cff-45b1-a971-f1576e521fb8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
                    }
                    // #endregion
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
