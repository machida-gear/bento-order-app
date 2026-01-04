import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
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

    // 現在のユーザーのプロフィールを取得して管理者権限をチェック
    const { data: currentProfile, error: currentProfileError } =
      await supabaseAdmin
        .from("profiles")
        .select("role, is_active, left_date")
        .eq("id", user.id)
        .single();

    if (currentProfileError || !currentProfile) {
      return NextResponse.json(
        { error: "プロフィールの取得に失敗しました" },
        { status: 500 }
      );
    }

    const currentProfileTyped = currentProfile as { role?: string; is_active?: boolean; left_date?: string | null; [key: string]: any } | null
    const isAdmin = currentProfileTyped?.role === "admin";

    const { menu_id, order_date, quantity, user_id } = await request.json();

    // 注文対象のユーザーIDを決定（管理者がuser_idを指定した場合はそれを使用、それ以外は現在のユーザーID）
    const targetUserId = isAdmin && user_id ? user_id : user.id;

    // 管理者が他のユーザーIDを指定した場合、そのユーザーが存在するかチェック
    if (isAdmin && user_id && user_id !== user.id) {
      const { data: targetProfile, error: targetProfileError } =
        await supabaseAdmin
          .from("profiles")
          .select("id, is_active, left_date")
          .eq("id", user_id)
          .single();

      if (targetProfileError || !targetProfile) {
        return NextResponse.json(
          { error: "指定されたユーザーが見つかりません" },
          { status: 404 }
        );
      }

      // 注文対象ユーザーの状態チェック
      const targetProfileTyped = targetProfile as { is_active?: boolean; left_date?: string | null; [key: string]: any } | null
      if (!targetProfileTyped?.is_active) {
        return NextResponse.json(
          { error: "指定されたユーザーのアカウントが無効化されています" },
          { status: 403 }
        );
      }

      if (targetProfileTyped?.left_date) {
        const leftDate = new Date(targetProfileTyped.left_date);
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
      if (!currentProfileTyped?.is_active) {
        return NextResponse.json(
          {
            error: "アカウントが無効化されています。管理者に連絡してください。",
          },
          { status: 403 }
        );
      }

      if (currentProfileTyped?.left_date) {
        const leftDate = new Date(currentProfileTyped.left_date);
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

    // 過去の日付チェック
    const orderDateObj = new Date(order_date + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (orderDateObj < today) {
      return NextResponse.json(
        { error: "過去の日付には注文できません" },
        { status: 400 }
      );
    }

    // システム設定を取得（max_order_days_ahead）
    const { data: systemSettings } = await supabase
      .from("system_settings")
      .select("max_order_days_ahead")
      .eq("id", 1)
      .single();

    const systemSettingsTyped = systemSettings as { max_order_days_ahead?: number | null; [key: string]: any } | null
    // 最大注文可能日数をチェック
    if (systemSettingsTyped?.max_order_days_ahead) {
      const diffTime = orderDateObj.getTime() - today.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > systemSettingsTyped.max_order_days_ahead) {
        return NextResponse.json(
          {
            error: `注文可能日数を超えています（最大${systemSettingsTyped.max_order_days_ahead}日先まで）`,
          },
          { status: 400 }
        );
      }
    }

    // 注文可能日チェック
    const { data: orderDay, error: orderDayError } = await supabase
      .from("order_calendar")
      .select("*")
      .eq("target_date", order_date)
      .single();

    const orderDayTyped = orderDay as { is_available?: boolean; deadline_time?: string | null; [key: string]: any } | null
    if (orderDayError || !orderDayTyped || !orderDayTyped.is_available) {
      return NextResponse.json(
        { error: "この日は注文できません" },
        { status: 400 }
      );
    }

    // 今日の場合、締切時刻をチェック
    const isToday = orderDateObj.getTime() === today.getTime();
    if (isToday && orderDayTyped.deadline_time) {
      const now = new Date();
      const [hours, minutes] = orderDayTyped.deadline_time.split(":").map(Number);
      const deadline = new Date(today);
      deadline.setHours(hours, minutes, 0, 0);

      if (now >= deadline) {
        return NextResponse.json(
          { error: "締切時刻を過ぎています" },
          { status: 400 }
        );
      }
    }

    // 同日に既存の注文があるかチェック（異なるメニューでも1日1注文のみ）
    // キャンセル済み（status = 'canceled'）の注文は除外する
    const { data: existingOrder, error: existingOrderError } =
      await supabaseAdmin
        .from("orders")
        .select("id, status")
        .eq("user_id", targetUserId)
        .eq("order_date", order_date)
        .eq("status", "ordered") // 注文済み（ordered）のもののみチェック
        .maybeSingle();

    if (existingOrderError) {
      return NextResponse.json(
        { error: "注文の確認中にエラーが発生しました" },
        { status: 500 }
      );
    }

    // 注文済み（ordered）の注文がある場合のみエラー
    // キャンセル済み（canceled）の注文は無視して、新規注文を許可する
    const existingOrderTyped = existingOrder as { status?: string; [key: string]: any } | null
    if (existingOrderTyped && existingOrderTyped.status === "ordered") {
      return NextResponse.json(
        {
          error:
            "この日付には既に注文があります。注文を変更する場合は、カレンダーから該当日をクリックしてください",
        },
        { status: 409 }
      );
    }

    // キャンセル済みの注文がある場合、UNIQUE制約違反を避けるために削除する
    // UNIQUE制約は (user_id, menu_id, order_date, status) なので、
    // 同じ menu_id でキャンセル済みの注文があると新規注文が作成できない可能性がある
    const { data: canceledOrders } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("user_id", targetUserId)
      .eq("order_date", order_date)
      .eq("status", "canceled")
      .eq("menu_item_id", menu_id); // 同じ menu_id のキャンセル済み注文のみ削除

    const canceledOrdersTyped = canceledOrders as Array<{ id: number; [key: string]: any }> | null
    if (canceledOrdersTyped && canceledOrdersTyped.length > 0) {
      // キャンセル済みの注文を削除（UNIQUE制約違反を避けるため）
      for (const canceledOrder of canceledOrdersTyped) {
        await (supabaseAdmin.from("orders") as any).delete().eq("id", canceledOrder.id);
      }
    }

    // メニューの存在確認
    const { data: menu, error: menuError } = await supabase
      .from("menu_items")
      .select("id, is_active, vendor_id")
      .eq("id", menu_id)
      .single();

    const menuTyped = menu as { is_active?: boolean; [key: string]: any } | null
    if (menuError || !menuTyped || !menuTyped.is_active) {
      return NextResponse.json(
        { error: "選択されたメニューは存在しないか、無効です" },
        { status: 400 }
      );
    }

    // 価格ID取得（DB関数を使用）
    try {
      const { data: priceData, error: priceError } = await (supabaseAdmin
        .rpc as any)("get_menu_price_id", {
          p_menu_id: menu_id,
          p_order_date: order_date,
        });

      if (priceError) {
        return NextResponse.json(
          {
            error: "価格情報の取得に失敗しました",
            details:
              priceError.message || priceError.details || "Unknown error",
            code: priceError.code,
            hint: priceError.hint,
          },
          { status: 500 }
        );
      }

      if (!priceData && priceData !== 0) {
        return NextResponse.json(
          {
            error: "価格情報が見つかりませんでした",
            details: `メニューID: ${menu_id}, 注文日: ${order_date}`,
          },
          { status: 404 }
        );
      }

      const menu_price_id = priceData as number;

      // 価格情報を取得（unit_price_snapshot用）
      const { data: priceInfo, error: priceInfoError } = await supabaseAdmin
        .from("menu_prices")
        .select("price")
        .eq("id", menu_price_id)
        .single();

      const priceInfoTyped = priceInfo as { price: number; [key: string]: any } | null
      if (priceInfoError || !priceInfoTyped) {
        return NextResponse.json(
          {
            error: "価格情報の取得に失敗しました",
            details: priceInfoError?.message || "Price info not found",
          },
          { status: 500 }
        );
      }

      // 注文作成（Service Role Keyを使用してRLSをバイパス）
      // 注意: ordersテーブルのカラム名はmenu_item_id（menu_idではない）
      // unit_price_snapshotとsourceカラムも必須
      const { error: insertError, data: orderData } = await (supabaseAdmin
        .from("orders") as any)
        .insert({
          user_id: targetUserId, // 管理者が指定したユーザーIDまたは現在のユーザーID
          menu_item_id: menu_id, // 実際のDBではmenu_item_idカラム名を使用
          menu_price_id,
          order_date: order_date,
          quantity,
          unit_price_snapshot: priceInfoTyped.price, // 注文時の単価スナップショット
          status: "ordered",
          source: "manual", // 手動注文（管理者による代行も'manual'として記録）
        })
        .select()
        .single();

      if (insertError) {
        // UNIQUE制約違反の場合は重複エラー
        if (insertError.code === "23505") {
          // UNIQUE制約違反が発生した場合、ordered状態の注文があるか再確認
          const { data: orderedOrder } = await supabaseAdmin
            .from("orders")
            .select("id, status")
            .eq("user_id", targetUserId)
            .eq("order_date", order_date)
            .eq("status", "ordered")
            .maybeSingle();

          const orderedOrderTyped = orderedOrder as { status?: string; [key: string]: any } | null
          if (orderedOrderTyped && orderedOrderTyped.status === "ordered") {
            return NextResponse.json(
              {
                error:
                  "この日付には既に注文があります。注文を変更する場合は、カレンダーから該当日をクリックしてください",
              },
              { status: 409 }
            );
          }

          // ordered状態の注文がない場合は、UNIQUE制約違反の原因が不明
          // キャンセル済みの注文がある可能性があるので、エラーメッセージを改善
          return NextResponse.json(
            {
              error:
                "注文の作成に失敗しました。データベースの制約に違反しています。",
              details:
                insertError.message || insertError.details || "Unknown error",
            },
            { status: 500 }
          );
        }
        return NextResponse.json(
          {
            error: "注文の作成に失敗しました",
            details:
              insertError.message || insertError.details || "Unknown error",
            code: insertError.code,
            hint: insertError.hint,
          },
          { status: 500 }
        );
      }

      // 監査ログ記録（Service Role Keyを使用）
      // 注意: audit_logsテーブルのカラム名はactor_id（actor_user_idではない）
      // detailsカラム名を確認（detailではなくdetails）
      try {
        const orderDataTyped = orderData as { id: number; [key: string]: any }
        await (supabaseAdmin.from("audit_logs") as any).insert({
          actor_id: user.id, // 実際に操作したユーザー（管理者）
          action: isAdmin && user_id ? "order.create.admin" : "order.create",
          details: {
            order_id: orderDataTyped.id,
            menu_item_id: menu_id,
            order_date,
            quantity,
            target_user_id: targetUserId, // 注文対象のユーザーID
            ...(isAdmin && user_id ? { created_by_admin: true } : {}),
          },
          target_table: "orders",
          target_id: orderDataTyped.id.toString(),
        });
      } catch (auditLogError) {
        // 監査ログの記録エラーは無視（注文は成功しているため）
      }

      return NextResponse.json({
        success: true,
        order: orderData,
      });
    } catch (rpcError) {
      const errorMessage =
        rpcError instanceof Error ? rpcError.message : "Unknown error";
      return NextResponse.json(
        {
          error: "価格取得処理でエラーが発生しました",
          details: errorMessage,
        },
        { status: 500 }
      );
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
