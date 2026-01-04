import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
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

  // 管理者権限をチェック（Service Role Keyを使用してRLSをバイパス）
  const { data: currentProfile } = await supabaseAdmin
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  const isAdmin = (currentProfile as { role?: string } | null)?.role === "admin";

  // 対象ユーザーIDを決定（管理者がuser_idパラメータを指定した場合はそれを使用、それ以外は現在のユーザーID）
  let targetUserId = user.id;
  let targetProfile: {
    id: string;
    full_name: string;
    is_active: boolean;
  } | null = null;

  if (isAdmin && params.user_id) {
    // 管理者が指定したユーザーIDが存在するか確認（Service Role Keyを使用）
    const { data: profileData } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, is_active")
      .eq("id", params.user_id)
      .single();

    if (profileData) {
      targetUserId = params.user_id;
      targetProfile = profileData as { id: string; full_name: string; is_active: boolean };
    }
  }

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

  // カレンダーデータを取得
  const { data: orderDays, error: calendarError } = await supabase
    .from("order_calendar")
    .select("*")
    .gte("target_date", startDateStr)
    .lte("target_date", endDateStr)
    .order("target_date", { ascending: true });

  // 注文データを取得（menu_item_idを使用）
  // 注意: 型定義ではmenu_idだが、実際のDBではmenu_item_id（bigint型）
  // 管理者の場合は対象ユーザーIDで取得、一般ユーザーの場合は自分のIDで取得
  // 管理者が他のユーザーの注文を取得する場合はService Role Keyを使用してRLSをバイパス
  const ordersQuery =
    isAdmin && targetUserId !== user.id ? supabaseAdmin : supabase;

  const { data: orders, error: ordersError } = await ordersQuery
    .from("orders")
    .select("*")
    .eq("user_id", targetUserId)
    .eq("status", "ordered")
    .gte("order_date", startDateStr)
    .lte("order_date", endDateStr)
    .order("order_date", { ascending: true });

  // システム設定を取得（max_order_days_ahead）
  const { data: systemSettings } = await supabase
    .from("system_settings")
    .select("max_order_days_ahead")
    .eq("id", 1)
    .single();

  // エラー処理（エラーはUIで表示されるため、コンソールログは不要）

  // メニューデータを取得（注文がある場合のみ）
  // 注文データが存在する場合は、メニューデータが取得できなくても注文を表示する
  let ordersWithMenu: Array<any> = [];
  if (orders && orders.length > 0) {
    // 型定義と実際のDB構造が異なるため、any型を使用
    const ordersArray = orders as any[];

    // menu_item_idを取得（bigint型は文字列として返される可能性がある）
    const menuItemIds = [
      ...new Set(
        ordersArray
          .map((order) => {
            // 実際のDBカラム名はmenu_item_id（型定義のmenu_idではない）
            const menuItemId = order.menu_item_id || order.menu_id;
            if (!menuItemId) {
              return null;
            }
            // bigint型は文字列として返される可能性があるため、文字列として扱う
            return String(menuItemId);
          })
          .filter((id): id is string => id !== null && id !== undefined)
      ),
    ];

    if (menuItemIds.length > 0) {
      // bigint型のIDを文字列から数値に変換してクエリ
      const menuItemIdsAsNumbers = menuItemIds
        .map((id) => {
          const num = Number(id);
          if (isNaN(num)) {
            return null;
          }
          return num;
        })
        .filter((id): id is number => id !== null);

      const { data: menuItems, error: menuItemsError } = await supabase
        .from("menu_items")
        .select(
          `
          id,
          name,
          vendor_id,
          vendors (
            id,
            name
          )
        `
        )
        .in("id", menuItemIdsAsNumbers)
        .eq("is_active", true); // アクティブなメニューのみ取得

      // 注文データにメニュー情報を結合
      if (menuItems && menuItems.length > 0) {
        // メニューIDを文字列に変換してマップを作成（bigint型の比較を確実にするため）
        const menuItemsMap = new Map(
          (menuItems as Array<{ id: string | number; name: string; vendor_id: string }>).map((item) => [String(item.id), item])
        );

        ordersWithMenu = ordersArray.map((order) => {
          // 実際のDBカラム名はmenu_item_id（bigint型）
          // Supabaseから返される値は数値または文字列の可能性がある
          const rawMenuItemId = order.menu_item_id ?? order.menu_id;

          if (!rawMenuItemId) {
            return {
              ...order,
              menu_items: null,
            };
          }

          // bigint型を文字列に変換してマップから取得
          const menuItemId = String(rawMenuItemId);
          const menuItem = menuItemsMap.get(menuItemId);

          return {
            ...order,
            menu_items: menuItem || null,
          };
        });
      } else {
        // メニューデータが取得できない場合でも、注文データは表示
        ordersWithMenu = ordersArray.map((order) => ({
          ...order,
          menu_items: null,
        }));
      }
    } else {
      // menu_item_idが取得できない場合でも、注文データは表示
      ordersWithMenu = ordersArray.map((order) => ({
        ...order,
        menu_items: null,
      }));
    }
  }

  // 注文データが存在するが、ordersWithMenuが空の場合の確認
  if (orders && orders.length > 0 && ordersWithMenu.length === 0) {
    // フォールバック: メニューデータなしで注文データを作成
    ordersWithMenu = (orders as any[]).map((order) => ({
      ...order,
      menu_items: null,
    }));
  }

  // 日付をキーとしたマップを作成（高速検索用）
  const orderDaysMap = new Map(
    ((orderDays || []) as Array<{ target_date: string; is_available: boolean; deadline_time: string | null; note: string | null }>).map((day) => [day.target_date, day])
  );

  // 同じ日に複数の注文がある場合、最初の1つを使用（仕様上1日1注文のみ）
  const ordersMap = new Map<string, (typeof ordersWithMenu)[0]>();

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
    if (!ordersMap.has(dateKey)) {
      ordersMap.set(dateKey, order);
    }
  }

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
            isAdmin && params.user_id ? `&user_id=${params.user_id}` : ""
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
            isAdmin && params.user_id ? `&user_id=${params.user_id}` : ""
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
            {(calendarError || ordersError)?.message}
          </p>
        </div>
      )}

      {/* 管理者モードの表示 */}
      {isAdmin &&
        params.user_id &&
        targetUserId !== user.id &&
        targetProfile && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
            <p className="font-medium">
              管理者モード: {targetProfile.full_name || "ユーザー"}
              さんのカレンダーを表示中
            </p>
            <a
              href={`/calendar?year=${currentYear}&month=${currentMonthDisplay}`}
              className="text-amber-600 hover:text-amber-700 underline mt-1 inline-block"
            >
              自分のカレンダーに戻る
            </a>
          </div>
        )}

      {/* カレンダーグリッド */}
      <CalendarGrid
        year={currentYear}
        month={currentMonth}
        orderDaysMap={orderDaysMap}
        ordersMap={ordersMap}
        maxOrderDaysAhead={(systemSettings as { max_order_days_ahead?: number } | null)?.max_order_days_ahead || 30}
        targetUserId={isAdmin && params.user_id ? targetUserId : undefined}
      />
    </div>
  );
}
