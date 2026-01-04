"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CancelOrderButtonProps {
  orderId: number;
  orderDate: string;
}

/**
 * 注文キャンセルボタンコンポーネント
 */
export default function CancelOrderButton({
  orderId,
  orderDate,
}: CancelOrderButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleCancel = async () => {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        // エラーメッセージを表示（特に締切時間を過ぎた場合のメッセージ）
        const errorMessage = data.error || "キャンセルに失敗しました";
        setError(errorMessage);
        setLoading(false);
        setShowConfirm(false);
        return;
      }

      // キャンセル成功後、ページをリフレッシュ
      router.refresh();
    } catch (err) {
      console.error("Cancel error:", err);
      setError("キャンセル処理中にエラーが発生しました");
      setLoading(false);
      setShowConfirm(false);
    }
  };

  if (showConfirm) {
    return (
      <div className="flex flex-col gap-2">
        {error && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-medium">
            {error}
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowConfirm(false);
              setError(null);
            }}
            className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleCancel}
            disabled={loading}
            className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "処理中..." : "確定"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleCancel}
      className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
    >
      キャンセル
    </button>
  );
}
