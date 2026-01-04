"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

/**
 * ログインページ
 * メールアドレス + パスワード認証
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState(""); // 新規登録用：氏名
  const [employeeCode, setEmployeeCode] = useState(""); // 新規登録用：社員コード
  const [invitationCode, setInvitationCode] = useState(""); // 新規登録用：招待コード
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      // プロフィールを取得して承認状態をチェック
      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_active")
          .eq("id", data.user.id)
          .single();

        if (profile && !(profile as { is_active: boolean }).is_active) {
          // 承認待ちの場合はログアウトしてメッセージを表示
          await supabase.auth.signOut();
          setError(
            "アカウントは管理者の承認待ちです。承認が完了するまでお待ちください。"
          );
          return;
        }
      }

      // ログイン成功 → カレンダーページへ
      router.push("/calendar");
      router.refresh();
    } catch {
      setError("ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      // バリデーション
      if (!name.trim()) {
        setError("氏名を入力してください");
        return;
      }
      if (!employeeCode.trim() || employeeCode.length !== 4) {
        setError("社員コードは4桁で入力してください");
        return;
      }
      if (!invitationCode.trim()) {
        setError("招待コードを入力してください");
        return;
      }

      // サーバーサイドのAPI Routeを呼び出してサインアップ処理
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          name: name.trim(),
          employeeCode: employeeCode.trim(),
          invitationCode: invitationCode.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "登録に失敗しました");
        return;
      }

      if (data.pending_approval) {
        setSuccess(
          "アカウントを作成しました。管理者の承認をお待ちください。承認が完了すると、ログインできるようになります。"
        );
      } else {
        setSuccess(
          data.message + " メールのリンクをクリックして登録を完了してください。"
        );
      }
      // フォームをクリア
      setEmail("");
      setPassword("");
      setName("");
      setEmployeeCode("");
      setInvitationCode("");
    } catch (err) {
      console.error("Signup error:", err);
      setError("登録処理中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (!email) {
        setError("メールアドレスを入力してください");
        return;
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/login?reset=true`,
        }
      );

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSuccess(
        "パスワードリセットメールを送信しました。メールのリンクをクリックしてパスワードをリセットしてください。"
      );
      setEmail("");
    } catch (err) {
      console.error("Reset password error:", err);
      setError("パスワードリセット処理中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
      <div className="w-full max-w-md p-8">
        <div className="bg-white rounded-2xl shadow-xl border border-amber-100 p-8">
          {/* ヘッダー */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 mb-4">
              <span className="text-3xl">🍱</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">
              お弁当注文システム
            </h1>
            <p className="text-gray-500 mt-2">
              {isResetPassword
                ? "パスワードリセット"
                : isSignup
                ? "新規アカウント登録"
                : "ログインしてください"}
            </p>
          </div>

          {/* エラーメッセージ */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* 成功メッセージ */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {success}
            </div>
          )}

          {/* ログインフォーム / 新規登録フォーム / パスワードリセットフォーム */}
          <form
            onSubmit={
              isResetPassword
                ? handleResetPassword
                : isSignup
                ? handleSignup
                : handleLogin
            }
            className="space-y-5"
          >
            {isSignup && (
              <>
                <div>
                  <label
                    htmlFor="invitationCode"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    招待コード（4桁） <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="invitationCode"
                    type="text"
                    value={invitationCode}
                    onChange={(e) => {
                      // 数字のみ入力可能、最大4文字
                      const value = e.target.value
                        .replace(/[^0-9]/g, "")
                        .slice(0, 4);
                      setInvitationCode(value);
                    }}
                    required
                    maxLength={4}
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-colors outline-none"
                    placeholder="0000"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    管理者から提供された4桁の数字の招待コードを入力してください
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    氏名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-colors outline-none"
                    placeholder="山田 太郎"
                  />
                </div>
                <div>
                  <label
                    htmlFor="employeeCode"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    社員コード（4桁） <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="employeeCode"
                    type="text"
                    value={employeeCode}
                    onChange={(e) => {
                      // 数字のみ入力可能、最大4文字
                      const value = e.target.value
                        .replace(/[^0-9]/g, "")
                        .slice(0, 4);
                      setEmployeeCode(value);
                    }}
                    required
                    maxLength={4}
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-colors outline-none"
                    placeholder="0001"
                  />
                </div>
              </>
            )}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-colors outline-none"
                placeholder="example@company.com"
              />
            </div>

            {!isResetPassword && (
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  パスワード
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-colors outline-none"
                  placeholder="••••••••"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? isResetPassword
                  ? "送信中..."
                  : isSignup
                  ? "登録中..."
                  : "ログイン中..."
                : isResetPassword
                ? "リセットメールを送信"
                : isSignup
                ? "新規登録"
                : "ログイン"}
            </button>
          </form>

          {/* ログイン/新規登録/パスワードリセット 切り替え */}
          <div className="mt-6 space-y-2 text-center">
            {!isResetPassword && (
              <button
                type="button"
                onClick={() => {
                  setIsSignup(!isSignup);
                  setError(null);
                  setSuccess(null);
                  // フォームをクリア
                  setName("");
                  setEmployeeCode("");
                  setInvitationCode("");
                }}
                className="text-sm text-amber-600 hover:text-amber-700 font-medium block"
              >
                {isSignup
                  ? "すでにアカウントをお持ちの方はこちら"
                  : "アカウントをお持ちでない方はこちら"}
              </button>
            )}
            {!isSignup && (
              <button
                type="button"
                onClick={() => {
                  setIsResetPassword(!isResetPassword);
                  setError(null);
                  setSuccess(null);
                  setPassword("");
                }}
                className="text-sm text-amber-600 hover:text-amber-700 font-medium block"
              >
                {isResetPassword
                  ? "ログインに戻る"
                  : "パスワードを忘れた方はこちら"}
              </button>
            )}
          </div>
        </div>

        {/* フッター */}
        <p className="text-center text-gray-400 text-sm mt-6">
          © 2024 お弁当注文システム
        </p>
      </div>
    </div>
  );
}
