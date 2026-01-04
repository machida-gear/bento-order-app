import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * 監査ログ一覧取得API
 * GET /api/admin/logs
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 管理者権限チェック
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "プロフィールの取得に失敗しました" },
        { status: 500 }
      );
    }

    if (profile.role !== "admin") {
      return NextResponse.json(
        { error: "管理者権限が必要です" },
        { status: 403 }
      );
    }

    // クエリパラメータを取得
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || null;
    const targetTable = searchParams.get("target_table") || null;
    const startDate = searchParams.get("start_date") || null;
    const endDate = searchParams.get("end_date") || null;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = (page - 1) * limit;

    // ログ取得（Service Role Keyを使用）
    let query = supabaseAdmin
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // フィルタ適用
    if (action) {
      query = query.eq("action", action);
    }
    if (targetTable) {
      query = query.eq("target_table", targetTable);
    }
    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      // 終了日時はその日の23:59:59まで
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      query = query.lte("created_at", endDateTime.toISOString());
    }

    const { data: logs, error: logsError, count } = await query;

    if (logsError) {
      console.error("Logs fetch error:", logsError);
      return NextResponse.json(
        { error: "ログの取得に失敗しました" },
        { status: 500 }
      );
    }

    // ユーザー情報を取得して結合
    const logsWithActor = await Promise.all(
      (logs || []).map(async (log) => {
        if (!log.actor_id) {
          return { ...log, actor: null };
        }

        const { data: actorProfile, error: actorError } = await supabaseAdmin
          .from("profiles")
          .select("id, employee_code, full_name")
          .eq("id", log.actor_id)
          .maybeSingle();

        // エラーが発生した場合やユーザーが見つからない場合はnullを返す
        if (actorError || !actorProfile) {
          return { ...log, actor: null };
        }

        return {
          ...log,
          actor: actorProfile,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: logsWithActor || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
