import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { transaction } from "@/lib/database/query";
import { NextRequest, NextResponse } from "next/server";

/**
 * 注文更新API
 * PUT /api/orders/[id]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // 一般ユーザーの場合、自分の状態をチェック
    if (!isAdmin) {
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
            { error: "退職済みのため注文を変更できません。" },
            { status: 403 }
          );
        }
      }
    }

    const resolvedParams = await Promise.resolve(params);
    const orderId = parseInt(resolvedParams.id, 10);

    if (isNaN(orderId)) {
      return NextResponse.json({ error: "注文IDが無効です" }, { status: 400 });
    }

    const { menu_id, quantity } = await request.json();

    // バリデーション
    if (!menu_id || !quantity) {
      return NextResponse.json(
        { error: "メニューIDと数量は必須です" },
        { status: 400 }
      );
    }

    if (quantity < 1) {
      return NextResponse.json(
        { error: "数量は1以上で入力してください" },
        { status: 400 }
      );
    }

    // Transaction connectionを使用して注文更新処理を実行
    try {
      const result = await transaction(async (client) => {
        // 注文の存在確認と所有権チェック
        let orderResult;
        if (isAdmin) {
          orderResult = await client.query(
            "SELECT * FROM orders WHERE id = $1",
            [orderId]
          );
        } else {
          orderResult = await client.query(
            "SELECT * FROM orders WHERE id = $1 AND user_id = $2",
            [orderId, user.id]
          );
        }

        if (orderResult.rows.length === 0) {
          const error: any = new Error("注文が見つかりません");
          error.statusCode = 404;
          throw error;
        }

        const order = orderResult.rows[0];

        // キャンセル済みの注文は更新不可
        if (order.status === "canceled") {
          const error: any = new Error("キャンセル済みの注文は変更できません");
          error.statusCode = 400;
          throw error;
        }

        // 注文日の情報を取得
        if (!order.order_date) {
          const error: any = new Error("注文日の情報が取得できませんでした");
          error.statusCode = 400;
          throw error;
        }

        const orderDayResult = await client.query(
          "SELECT * FROM order_calendar WHERE target_date = $1",
          [order.order_date]
        );

        const orderDay = orderDayResult.rows[0];
        if (!orderDay || !orderDay.is_available) {
          const error: any = new Error("この日は注文できません");
          error.statusCode = 400;
          throw error;
        }

        // 締切時刻をチェック
        const orderDateObj = new Date(order.order_date + "T00:00:00");
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isToday = orderDateObj.getTime() === today.getTime();

        if (isToday && orderDay.deadline_time) {
          const now = new Date();
          const [hours, minutes] = orderDay.deadline_time
            .split(":")
            .map(Number);
          const deadline = new Date(today);
          deadline.setHours(hours, minutes, 0, 0);

          if (now >= deadline) {
            const error: any = new Error(
              "締切時刻を過ぎているため、注文を変更できません"
            );
            error.statusCode = 400;
            throw error;
          }
        }

        // 過去の日付は変更不可
        if (orderDateObj < today) {
          const error: any = new Error("過去の日付の注文は変更できません");
          error.statusCode = 400;
          throw error;
        }

        // メニューの存在確認
        const menuResult = await client.query(
          "SELECT id, is_active FROM menu_items WHERE id = $1",
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
          [menu_id, order.order_date]
        );

        if (!priceResult.rows[0]?.price_id) {
          const error: any = new Error("価格情報の取得に失敗しました");
          error.statusCode = 500;
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

        // 注文を更新
        const updateResult = await client.query(
          `UPDATE orders 
           SET menu_item_id = $1, menu_price_id = $2, quantity = $3, 
               unit_price_snapshot = $4 
           WHERE id = $5 ${!isAdmin ? "AND user_id = $6" : ""}
           RETURNING *`,
          isAdmin
            ? [menu_id, menu_price_id, quantity, unit_price_snapshot, orderId]
            : [
                menu_id,
                menu_price_id,
                quantity,
                unit_price_snapshot,
                orderId,
                user.id,
              ]
        );

        const updatedOrder = updateResult.rows[0];

        // 監査ログ記録
        try {
          await client.query(
            `INSERT INTO audit_logs 
             (actor_id, action, details, target_table, target_id) 
             VALUES ($1, $2, $3, 'orders', $4)`,
            [
              user.id,
              isAdmin ? "order.update.admin" : "order.update",
              JSON.stringify({
                order_id: orderId,
                menu_item_id: menu_id,
                order_date: order.order_date,
                quantity,
                previous_menu_item_id: order.menu_item_id,
                previous_quantity: order.quantity,
                target_user_id: order.user_id,
                ...(isAdmin ? { updated_by_admin: true } : {}),
              }),
              orderId.toString(),
            ]
          );
        } catch (auditLogError) {
          // 監査ログの記録エラーは無視（更新は成功しているため）
        }

        return updatedOrder;
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
      { error: "注文更新処理中にエラーが発生しました: " + errorMessage },
      { status: 500 }
    );
  }
}

/**
 * 注文キャンセルAPI
 * PATCH /api/orders/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // 一般ユーザーの場合、自分の状態をチェック
    if (!isAdmin) {
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
            { error: "退職済みのため注文をキャンセルできません。" },
            { status: 403 }
          );
        }
      }
    }

    const resolvedParams = await Promise.resolve(params);
    const orderId = parseInt(resolvedParams.id, 10);

    if (isNaN(orderId)) {
      return NextResponse.json({ error: "注文IDが無効です" }, { status: 400 });
    }

    // Transaction connectionを使用して注文キャンセル処理を実行
    try {
      const result = await transaction(async (client) => {
        // 注文の存在確認と所有権チェック
        let orderResult;
        if (isAdmin) {
          orderResult = await client.query(
            "SELECT * FROM orders WHERE id = $1",
            [orderId]
          );
        } else {
          orderResult = await client.query(
            "SELECT * FROM orders WHERE id = $1 AND user_id = $2",
            [orderId, user.id]
          );
        }

        if (orderResult.rows.length === 0) {
          const error: any = new Error("注文が見つかりません");
          error.statusCode = 404;
          throw error;
        }

        const order = orderResult.rows[0];

        // 既にキャンセル済みの場合はエラー
        if (order.status === "canceled") {
          const error: any = new Error("この注文は既にキャンセル済みです");
          error.statusCode = 400;
          throw error;
        }

        // 注文日の情報を取得
        if (!order.order_date) {
          const error: any = new Error("注文日の情報が取得できませんでした");
          error.statusCode = 400;
          throw error;
        }

        const orderDayResult = await client.query(
          "SELECT * FROM order_calendar WHERE target_date = $1",
          [order.order_date]
        );

        const orderDay = orderDayResult.rows[0] || null;

        // 一般ユーザーの場合、締切時刻を過ぎた注文はキャンセル不可（管理者は可能）
        if (!isAdmin) {
          if (orderDay?.deadline_time) {
            const orderDateObj = new Date(order.order_date + "T00:00:00");
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const isToday = orderDateObj.getTime() === today.getTime();

            if (isToday || orderDateObj < today) {
              const now = new Date();
              const [hours, minutes] = orderDay.deadline_time
                .split(":")
                .map(Number);
              const deadline = new Date(orderDateObj);
              deadline.setHours(hours, minutes, 0, 0);

              if (now >= deadline) {
                const error: any = new Error(
                  "締切時刻を過ぎているため、キャンセルできません"
                );
                error.statusCode = 400;
                throw error;
              }
            }
          } else {
            // deadline_timeが設定されていない場合、過去の日付はキャンセル不可
            const orderDateObj = new Date(order.order_date + "T00:00:00");
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (orderDateObj < today) {
              const error: any = new Error(
                "過去の日付の注文はキャンセルできません"
              );
              error.statusCode = 400;
              throw error;
            }
          }
        }

        // 注文をキャンセル
        const updateResult = await client.query(
          `UPDATE orders 
           SET status = 'canceled' 
           WHERE id = $1 ${!isAdmin ? "AND user_id = $2" : ""}
           RETURNING *`,
          isAdmin ? [orderId] : [orderId, user.id]
        );

        const updatedOrder = updateResult.rows[0];

        // 監査ログ記録
        try {
          await client.query(
            `INSERT INTO audit_logs 
             (actor_id, action, details, target_table, target_id) 
             VALUES ($1, $2, $3, 'orders', $4)`,
            [
              user.id,
              isAdmin ? "order.cancel.admin" : "order.cancel",
              JSON.stringify({
                order_id: orderId,
                order_date: order.order_date,
                target_user_id: order.user_id,
                ...(isAdmin ? { canceled_by_admin: true } : {}),
              }),
              orderId.toString(),
            ]
          );
        } catch (auditLogError) {
          // 監査ログの記録エラーは無視（キャンセルは成功しているため）
        }

        return updatedOrder;
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
      {
        error: "注文キャンセル処理中にエラーが発生しました: " + errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * 注文削除API（管理者のみ）
 * DELETE /api/orders/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 管理者権限チェック
    const { data: currentProfile, error: currentProfileError } =
      await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (currentProfileError || !currentProfile) {
      return NextResponse.json(
        { error: "プロフィールの取得に失敗しました" },
        { status: 500 }
      );
    }

    const currentProfileTyped = currentProfile as {
      role?: string;
      [key: string]: any;
    } | null;
    const isAdmin = currentProfileTyped?.role === "admin";

    if (!isAdmin) {
      return NextResponse.json(
        { error: "管理者権限が必要です" },
        { status: 403 }
      );
    }

    const resolvedParams = await Promise.resolve(params);
    const orderId = parseInt(resolvedParams.id, 10);

    if (isNaN(orderId)) {
      return NextResponse.json({ error: "注文IDが無効です" }, { status: 400 });
    }

    // 注文の存在確認
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "注文が見つかりません" },
        { status: 404 }
      );
    }

    const orderTyped = order as {
      order_date?: string;
      user_id?: string;
      menu_item_id?: number;
      quantity?: number;
      [key: string]: any;
    };

    // 注文を物理削除（Service Role Keyを使用してRLSをバイパス）
    const { error: deleteError } = await (supabaseAdmin.from("orders") as any)
      .delete()
      .eq("id", orderId);

    if (deleteError) {
      return NextResponse.json(
        {
          error: "注文の削除に失敗しました",
          details:
            deleteError.message || deleteError.details || "Unknown error",
          code: deleteError.code,
        },
        { status: 500 }
      );
    }

    // 監査ログ記録
    try {
      await (supabaseAdmin.from("audit_logs") as any).insert({
        actor_id: user.id,
        action: "order.delete.admin",
        details: {
          order_id: orderId,
          order_date: orderTyped.order_date,
          target_user_id: orderTyped.user_id,
          menu_item_id: orderTyped.menu_item_id,
          quantity: orderTyped.quantity,
          deleted_by_admin: true,
        },
        target_table: "orders",
        target_id: orderId.toString(),
      });
    } catch (auditLogError) {
      // 監査ログの記録エラーは無視（削除は成功しているため）
    }

    return NextResponse.json({
      success: true,
      message: "注文を削除しました",
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "注文削除処理中にエラーが発生しました: " + errorMessage,
      },
      { status: 500 }
    );
  }
}
