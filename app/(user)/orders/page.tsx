import { createClient } from "@/lib/supabase/server";
import { queryDatabase } from "@/lib/database/query";
import CancelOrderButton from "@/components/cancel-order-button";

/**
 * 注文履歴ページ
 * ユーザーの注文一覧を表示
 */
export default async function OrdersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // 今月の注文を取得
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  const startDate = startOfMonth.toISOString().split("T")[0];

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
       WHERE o.user_id = $1 AND o.order_date >= $2
       ORDER BY o.order_date DESC`,
      [user.id, startDate]
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

  const ordersTyped = orders as Array<{ order_date: string; [key: string]: any }> | null;

  // 日付をキーとしたマップを作成
  const orderDaysMap = new Map(
    ((orderDays as Array<{ target_date: string; deadline_time: string | null }> | null)?.map((day) => [day.target_date, day]) || [])
  );

  // 締切時間を過ぎたかどうかを判定する関数（JSTで統一）
  const isAfterDeadline = (
    orderDate: string,
    deadlineTime: string | null
  ): boolean => {
    // JST（UTC+9）で現在時刻を取得
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000; // JSTはUTC+9
    const jstNow = new Date(now.getTime() + jstOffset);
    
    // 今日の日付をJSTで取得（YYYY-MM-DD形式）
    const year = jstNow.getUTCFullYear();
    const month = String(jstNow.getUTCMonth() + 1).padStart(2, '0');
    const day = String(jstNow.getUTCDate()).padStart(2, '0');
    const todayJSTStr = `${year}-${month}-${day}`;
    
    // 過去の日付は締切時間を過ぎている
    if (orderDate < todayJSTStr) {
      return true;
    }
    
    if (!deadlineTime) {
      // deadline_timeが設定されていない場合、過去の日付は締切時間を過ぎているとみなす
      // 既に過去の日付チェックは上で行っているので、ここでは今日以降はfalse
      return false;
    }

    // 今日の日付の場合、現在時刻と締切時刻を比較（JST）
    if (orderDate === todayJSTStr) {
      const [hours, minutes] = deadlineTime.split(":").map(Number);
      // JSTの今日の締切時刻をUTCに変換して作成
      // JSTの時刻から9時間を引いてUTCに変換
      let utcHours = hours - 9;
      let utcDate = jstNow.getUTCDate();
      let utcMonth = jstNow.getUTCMonth();
      let utcYear = year;
      
      // 時刻が負の場合は前日に繰り下げ
      if (utcHours < 0) {
        utcHours += 24;
        utcDate -= 1;
        if (utcDate < 1) {
          utcMonth -= 1;
          if (utcMonth < 0) {
            utcMonth = 11;
            utcYear -= 1;
          }
          utcDate = new Date(utcYear, utcMonth + 1, 0).getDate();
        }
      }
      
      const deadlineUTC = new Date(Date.UTC(utcYear, utcMonth, utcDate, utcHours, minutes, 0));
      
      // UTCの現在時刻と比較
      return now >= deadlineUTC;
    }

    // 未来の日付は締切時間を過ぎていない
    return false;
  };

  // 合計金額を計算（unit_price_snapshotを使用）
  const totalAmount =
    ordersTyped?.reduce((sum, order) => {
      if (order.status === "ordered" && order.unit_price_snapshot) {
        return sum + order.unit_price_snapshot * order.quantity;
      }
      return sum;
    }, 0) || 0;

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📋 注文履歴</h1>
          <p className="text-gray-500 mt-1">今月の注文一覧</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">今月の合計</div>
          <div className="text-2xl font-bold text-amber-600">
            ¥{totalAmount.toLocaleString()}
          </div>
        </div>
      </div>

      {/* 注文一覧 */}
      <div className="space-y-3">
        {ordersTyped && ordersTyped.length > 0 ? (
          ordersTyped.map((order) => {
            const date = new Date(order.order_date);
            const dayOfWeek = ["日", "月", "火", "水", "木", "金", "土"][
              date.getDay()
            ];

            return (
              <div
                key={order.id}
                className={`
                  p-4 rounded-xl border bg-white
                  ${order.status === "canceled" ? "opacity-60" : ""}
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center font-bold text-amber-700">
                      {date.getDate()}
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">
                        {date.getMonth() + 1}月{date.getDate()}日（{dayOfWeek}）
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {order.menu_items?.name}
                        {order.quantity > 1 && ` × ${order.quantity}`}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {order.menu_items?.vendors?.name}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-800">
                      ¥
                      {(
                        (order.unit_price_snapshot || 0) * order.quantity
                      ).toLocaleString()}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {order.status === "canceled" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                          キャンセル済み
                        </span>
                      ) : (
                        <>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                            注文済み
                          </span>
                          {(() => {
                            const orderDay = orderDaysMap.get(order.order_date);
                            const canCancel = !isAfterDeadline(
                              order.order_date,
                              orderDay?.deadline_time || null
                            );

                            if (canCancel) {
                              return (
                                <CancelOrderButton
                                  orderId={order.id}
                                  orderDate={order.order_date}
                                />
                              );
                            }
                            return null;
                          })()}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p>注文履歴がありません</p>
          </div>
        )}
      </div>
    </div>
  );
}
