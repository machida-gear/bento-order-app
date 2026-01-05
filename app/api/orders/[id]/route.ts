import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
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

    // 一般ユーザーの場合、自分の状態をチェック
    if (!isAdmin) {
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

    // 注文の存在確認と所有権チェック（管理者の場合は所有権チェックをスキップ）
    const orderQuery = supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId);

    if (!isAdmin) {
      orderQuery.eq("user_id", user.id);
    }

    const { data: order, error: orderError } = await orderQuery.single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "注文が見つかりません" },
        { status: 404 }
      );
    }

    const orderTyped = order as { status?: string; order_date?: string; menu_item_id?: number; user_id?: string; quantity?: number; [key: string]: any }

    // キャンセル済みの注文は更新不可
    if (orderTyped.status === "canceled") {
      return NextResponse.json(
        { error: "キャンセル済みの注文は変更できません" },
        { status: 400 }
      );
    }

    // 注文日の情報を取得
    if (!orderTyped.order_date) {
      return NextResponse.json(
        { error: "注文日の情報が取得できませんでした" },
        { status: 400 }
      );
    }
    const { data: orderDay } = await supabase
      .from("order_calendar")
      .select("*")
      .eq("target_date", orderTyped.order_date)
      .single();

    const orderDayTyped = orderDay as { is_available?: boolean; deadline_time?: string | null; [key: string]: any } | null
    if (!orderDayTyped || !orderDayTyped.is_available) {
      return NextResponse.json(
        { error: "この日は注文できません" },
        { status: 400 }
      );
    }

    // 締切時刻をチェック
    const orderDateObj = new Date(orderTyped.order_date! + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isToday = orderDateObj.getTime() === today.getTime();

    if (isToday && orderDayTyped.deadline_time) {
      const now = new Date();
      const [hours, minutes] = orderDayTyped.deadline_time.split(":").map(Number);
      const deadline = new Date(today);
      deadline.setHours(hours, minutes, 0, 0);

      if (now >= deadline) {
        return NextResponse.json(
          { error: "締切時刻を過ぎているため、注文を変更できません" },
          { status: 400 }
        );
      }
    }

    // 過去の日付は変更不可
    if (orderDateObj < today) {
      return NextResponse.json(
        { error: "過去の日付の注文は変更できません" },
        { status: 400 }
      );
    }

    // メニューの存在確認
    const { data: menu, error: menuError } = await supabase
      .from("menu_items")
      .select("id, is_active")
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
    const { data: priceData, error: priceError } = await (supabaseAdmin
      .rpc as any)("get_menu_price_id", {
        p_menu_id: menu_id,
        p_order_date: orderTyped.order_date!,
      });

    if (priceError || (priceData === null && priceData !== 0)) {
      return NextResponse.json(
        {
          error: "価格情報の取得に失敗しました",
          details: priceError?.message || "Price not found",
        },
        { status: 500 }
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

    // 注文を更新（Service Role Keyを使用してRLSをバイパス）
    const updateQuery = (supabaseAdmin
      .from("orders") as any)
      .update({
        menu_item_id: menu_id,
        menu_price_id,
        quantity,
        unit_price_snapshot: priceInfoTyped.price,
      })
      .eq("id", orderId);

    if (!isAdmin) {
      updateQuery.eq("user_id", user.id);
    }

    const { error: updateError, data: updatedOrder } = await updateQuery
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        {
          error: "注文の更新に失敗しました",
          details:
            updateError.message || updateError.details || "Unknown error",
        },
        { status: 500 }
      );
    }

    // 監査ログ記録
    try {
      await (supabaseAdmin.from("audit_logs") as any).insert({
        actor_id: user.id, // 実際に操作したユーザー（管理者）
        action: isAdmin ? "order.update.admin" : "order.update",
        details: {
          order_id: orderId,
          menu_item_id: menu_id,
          order_date: orderTyped.order_date,
          quantity,
          previous_menu_item_id: orderTyped.menu_item_id,
          previous_quantity: orderTyped.quantity,
          target_user_id: orderTyped.user_id, // 注文対象のユーザーID
          ...(isAdmin ? { updated_by_admin: true } : {}),
        },
        target_table: "orders",
        target_id: orderId.toString(),
      });
    } catch (auditLogError) {
      // 監査ログの記録エラーは無視（更新は成功しているため）
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
    });
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

    // 一般ユーザーの場合、自分の状態をチェック
    if (!isAdmin) {
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

    // 注文の存在確認と所有権チェック（管理者の場合は所有権チェックをスキップ）
    const orderQuery = supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId);

    if (!isAdmin) {
      orderQuery.eq("user_id", user.id);
    }

    const { data: order, error: orderError } = await orderQuery.single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "注文が見つかりません" },
        { status: 404 }
      );
    }

    const orderTypedDelete = order as { status?: string; order_date?: string; user_id?: string; [key: string]: any }

    // 既にキャンセル済みの場合はエラー
    if (orderTypedDelete.status === "canceled") {
      return NextResponse.json(
        { error: "この注文は既にキャンセル済みです" },
        { status: 400 }
      );
    }

    // 注文日の情報を取得
    if (!orderTypedDelete.order_date) {
      return NextResponse.json(
        { error: "注文日の情報が取得できませんでした" },
        { status: 400 }
      );
    }
    const { data: orderDay } = await supabase
      .from("order_calendar")
      .select("*")
      .eq("target_date", orderTypedDelete.order_date)
      .single();

    const orderDayTypedDelete = orderDay as { deadline_time?: string | null; [key: string]: any } | null
    
    // 一般ユーザーの場合、締切時刻を過ぎた注文はキャンセル不可（管理者は可能）
    if (!isAdmin) {
      // 締切時刻を過ぎた注文はキャンセル不可（仕様として）
      // キャンセル処理中に締切時間を過ぎた場合もチェック
      if (orderDayTypedDelete?.deadline_time) {
        const orderDateObj = new Date(orderTypedDelete.order_date! + "T00:00:00");
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isToday = orderDateObj.getTime() === today.getTime();

        if (isToday || orderDateObj < today) {
          const now = new Date();
          const [hours, minutes] = orderDayTypedDelete.deadline_time.split(":").map(Number);
          const deadline = new Date(orderDateObj);
          deadline.setHours(hours, minutes, 0, 0);

          if (now >= deadline) {
            return NextResponse.json(
              {
                error: "締切時刻を過ぎているため、キャンセルできません",
              },
              { status: 400 }
            );
          }
        }
      } else {
        // deadline_timeが設定されていない場合、過去の日付はキャンセル不可
        const orderDateObj = new Date(orderTypedDelete.order_date! + "T00:00:00");
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (orderDateObj < today) {
          return NextResponse.json(
            { error: "過去の日付の注文はキャンセルできません" },
            { status: 400 }
          );
        }
      }
    }

    // 注文をキャンセル（Service Role Keyを使用してRLSをバイパス）
    const cancelQuery = (supabaseAdmin
      .from("orders") as any)
      .update({ status: "canceled" })
      .eq("id", orderId);

    if (!isAdmin) {
      cancelQuery.eq("user_id", user.id);
    }

    const { error: updateError, data: updatedOrder } = await cancelQuery
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        {
          error: "注文のキャンセルに失敗しました",
          details:
            updateError.message || updateError.details || "Unknown error",
          code: updateError.code,
        },
        { status: 500 }
      );
    }

    // 監査ログ記録（Service Role Keyを使用）
    // 注意: audit_logsテーブルのカラム名はactor_id（actor_user_idではない）
    // detailsカラム名を確認（detailではなくdetails）
    try {
      await (supabaseAdmin.from("audit_logs") as any).insert({
        actor_id: user.id, // 実際に操作したユーザー（管理者）
        action: isAdmin ? "order.cancel.admin" : "order.cancel",
        details: {
          order_id: orderId,
          order_date: orderTypedDelete.order_date,
          target_user_id: orderTypedDelete.user_id, // 注文対象のユーザーID
          ...(isAdmin ? { canceled_by_admin: true } : {}),
        },
        target_table: "orders",
        target_id: orderId.toString(),
      });
    } catch (auditLogError) {
      // 監査ログの記録エラーは無視（キャンセルは成功しているため）
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
    });
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

    const currentProfileTyped = currentProfile as { role?: string; [key: string]: any } | null
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

    const orderTyped = order as { order_date?: string; user_id?: string; menu_item_id?: number; quantity?: number; [key: string]: any }

    // 注文を物理削除（Service Role Keyを使用してRLSをバイパス）
    const { error: deleteError } = await (supabaseAdmin
      .from("orders") as any)
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
