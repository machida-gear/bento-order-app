"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Database } from "@/lib/database.types";
import { useRouter } from "next/navigation";

type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"] & {
  actor: {
    id: string;
    employee_code: string;
    full_name: string;
  } | null;
};

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * 監査ログ閲覧画面
 */
export default function AdminLogsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    action: "",
    target_table: "",
    start_date: "",
    end_date: "",
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  // プロフィール取得と管理者権限チェック
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profileError || !profileData) {
          setError("プロフィールの取得に失敗しました");
          return;
        }

        if (profileData.role !== "admin") {
          router.push("/calendar");
          return;
        }

        setProfile(profileData);
      } catch (err) {
        console.error("Profile fetch error:", err);
        setError("データの取得中にエラーが発生しました");
      }
    };

    fetchProfile();
  }, [supabase, router]);

  // ログ取得
  const fetchLogs = async (page: number = 1) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
      });

      if (filters.action) {
        params.append("action", filters.action);
      }
      if (filters.target_table) {
        params.append("target_table", filters.target_table);
      }
      if (filters.start_date) {
        params.append("start_date", filters.start_date);
      }
      if (filters.end_date) {
        params.append("end_date", filters.end_date);
      }

      const response = await fetch(`/api/admin/logs?${params.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "ログの取得に失敗しました");
        return;
      }

      setLogs(result.data || []);
      setPagination(result.pagination || pagination);
    } catch (err) {
      console.error("Fetch error:", err);
      setError("データの取得中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  // フィルタ変更時にログを再取得
  useEffect(() => {
    if (profile) {
      fetchLogs(1);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }
  }, [filters, profile]);

  // アクション種別のリスト
  const actionTypes = [
    "order.create",
    "order.create.admin",
    "order.update",
    "order.update.admin",
    "order.cancel",
    "order.cancel.admin",
    "price.create",
    "price.update",
    "price.delete",
    "vendor.create",
    "vendor.update",
    "vendor.delete",
    "menu.create",
    "menu.update",
    "menu.delete",
    "calendar.update",
    "settings.update",
    "user.update",
    "user.delete",
    "auto_order.run",
  ];

  // テーブル名のリスト
  const tableTypes = [
    "orders",
    "menu_prices",
    "vendors",
    "menu_items",
    "order_calendar",
    "system_settings",
    "profiles",
    "auto_order_runs",
  ];

  // アクション名の表示用変換
  const formatAction = (action: string) => {
    const actionMap: Record<string, string> = {
      "order.create": "注文作成",
      "order.create.admin": "注文作成（管理者）",
      "order.update": "注文更新",
      "order.update.admin": "注文更新（管理者）",
      "order.cancel": "注文キャンセル",
      "order.cancel.admin": "注文キャンセル（管理者）",
      "price.create": "価格作成",
      "price.update": "価格更新",
      "price.delete": "価格削除",
      "vendor.create": "業者作成",
      "vendor.update": "業者更新",
      "vendor.delete": "業者削除",
      "menu.create": "メニュー作成",
      "menu.update": "メニュー更新",
      "menu.delete": "メニュー削除",
      "calendar.update": "カレンダー更新",
      "settings.update": "システム設定更新",
      "user.update": "ユーザー更新",
      "user.delete": "ユーザー削除",
      "auto_order.run": "自動注文実行",
    };
    return actionMap[action] || action;
  };

  // 日時の表示形式
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📝 操作ログ</h1>
          <p className="text-gray-500 mt-1">
            システム内のすべての重要な操作を記録しています
          </p>
        </div>
        <a
          href="/admin"
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
        >
          ダッシュボードに戻る
        </a>
      </div>

            {/* フィルタ */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    アクション種別
                  </label>
                  <select
                    value={filters.action}
                    onChange={(e) =>
                      setFilters({ ...filters, action: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  >
                    <option value="">すべて</option>
                    {actionTypes.map((action) => (
                      <option key={action} value={action}>
                        {formatAction(action)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    対象テーブル
                  </label>
                  <select
                    value={filters.target_table}
                    onChange={(e) =>
                      setFilters({ ...filters, target_table: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  >
                    <option value="">すべて</option>
                    {tableTypes.map((table) => (
                      <option key={table} value={table}>
                        {table}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    開始日
                  </label>
                  <input
                    type="date"
                    value={filters.start_date}
                    onChange={(e) =>
                      setFilters({ ...filters, start_date: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    終了日
                  </label>
                  <input
                    type="date"
                    value={filters.end_date}
                    onChange={(e) =>
                      setFilters({ ...filters, end_date: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* フィルタリセットボタン */}
              {(filters.action ||
                filters.target_table ||
                filters.start_date ||
                filters.end_date) && (
                <div className="mt-4">
                  <button
                    onClick={() =>
                      setFilters({
                        action: "",
                        target_table: "",
                        start_date: "",
                        end_date: "",
                      })
                    }
                    className="text-sm text-amber-600 hover:text-amber-700 underline"
                  >
                    フィルタをリセット
                  </button>
                </div>
              )}
            </div>

            {/* エラーメッセージ */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                {error}
              </div>
            )}

            {/* ログ一覧 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-gray-500">
                  読み込み中...
                </div>
              ) : logs.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  ログがありません
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            日時
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            実行ユーザー
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            アクション
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            対象テーブル
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            対象ID
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            詳細
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {logs.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {formatDateTime(log.created_at)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {log.actor ? (
                                <div>
                                  <div className="font-medium">
                                    {log.actor.full_name}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {log.actor.employee_code}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {formatAction(log.action)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {log.target_table || "-"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {log.target_id || "-"}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {log.details ? (
                                <details className="cursor-pointer">
                                  <summary className="text-amber-600 hover:text-amber-700">
                                    詳細
                                  </summary>
                                  <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                                    {JSON.stringify(log.details, null, 2)}
                                  </pre>
                                </details>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* ページネーション */}
                  {pagination.totalPages > 1 && (
                    <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                      <div className="text-sm text-gray-700">
                        {pagination.total}件中{" "}
                        {(pagination.page - 1) * pagination.limit + 1}〜
                        {Math.min(
                          pagination.page * pagination.limit,
                          pagination.total
                        )}
                        件を表示
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => fetchLogs(pagination.page - 1)}
                          disabled={pagination.page === 1}
                          className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                          前へ
                        </button>
                        <span className="px-3 py-1 text-sm text-gray-700">
                          {pagination.page} / {pagination.totalPages}
                        </span>
                        <button
                          onClick={() => fetchLogs(pagination.page + 1)}
                          disabled={pagination.page >= pagination.totalPages}
                          className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                          次へ
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
    </div>
  );
}
