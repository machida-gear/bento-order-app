import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * 注文者変更API（管理者専用）
 * PATCH /api/admin/orders/[id]/change-user
 * 締切時間を過ぎた後でも、管理者が注文者を変更できる
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

    // 管理者権限チェック
    const { data: currentProfile, error: currentProfileError } =
      await supabaseAdmin
        .from("profiles")
        .select("role, is_active")
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
      is_active?: boolean;
      [key: string]: any;
    } | null;

    if (currentProfileTyped?.role !== "admin") {
      return NextResponse.json(
        { error: "管理者権限が必要です" },
        { status: 403 }
      );
    }

    if (!currentProfileTyped?.is_active) {
      return NextResponse.json(
        { error: "アカウントが無効化されています" },
        { status: 403 }
      );
    }

    const resolvedParams = await Promise.resolve(params);
    const orderId = parseInt(resolvedParams.id, 10);

    if (isNaN(orderId)) {
      return NextResponse.json({ error: "注文IDが無効です" }, { status: 400 });
    }

    const { new_user_id } = await request.json();

    if (!new_user_id) {
      return NextResponse.json(
        { error: "新しいユーザーIDは必須です" },
        { status: 400 }
      );
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
      status?: string;
      user_id?: string;
      order_date?: string;
      menu_item_id?: number;
      quantity?: number;
      [key: string]: any;
    };

    // キャンセル済みの注文は変更不可
    if (orderTyped.status === "canceled") {
      return NextResponse.json(
        { error: "キャンセル済みの注文は変更できません" },
        { status: 400 }
      );
    }

    // 新しいユーザーの存在確認
    const { data: newUser, error: newUserError } = await supabaseAdmin
      .from("profiles")
      .select("id, employee_code, full_name, is_active, left_date")
      .eq("id", new_user_id)
      .single();

    if (newUserError || !newUser) {
      return NextResponse.json(
        { error: "新しいユーザーが見つかりません" },
        { status: 404 }
      );
    }

    const newUserTyped = newUser as {
      is_active?: boolean;
      left_date?: string | null;
      employee_code?: string;
      full_name?: string;
      [key: string]: any;
    };

    // 新しいユーザーが有効かチェック
    if (!newUserTyped.is_active) {
      return NextResponse.json(
        { error: "新しいユーザーは無効化されています" },
        { status: 400 }
      );
    }

    // 退職日が過去の場合は不可
    if (newUserTyped.left_date) {
      const leftDate = new Date(newUserTyped.left_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      leftDate.setHours(0, 0, 0, 0);

      if (leftDate < today) {
        return NextResponse.json(
          { error: "新しいユーザーは退職済みです" },
          { status: 400 }
        );
      }
    }

    // 同じユーザーへの変更は不要
    if (orderTyped.user_id === new_user_id) {
      return NextResponse.json(
        { error: "同じユーザーへの変更は不要です" },
        { status: 400 }
      );
    }

    // 古いユーザー情報を取得（監査ログ用）
    const { data: oldUser } = orderTyped.user_id
      ? await supabaseAdmin
          .from("profiles")
          .select("id, employee_code, full_name")
          .eq("id", orderTyped.user_id)
          .single()
      : { data: null };

    const oldUserTyped = oldUser as {
      employee_code?: string;
      full_name?: string;
      [key: string]: any;
    } | null;

    // 注文のuser_idを更新（Service Role Keyを使用してRLSをバイパス）
    const { error: updateError, data: updatedOrder } = await (
      supabaseAdmin.from("orders") as any
    )
      .update({ user_id: new_user_id })
      .eq("id", orderId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        {
          error: "注文者の変更に失敗しました",
          details: updateError.message || updateError.details || "Unknown error",
        },
        { status: 500 }
      );
    }

    // 監査ログ記録
    try {
      await (supabaseAdmin.from("audit_logs") as any).insert({
        actor_id: user.id, // 操作した管理者のID
        action: "order.change_user.admin",
        details: {
          order_id: orderId,
          order_date: orderTyped.order_date,
          menu_item_id: orderTyped.menu_item_id,
          quantity: orderTyped.quantity,
          old_user_id: orderTyped.user_id,
          old_employee_code: oldUserTyped?.employee_code || null,
          old_full_name: oldUserTyped?.full_name || null,
          new_user_id: new_user_id,
          new_employee_code: newUserTyped.employee_code || null,
          new_full_name: newUserTyped.full_name || null,
          changed_by_admin: true,
        },
        target_table: "orders",
        target_id: orderId.toString(),
      });
    } catch (auditLogError) {
      // 監査ログの記録エラーは無視（変更は成功しているため）
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: "注文者を変更しました",
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "注文者変更処理中にエラーが発生しました: " + errorMessage,
      },
      { status: 500 }
    );
  }
}
