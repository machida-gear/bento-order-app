"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * ユーザー管理画面
 */
export default function AdminUsersPage() {
  const supabase = createClient();
  const [users, setUsers] = useState<Profile[]>([]);
  const [pendingUsers, setPendingUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'inactive' | 'pending'>('active');
  const [formData, setFormData] = useState({
    employee_code: "",
    full_name: "",
    email: "",
    role: "user" as "user" | "admin",
    joined_date: "",
    left_date: "",
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  // ユーザー一覧を取得
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/admin/users");
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "ユーザー一覧の取得に失敗しました");
        return;
      }

      setUsers(result.data || []);
    } catch (err) {
      console.error("Fetch error:", err);
      setError("データの取得中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  // 承認待ちユーザー一覧を取得
  const fetchPendingUsers = async () => {
    try {
      const response = await fetch("/api/admin/users/pending");
      const result = await response.json();

      if (!response.ok) {
        console.error("Pending users fetch error:", result.error);
        return;
      }

      setPendingUsers(result.data || []);
    } catch (err) {
      console.error("Pending users fetch error:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchPendingUsers();
    
    // URLパラメータでpending=trueの場合は承認待ちタブを表示
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('pending') === 'true') {
      setActiveTab('pending');
    }
  }, []);

  // フォームをリセット
  const resetForm = () => {
    setFormData({
      employee_code: "",
      full_name: "",
      email: "",
      role: "user",
      joined_date: "",
      left_date: "",
      is_active: true,
    });
    setIsEditing(false);
    setEditingId(null);
    setError(null);
  };

  // 編集ボタン
  const handleEdit = (user: Profile) => {
    setFormData({
      employee_code: user.employee_code,
      full_name: user.full_name,
      email: user.email || "",
      role: user.role,
      joined_date: user.joined_date || "",
      left_date: user.left_date || "",
      is_active: user.is_active,
    });
    setEditingId(user.id);
    setIsEditing(true);
    setError(null);
  };

  // 保存
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      // バリデーション
      if (!formData.employee_code || !formData.full_name) {
        setError("社員コードと氏名は必須です");
        return;
      }

      // 社員コードは4桁の数字
      if (!/^\d{4}$/.test(formData.employee_code)) {
        setError("社員コードは4桁の数字で入力してください");
        return;
      }

      const url = editingId
        ? `/api/admin/users/${editingId}`
        : "/api/admin/users";
      const method = editingId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          joined_date: formData.joined_date || null,
          left_date: formData.left_date || null,
          email: formData.email || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "保存に失敗しました");
        return;
      }

      // 一覧を再取得
      await fetchUsers();
      await fetchPendingUsers();
      resetForm();
    } catch (err) {
      console.error("Save error:", err);
      setError("保存中にエラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  // 承認
  const handleApprove = async (id: string) => {
    if (!confirm("このユーザーを承認しますか？")) {
      return;
    }

    try {
      setError(null);

      const response = await fetch(`/api/admin/users/${id}/approve`, {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "承認に失敗しました");
        return;
      }

      // 一覧を再取得
      await fetchUsers();
      await fetchPendingUsers();
    } catch (err) {
      console.error("Approve error:", err);
      setError("承認中にエラーが発生しました");
    }
  };

  // 承認待ちユーザーの削除（拒否）
  const handleReject = async (id: string) => {
    if (!confirm("この承認待ちユーザーを削除（拒否）しますか？\nこの操作は取り消せません。")) {
      return;
    }

    try {
      setError(null);

      const response = await fetch(`/api/admin/users/${id}/reject`, {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "削除に失敗しました");
        return;
      }

      // 一覧を再取得
      await fetchUsers();
      await fetchPendingUsers();
    } catch (err) {
      console.error("Reject error:", err);
      setError("削除中にエラーが発生しました");
    }
  };

  // 削除（is_active=false）
  const handleDelete = async (id: string) => {
    if (!confirm("このユーザーを無効化しますか？")) {
      return;
    }

    try {
      setError(null);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/31bb64a1-4cff-45b1-a971-f1576e521fb8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/users/page.tsx:237',message:'handleDelete: Before DELETE request',data:{userId:id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      const response = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
      });

      const result = await response.json();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/31bb64a1-4cff-45b1-a971-f1576e521fb8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/users/page.tsx:243',message:'handleDelete: After DELETE response',data:{userId:id,ok:response.ok,result},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion

      if (!response.ok) {
        setError(result.error || "削除に失敗しました");
        return;
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/31bb64a1-4cff-45b1-a971-f1576e521fb8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/users/page.tsx:250',message:'handleDelete: Before fetchUsers',data:{userId:id},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      // 一覧を再取得（承認待ちリストも更新）
      await fetchUsers();
      await fetchPendingUsers();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/31bb64a1-4cff-45b1-a971-f1576e521fb8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/users/page.tsx:253',message:'handleDelete: After fetchUsers and fetchPendingUsers',data:{userId:id},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
    } catch (err) {
      console.error("Delete error:", err);
      setError("削除中にエラーが発生しました");
    }
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">👥 ユーザー管理</h1>
          <p className="text-gray-500 mt-1">ユーザーの編集・削除・承認</p>
        </div>
        <a
          href="/admin"
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
        >
          ダッシュボードに戻る
        </a>
      </div>

      {/* タブ切り替え */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'active'
              ? "text-amber-600 border-b-2 border-amber-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          有効なユーザー ({users.filter(u => u.is_active).length})
        </button>
        <button
          onClick={() => setActiveTab('inactive')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'inactive'
              ? "text-amber-600 border-b-2 border-amber-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          無効なユーザー ({users.filter(u => !u.is_active && u.left_date).length})
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 font-medium transition-colors relative ${
            activeTab === 'pending'
              ? "text-amber-600 border-b-2 border-amber-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          承認待ち
          {pendingUsers.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs font-bold text-white bg-orange-500 rounded-full">
              {pendingUsers.length}
            </span>
          )}
        </button>
      </div>

      {/* エラーメッセージ */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <p>{error}</p>
        </div>
      )}

      {/* 編集フォーム */}
      {isEditing && editingId && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            ユーザーを編集
          </h2>

          <div className="space-y-4">
            {/* 社員コード */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                社員コード <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.employee_code}
                onChange={(e) =>
                  setFormData({ ...formData, employee_code: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="例: 0001"
                maxLength={4}
                disabled={saving}
              />
              <p className="mt-1 text-xs text-gray-500">4桁の数字</p>
            </div>

            {/* 氏名 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                氏名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) =>
                  setFormData({ ...formData, full_name: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="例: 山田 太郎"
                disabled={saving}
              />
            </div>

            {/* メールアドレス */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                メールアドレス
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="例: yamada@example.com"
                disabled={saving}
              />
            </div>

            {/* 権限 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                権限 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.role}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    role: e.target.value as "user" | "admin",
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                disabled={saving}
              >
                <option value="user">一般ユーザー</option>
                <option value="admin">管理者</option>
              </select>
            </div>

            {/* 入社日 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                入社日
              </label>
              <input
                type="date"
                value={formData.joined_date}
                onChange={(e) =>
                  setFormData({ ...formData, joined_date: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                disabled={saving}
              />
            </div>

            {/* 退職日 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                退職日
              </label>
              <input
                type="date"
                value={formData.left_date}
                onChange={(e) =>
                  setFormData({ ...formData, left_date: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                disabled={saving}
              />
              <p className="mt-1 text-xs text-gray-500">
                退職日を設定すると、自動的に無効化されます
              </p>
            </div>

            {/* アクティブ状態 */}
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="w-5 h-5 text-amber-600 rounded border-gray-300"
                  disabled={saving}
                />
                <span className="text-sm font-medium text-gray-700">有効</span>
              </label>
            </div>

            {/* ボタン */}
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={
                  saving || !formData.employee_code || !formData.full_name
                }
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? "保存中..." : "保存"}
              </button>
              <button
                onClick={resetForm}
                disabled={saving}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ユーザー一覧 */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          読み込み中...
        </div>
      ) : activeTab === 'pending' ? (
        // 承認待ちユーザー一覧
        pendingUsers.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            承認待ちのユーザーはありません
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      社員コード
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      氏名
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      メール
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      登録日時
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pendingUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {user.employee_code}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {user.full_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {user.email || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {user.created_at
                          ? new Date(user.created_at).toLocaleString("ja-JP")
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApprove(user.id)}
                            className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                          >
                            承認
                          </button>
                          <button
                            onClick={() => handleEdit(user)}
                            className="px-2 py-1 text-xs text-amber-600 hover:bg-amber-50 rounded transition-colors"
                            title="編集"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleReject(user.id)}
                            className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="削除（拒否）"
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : activeTab === 'active' ? (
        // 有効なユーザー一覧
        users.filter(u => u.is_active).length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            有効なユーザーが登録されていません
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      社員コード
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      氏名
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      メール
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      権限
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      入社日
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      退職日
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.filter(u => u.is_active).map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {user.employee_code}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {user.full_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {user.email || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {user.role === "admin" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            管理者
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            一般
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {user.joined_date || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {user.left_date || "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEdit(user)}
                            className="px-2 py-1 text-xs text-amber-600 hover:bg-amber-50 rounded transition-colors"
                            title="編集"
                          >
                            編集
                          </button>
                          <a
                            href={`/calendar?user_id=${user.id}`}
                            className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors inline-block"
                            title="カレンダーを開く"
                          >
                            カレンダー
                          </a>
                          <button
                            onClick={() => handleDelete(user.id)}
                            className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="削除"
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : activeTab === 'inactive' ? (
        // 無効なユーザー一覧（退職者が含まれる）
        users.filter(u => !u.is_active && u.left_date).length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            無効なユーザーが登録されていません
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      社員コード
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      氏名
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      メール
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      権限
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      入社日
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      退職日
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.filter(u => !u.is_active && u.left_date).map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 opacity-75">
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {user.employee_code}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {user.full_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {user.email || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {user.role === "admin" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            管理者
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            一般
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {user.joined_date || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {user.left_date || "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEdit(user)}
                            className="px-2 py-1 text-xs text-amber-600 hover:bg-amber-50 rounded transition-colors"
                            title="編集"
                          >
                            編集
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}
