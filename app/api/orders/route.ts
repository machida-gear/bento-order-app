import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { transaction } from "@/lib/database/query";
import { NextRequest, NextResponse } from "next/server";

/**
 * 注文作成API
 * POST /api/orders
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // Transaction connectionを使用してプロフィールを取得
    const currentProfile = await transaction(async (client) => {
      const result = await client.query(
        "SELECT role, is_active, left_date FROM profiles WHERE id = $1",
        [user.id]
      );
      return result.rows[0] as
        | { role?: string; is_active?: boolean; left_date?: string | null }
        | undefined;
    });

    if (!currentProfile) {
      return NextResponse.json(
        { error: "プロフィールの取得に失敗しました" },
        { status: 500 }
      );
    }

    const isAdmin = currentProfile.role === "admin";

    const { menu_id, order_date, quantity, user_id } = await request.json();

    // 管理者モードの判定: user_idパラメータが指定されている場合（管理者権限がある場合のみ許可）
    const isAdminMode = isAdmin && user_id !== undefined;

    // 注文対象のユーザーIDを決定（管理者モードの場合はuser_idを使用、それ以外は現在のユーザーID）
    const targetUserId = isAdminMode ? user_id : user.id;

    // 管理者モードの場合、指定されたユーザーIDが存在するかチェック
    if (isAdminMode && user_id !== user.id) {
      const targetProfile = await transaction(async (client) => {
        const result = await client.query(
          "SELECT id, is_active, left_date FROM profiles WHERE id = $1",
          [user_id]
        );
        return result.rows[0] as
          | { is_active?: boolean; left_date?: string | null }
          | undefined;
      });

      if (!targetProfile) {
        return NextResponse.json(
          { error: "指定されたユーザーが見つかりません" },
          { status: 404 }
        );
      }

      // 注文対象ユーザーの状態チェック
      if (!targetProfile.is_active) {
        return NextResponse.json(
          { error: "指定されたユーザーのアカウントが無効化されています" },
          { status: 403 }
        );
      }

      if (targetProfile.left_date) {
        const leftDate = new Date(targetProfile.left_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        leftDate.setHours(0, 0, 0, 0);

        if (leftDate < today) {
          return NextResponse.json(
            { error: "指定されたユーザーは退職済みのため注文できません" },
            { status: 403 }
          );
        }
      }
    } else {
      // 一般ユーザーの場合、自分の状態をチェック
      if (!currentProfile.is_active) {
        return NextResponse.json(
          {
            error: "アカウントが無効化されています。管理者に連絡してください。",
          },
          { status: 403 }
        );
      }

      if (currentProfile.left_date) {
        const leftDate = new Date(currentProfile.left_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        leftDate.setHours(0, 0, 0, 0);

        if (leftDate < today) {
          return NextResponse.json(
            { error: "退職済みのため注文できません。" },
            { status: 403 }
          );
        }
      }
    }

    // バリデーション
    if (!menu_id || !order_date || !quantity) {
      return NextResponse.json(
        { error: "メニューID、注文日、数量は必須です" },
        { status: 400 }
      );
    }

    if (quantity < 1) {
      return NextResponse.json(
        { error: "数量は1以上で入力してください" },
        { status: 400 }
      );
    }

    // 日付形式のバリデーション
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(order_date)) {
      return NextResponse.json(
        { error: "日付の形式が正しくありません" },
        { status: 400 }
      );
    }

    // 過去の日付チェック（管理者の場合はスキップ）
    const orderDateObj = new Date(order_date + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!isAdmin && orderDateObj < today) {
      return NextResponse.json(
        { error: "過去の日付には注文できません" },
        { status: 400 }
      );
    }

    // Transaction connectionを使用してシステム設定とカレンダー情報を取得
    const { systemSettings, orderDay } = await transaction(async (client) => {
      // システム設定を取得
      const settingsResult = await client.query(
        "SELECT max_order_days_ahead FROM system_settings WHERE id = 1"
      );
      const systemSettings = settingsResult.rows[0] || null;

      // 注文可能日チェック
      const calendarResult = await client.query(
        "SELECT * FROM order_calendar WHERE target_date = $1",
        [order_date]
      );
      const orderDay = calendarResult.rows[0] || null;

      return { systemSettings, orderDay };
    });

    // 最大注文可能日数をチェック（管理者の場合はスキップ）
    if (!isAdmin && systemSettings?.max_order_days_ahead) {
      const diffTime = orderDateObj.getTime() - today.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > systemSettings.max_order_days_ahead) {
        return NextResponse.json(
          {
            error: `注文可能日数を超えています（最大${systemSettings.max_order_days_ahead}日先まで）`,
          },
          { status: 400 }
        );
      }
    }

    // 注文可能日チェック（管理者の場合はスキップ）
    if (!isAdmin) {
      if (!orderDay || !orderDay.is_available) {
        return NextResponse.json(
          { error: "この日は注文できません" },
          { status: 400 }
        );
      }

      // 今日の場合、締切時刻をチェック
      const isToday = orderDateObj.getTime() === today.getTime();
      if (isToday && orderDay.deadline_time) {
        const now = new Date();
        const [hours, minutes] = orderDay.deadline_time.split(":").map(Number);
        const deadline = new Date(today);
        deadline.setHours(hours, minutes, 0, 0);

        if (now >= deadline) {
          return NextResponse.json(
            { error: "締切時刻を過ぎています" },
            { status: 400 }
          );
        }
      }
    }

    // Transaction connectionを使用して注文作成処理を実行
    try {
      const result = await transaction(async (client) => {
        // 同日に既存の注文があるかチェック（異なるメニューでも1日1注文のみ）
        const existingOrderResult = await client.query(
          `SELECT id, status FROM orders 
           WHERE user_id = $1 AND order_date = $2 AND status = 'ordered'`,
          [targetUserId, order_date]
        );

        if (existingOrderResult.rows.length > 0) {
          const error: any = new Error(
            "この日付には既に注文があります。注文を変更する場合は、カレンダーから該当日をクリックしてください"
          );
          error.statusCode = 409;
          throw error;
        }

        // キャンセル済みの注文がある場合、UNIQUE制約違反を避けるために削除する
        const canceledOrdersResult = await client.query(
          `SELECT id FROM orders 
           WHERE user_id = $1 AND order_date = $2 
             AND status = 'canceled' AND menu_item_id = $3`,
          [targetUserId, order_date, menu_id]
        );

        if (canceledOrdersResult.rows.length > 0) {
          for (const canceledOrder of canceledOrdersResult.rows) {
            await client.query("DELETE FROM orders WHERE id = $1", [
              canceledOrder.id,
            ]);
          }
        }

        // メニューの存在確認
        const menuResult = await client.query(
          "SELECT id, is_active, vendor_id FROM menu_items WHERE id = $1",
          [menu_id]
        );

        if (menuResult.rows.length === 0 || !menuResult.rows[0].is_active) {
          const error: any = new Error(
            "選択されたメニューは存在しないか、無効です"
          );
          error.statusCode = 400;
          throw error;
        }

        // 価格ID取得（DB関数を使用）
        const priceResult = await client.query(
          "SELECT get_menu_price_id($1, $2) as price_id",
          [menu_id, order_date]
        );

        if (!priceResult.rows[0]?.price_id) {
          const error: any = new Error(
            `価格情報が見つかりませんでした（メニューID: ${menu_id}, 注文日: ${order_date}）`
          );
          error.statusCode = 404;
          throw error;
        }

        const menu_price_id = priceResult.rows[0].price_id;

        // 価格情報を取得（unit_price_snapshot用）
        const priceInfoResult = await client.query(
          "SELECT price FROM menu_prices WHERE id = $1",
          [menu_price_id]
        );

        if (priceInfoResult.rows.length === 0) {
          const error: any = new Error("価格情報の取得に失敗しました");
          error.statusCode = 500;
          throw error;
        }

        const unit_price_snapshot = priceInfoResult.rows[0].price;

        // 注文作成
        const insertResult = await client.query(
          `INSERT INTO orders 
           (user_id, menu_item_id, menu_price_id, order_date, quantity, 
            unit_price_snapshot, status, source) 
           VALUES ($1, $2, $3, $4, $5, $6, 'ordered', 'manual') 
           RETURNING *`,
          [
            targetUserId,
            menu_id,
            menu_price_id,
            order_date,
            quantity,
            unit_price_snapshot,
          ]
        );

        const orderData = insertResult.rows[0];

        // 監査ログ記録
        try {
          await client.query(
            `INSERT INTO audit_logs 
             (actor_id, action, details, target_table, target_id) 
             VALUES ($1, $2, $3, 'orders', $4)`,
            [
              user.id,
              isAdminMode ? "order.create.admin" : "order.create",
              JSON.stringify({
                order_id: orderData.id,
                menu_item_id: menu_id,
                order_date,
                quantity,
                target_user_id: targetUserId,
                ...(isAdminMode ? { created_by_admin: true } : {}),
              }),
              orderData.id.toString(),
            ]
          );
        } catch (auditLogError) {
          // 監査ログの記録エラーは無視（注文は成功しているため）
        }

        return orderData;
      });

      return NextResponse.json({
        success: true,
        order: result,
      });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return NextResponse.json({ error: errorMessage }, { status: statusCode });
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "注文処理中にエラーが発生しました: " + errorMessage },
      { status: 500 }
    );
  }
}
