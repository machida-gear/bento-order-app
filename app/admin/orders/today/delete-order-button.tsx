"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DeleteOrderButtonProps {
  orderId: number;
  orderDate: string;
  userName: string;
}

/**
 * 注文削除ボタンコンポーネント（管理者のみ）
 */
export default function DeleteOrderButton({
  orderId,
  orderDate,
  userName,
}: DeleteOrderButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || "削除に失敗しました";
        setError(errorMessage);
        setLoading(false);
        setShowConfirm(false);
        return;
      }

      // 削除成功後、ページをリフレッシュ
      router.refresh();
    } catch (err) {
      setError("削除処理中にエラーが発生しました");
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
        <div className="text-xs text-gray-600 mb-1">
          {userName}さんの{orderDate}の注文を削除しますか？
        </div>
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
            onClick={handleDelete}
            disabled={loading}
            className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "削除中..." : "削除確定"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleDelete}
      className="text-xs text-red-600 hover:text-red-800 hover:underline"
    >
      削除
    </button>
  );
}
