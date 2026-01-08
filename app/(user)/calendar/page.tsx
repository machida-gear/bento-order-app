import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { queryDatabase } from "@/lib/database/query";
import { getDatabaseUrlOptional } from "@/lib/utils/database";
import CalendarGrid from "@/components/calendar-grid";

/**
 * カレンダーページ（月間カレンダービュー）
 * ユーザーがお弁当を注文するメイン画面
 */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; user_id?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Next.js 16ではsearchParamsがPromise型のため、awaitで解決
  const params = await searchParams;

  // DATABASE_URLが設定されているかチェック
  const hasDatabaseUrl = !!getDatabaseUrlOptional();

  // Transaction connectionを使用してデータを取得（パフォーマンス向上）
  // DATABASE_URLが設定されていない場合はSupabaseクライアントを使用
  const calendarData = hasDatabaseUrl ? await queryDatabase(async (client) => {
    // 現在のユーザーのプロフィールを取得（管理者権限チェック）
    const profileResult = await client.query(
      'SELECT role, full_name FROM profiles WHERE id = $1',
      [user.id]
    );
    const currentProfile = profileResult.rows[0] as { role?: string; full_name?: string } | undefined;
    const isAdmin = currentProfile?.role === "admin";

    // 管理者モードの判定
    const isAdminMode = isAdmin && params.user_id !== undefined;

    // 対象ユーザーIDを決定
    let targetUserId = user.id;
    let targetProfile: {
      id: string;
      full_name: string;
      is_active: boolean;
    } | null = null;

    if (isAdminMode && params.user_id) {
      // 管理者モードの場合、指定されたユーザーIDが存在するか確認
      const targetProfileResult = await client.query(
        'SELECT id, full_name, is_active FROM profiles WHERE id = $1',
        [params.user_id]
      );

      if (targetProfileResult.rows.length > 0) {
        const profileData = targetProfileResult.rows[0] as { id: string; full_name: string; is_active: boolean };
        targetUserId = params.user_id;
        targetProfile = profileData;
      }
    }

    return {
      isAdmin,
      isAdminMode,
      targetUserId,
      targetProfile,
    };
  }) : await (async () => {
    // DATABASE_URLが設定されていない場合のフォールバック処理
    const profileResult = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .single();
    
    const currentProfile = profileResult.data as { role?: string; full_name?: string } | null;
    const isAdmin = currentProfile?.role === "admin";
    const isAdminMode = isAdmin && params.user_id !== undefined;

    let targetUserId = user.id;
    let targetProfile: {
      id: string;
      full_name: string;
      is_active: boolean;
    } | null = null;

    if (isAdminMode && params.user_id) {
      const targetProfileResult = await supabase
        .from("profiles")
        .select("id, full_name, is_active")
        .eq("id", params.user_id)
        .single() as { data: { id: string; full_name: string; is_active: boolean } | null; error: any };

      if (targetProfileResult.data) {
        const profileData = targetProfileResult.data;
        targetUserId = params.user_id;
        targetProfile = profileData;
      }
    }

    return {
      isAdmin,
      isAdminMode,
      targetUserId,
      targetProfile,
    };
  })();

  const { isAdmin, isAdminMode, targetUserId, targetProfile } = calendarData;

  // URLパラメータから年月を取得（なければ現在の年月）
  // monthは1-12で統一（URLでも1-12、表示でも1-12）
  const now = new Date();
  const currentYear = params.year
    ? parseInt(params.year, 10)
    : now.getFullYear();

  // URLパラメータのmonthを取得（1-12の形式）
  // パラメータがない場合は現在の月（1-12）を使用
  let currentMonthDisplay: number;
  if (params.month) {
    const parsedMonth = parseInt(params.month, 10);
    // 1-12の範囲内に収める
    if (parsedMonth >= 1 && parsedMonth <= 12) {
      currentMonthDisplay = parsedMonth;
    } else {
      // 無効な値の場合は現在の月を使用
      currentMonthDisplay = now.getMonth() + 1;
    }
  } else {
    currentMonthDisplay = now.getMonth() + 1; // 1-12
  }

  // Dateオブジェクト用（0-11の形式）
  const currentMonth = currentMonthDisplay - 1;

  // 月の最初の日と最後の日を取得（今月のみ）
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

  // ローカルタイムゾーンで日付文字列を取得（YYYY-MM-DD形式）
  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const startDateStr = formatDateLocal(firstDayOfMonth);
  const endDateStr = formatDateLocal(lastDayOfMonth);

  // Transaction connectionを使用してデータを取得（パフォーマンス向上）
  // DATABASE_URLが設定されていない場合はSupabaseクライアントを使用
  const { orderDays, orders, systemSettings, calendarError, ordersError } = hasDatabaseUrl ? await queryDatabase(async (client): Promise<{
    orderDays: any[];
    orders: any[];
    systemSettings: any;
    calendarError: Error | null;
    ordersError: Error | null;
  }> => {
    // カレンダーデータを取得
    const calendarResult = await client.query(
      `SELECT * FROM order_calendar 
       WHERE target_date >= $1 AND target_date <= $2 
       ORDER BY target_date ASC`,
      [startDateStr, endDateStr]
    );
    const orderDays = calendarResult.rows;

    // 注文データを取得（RLSをバイパスするため、直接PostgreSQL接続を使用）
    const ordersResult = await client.query(
      `SELECT * FROM orders 
       WHERE user_id = $1 AND status = 'ordered' 
         AND order_date >= $2 AND order_date <= $3 
       ORDER BY order_date ASC`,
      [targetUserId, startDateStr, endDateStr]
    );
    const orders = ordersResult.rows;

    // システム設定を取得
    const settingsResult = await client.query(
      'SELECT max_order_days_ahead FROM system_settings WHERE id = 1'
    );
    const systemSettings = settingsResult.rows[0] || null;

    return {
      orderDays,
      orders,
      systemSettings,
      calendarError: null,
      ordersError: null,
    };
  }) : await (async () => {
    // DATABASE_URLが設定されていない場合のフォールバック処理
    try {
      // まず管理者モードの判定を行う（targetUserIdを決定するため）
      const profileResult = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .single();
      
      const currentProfile = profileResult.data as { role?: string; full_name?: string } | null;
      const isAdmin = currentProfile?.role === "admin";
      const isAdminMode = isAdmin && params.user_id !== undefined;

      let targetUserId = user.id;
      
      if (isAdminMode && params.user_id) {
        const targetProfileResult = await supabase
          .from("profiles")
          .select("id, full_name, is_active")
          .eq("id", params.user_id)
          .single() as { data: { id: string; full_name: string; is_active: boolean } | null; error: any };

        if (targetProfileResult.data) {
          targetUserId = params.user_id;
        }
      }

      // カレンダーデータを取得
      const calendarResult = await supabase
        .from("order_calendar")
        .select("*")
        .gte("target_date", startDateStr)
        .lte("target_date", endDateStr)
        .order("target_date", { ascending: true });
      
      const orderDays = calendarResult.data || [];

      // 注文データを取得（targetUserIdを使用）
      const ordersResult = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", targetUserId)
        .eq("status", "ordered")
        .gte("order_date", startDateStr)
        .lte("order_date", endDateStr)
        .order("order_date", { ascending: true });

      const orders = ordersResult.data || [];

      // システム設定を取得
      const settingsResult = await supabase
        .from("system_settings")
        .select("max_order_days_ahead")
        .eq("id", 1)
        .single();

      const systemSettings = settingsResult.data || null;

      return {
        orderDays,
        orders,
        systemSettings,
        calendarError: calendarResult.error ? new Error(calendarResult.error.message) : null,
        ordersError: ordersResult.error ? new Error(ordersResult.error.message) : null,
      };
    } catch (error) {
      return {
        orderDays: [],
        orders: [],
        systemSettings: null,
        calendarError: error instanceof Error ? error : new Error("Unknown error"),
        ordersError: error instanceof Error ? error : new Error("Unknown error"),
      };
    }
  })();

  // メニューデータを取得（注文がある場合のみ）
  // Transaction connectionを使用してメニューと業者情報を取得
  let ordersWithMenu: Array<any> = [];
  if (orders && orders.length > 0) {
    // menu_item_idを取得（bigint型）
    const menuItemIds = [
      ...new Set(
        orders
          .map((order: any) => {
            const menuItemId = order.menu_item_id || order.menu_id;
            if (!menuItemId) {
              return null;
            }
            return String(menuItemId);
          })
          .filter((id: string | null): id is string => id !== null && id !== undefined)
      ),
    ];

    if (menuItemIds.length > 0) {
      // Transaction connectionを使用してメニューと業者情報を取得
      // DATABASE_URLが設定されていない場合はSupabaseクライアントを使用
      const menuData = hasDatabaseUrl ? await queryDatabase(async (client) => {
        // メニュー情報を取得（JOINで業者情報も取得）
        const menuResult = await client.query(
          `SELECT 
            mi.id, 
            mi.name, 
            mi.vendor_id,
            v.id as vendor_id_from_vendors,
            v.name as vendor_name
           FROM menu_items mi
           LEFT JOIN vendors v ON mi.vendor_id = v.id
           WHERE mi.id = ANY($1::bigint[]) AND mi.is_active = true`,
          [menuItemIds.map(id => BigInt(id))]
        );

        return menuResult.rows.map((row: any) => ({
          id: String(row.id),
          name: row.name,
          vendor_id: String(row.vendor_id),
          vendors: row.vendor_id_from_vendors ? {
            id: String(row.vendor_id_from_vendors),
            name: row.vendor_name,
          } : null,
        }));
      }) : await (async () => {
        // DATABASE_URLが設定されていない場合のフォールバック処理
        // Supabaseクライアントでは文字列または数値の配列を使用
        const menuResult = await supabase
          .from("menu_items")
          .select(`
            id,
            name,
            vendor_id,
            vendors:vendor_id (
              id,
              name
            )
          `)
          .in("id", menuItemIds)
          .eq("is_active", true);

        return (menuResult.data || []).map((item: any) => ({
          id: String(item.id),
          name: item.name,
          vendor_id: String(item.vendor_id),
          vendors: item.vendors ? {
            id: String(item.vendors.id),
            name: item.vendors.name,
          } : null,
        }));
      })();

      // メニューIDを文字列に変換してマップを作成
      const menuItemsMap = new Map(
        menuData.map((item: any) => [String(item.id), item])
      );

      ordersWithMenu = orders.map((order: any) => {
        const rawMenuItemId = order.menu_item_id ?? order.menu_id;

        if (!rawMenuItemId) {
          return {
            ...order,
            menu_items: null,
          };
        }

        const menuItemId = String(rawMenuItemId);
        const menuItem = menuItemsMap.get(menuItemId);

        return {
          ...order,
          menu_items: menuItem || null,
        };
      });
    } else {
      // menu_item_idが取得できない場合でも、注文データは表示
      ordersWithMenu = orders.map((order: any) => ({
        ...order,
        menu_items: null,
      }));
    }
  }

  // 日付をキーとしたマップを作成（高速検索用）
  // Map型はサーバーコンポーネントからクライアントコンポーネントに渡せないため、通常のオブジェクトに変換
  const orderDaysMapObj: Record<string, any> = {};
  (orderDays || []).forEach((day: any) => {
    orderDaysMapObj[day.target_date] = day;
  });

  // 同じ日に複数の注文がある場合、最初の1つを使用（仕様上1日1注文のみ）
  const ordersMapObj: Record<string, (typeof ordersWithMenu)[0]> = {};

  // #region agent log
  try {
    await fetch('http://127.0.0.1:7242/ingest/31bb64a1-4cff-45b1-a971-f1576e521fb8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'calendar/page.tsx:391',message:'Before creating ordersMapObj',data:{ordersWithMenuCount:ordersWithMenu.length,orderDaysCount:orderDays?.length||0,orderDaysMapObjKeys:Object.keys(orderDaysMapObj).length,systemSettingsMaxDays:systemSettings?.max_order_days_ahead},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  } catch (e) {}
  // #endregion

  for (const order of ordersWithMenu) {
    // order_dateはdate型なので、YYYY-MM-DD形式の文字列として取得される
    // タイムゾーンや時刻部分が含まれている可能性があるため、日付部分のみを抽出
    const orderDate = order.order_date;
    let dateKey: string;

    if (typeof orderDate === "string") {
      // 文字列の場合、YYYY-MM-DD形式であることを確認
      // 時刻部分が含まれている場合は、日付部分のみを取得
      dateKey = orderDate.split("T")[0].split(" ")[0];
    } else if (orderDate instanceof Date) {
      // Dateオブジェクトの場合は、YYYY-MM-DD形式に変換
      dateKey = formatDateLocal(orderDate);
    } else {
      // その他の場合は文字列に変換してから処理
      dateKey = String(orderDate).split("T")[0].split(" ")[0];
    }

    // まだこの日付の注文がマップにない場合のみ追加
    if (!ordersMapObj[dateKey]) {
      ordersMapObj[dateKey] = order;
    }
  }

  // #region agent log
  try {
    const sampleDates = Object.keys(ordersMapObj).slice(0, 5);
    await fetch('http://127.0.0.1:7242/ingest/31bb64a1-4cff-45b1-a971-f1576e521fb8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'calendar/page.tsx:413',message:'After creating ordersMapObj',data:{ordersMapObjKeysCount:Object.keys(ordersMapObj).length,orderDaysMapObjKeysCount:Object.keys(orderDaysMapObj).length,sampleOrderDates:sampleDates,sampleOrderDaysDates:Object.keys(orderDaysMapObj).slice(0,5)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  } catch (e) {}
  // #endregion

  // 前月・次月の計算（1-12で統一）
  const prevMonthDisplay =
    currentMonthDisplay === 1 ? 12 : currentMonthDisplay - 1;
  const prevYear = currentMonthDisplay === 1 ? currentYear - 1 : currentYear;
  const nextMonthDisplay =
    currentMonthDisplay === 12 ? 1 : currentMonthDisplay + 1;
  const nextYear = currentMonthDisplay === 12 ? currentYear + 1 : currentYear;

  return (
    <div className="space-y-1 sm:space-y-2">
      {/* ヘッダー */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
            📅 注文カレンダー
          </h1>
        </div>
      </div>

      {/* 月ナビゲーション */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-2 sm:p-3 md:p-2">
        <a
          href={`/calendar?year=${prevYear}&month=${prevMonthDisplay}${
            isAdminMode ? `&user_id=${targetUserId}` : ""
          }`}
          className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg
            className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </a>
        <div className="text-base sm:text-lg font-semibold text-gray-800">
          {currentYear}年{currentMonthDisplay}月
        </div>
          <a
            href={`/calendar?year=${nextYear}&month=${nextMonthDisplay}${
              isAdminMode ? `&user_id=${targetUserId}` : ""
            }`}
          className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg
            className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>

      {/* エラーメッセージ */}
      {(calendarError || ordersError) && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <p className="font-medium">データの取得に失敗しました</p>
          <p className="text-xs mt-1">
            {(calendarError as Error | null)?.message || (ordersError as Error | null)?.message || 'エラーが発生しました'}
          </p>
        </div>
      )}

      {/* 管理者モードの表示 */}
      {isAdminMode && targetProfile && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          <p className="font-medium">
            管理者モード: {targetProfile.full_name || "ユーザー"}
            {targetUserId !== user.id ? "さんのカレンダーを表示中" : "（過去の日付にも注文可能）"}
          </p>
          {targetUserId !== user.id && (
            <a
              href={`/calendar?year=${currentYear}&month=${currentMonthDisplay}`}
              className="text-amber-600 hover:text-amber-700 underline mt-1 inline-block"
            >
              自分のカレンダーに戻る
            </a>
          )}
        </div>
      )}

      {/* カレンダーグリッド */}
      {/* #region agent log */}
      {(() => {
        try {
          fetch('http://127.0.0.1:7242/ingest/31bb64a1-4cff-45b1-a971-f1576e521fb8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'calendar/page.tsx:519',message:'Passing props to CalendarGrid',data:{year:currentYear,month:currentMonth,orderDaysMapKeysCount:Object.keys(orderDaysMapObj).length,ordersMapKeysCount:Object.keys(ordersMapObj).length,maxOrderDaysAhead:systemSettings?.max_order_days_ahead||30,isAdminMode,targetUserId:isAdminMode?targetUserId:undefined,orderDaysMapSample:Object.keys(orderDaysMapObj).slice(0,5),ordersMapSample:Object.keys(ordersMapObj).slice(0,5)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        } catch (e) {}
        return null;
      })()}
      {/* #endregion */}
      <CalendarGrid
        year={currentYear}
        month={currentMonth}
        orderDaysMap={orderDaysMapObj}
        ordersMap={ordersMapObj}
        maxOrderDaysAhead={systemSettings?.max_order_days_ahead || 30}
        targetUserId={isAdminMode ? targetUserId : undefined}
        isAdminMode={isAdminMode}
      />
    </div>
  );
}
