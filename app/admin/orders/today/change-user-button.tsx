'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ChangeOrderUserModal from '@/components/change-order-user-modal'

interface ChangeUserButtonProps {
  orderId: number
  currentUserId: string
  currentUserName: string
}

export default function ChangeUserButton({
  orderId,
  currentUserId,
  currentUserName,
}: ChangeUserButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const router = useRouter()

  const handleSuccess = () => {
    // ページをリフレッシュして最新のデータを表示
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="text-xs text-orange-600 hover:text-orange-800 hover:underline"
        title="注文者を変更"
      >
        変更
      </button>
      <ChangeOrderUserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        orderId={orderId}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        onSuccess={handleSuccess}
      />
    </>
  )
}
