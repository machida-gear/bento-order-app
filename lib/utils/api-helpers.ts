import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  ApiError,
  ApiErrorType,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from './errors'

/**
 * 認証済みユーザーを取得する
 */
export async function getAuthenticatedUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new ApiError(ApiErrorType.UNAUTHORIZED, '認証が必要です', 401)
  }

  return { user, supabase }
}

/**
 * 管理者権限をチェックする
 */
export async function checkAdminPermission(userId: string): Promise<boolean> {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (error || !profile) {
    return false
  }

  const profileTyped = profile as { role?: string; [key: string]: any } | null
  return profileTyped?.role === 'admin'
}

/**
 * 管理者権限が必要な場合のチェック
 */
export async function requireAdmin(userId: string) {
  const isAdmin = await checkAdminPermission(userId)
  if (!isAdmin) {
    throw new ApiError(ApiErrorType.FORBIDDEN, '管理者権限が必要です', 403)
  }
}

/**
 * リクエストボディをパースする
 */
export async function parseRequestBody<T = unknown>(
  request: NextRequest
): Promise<T> {
  try {
    return await request.json()
  } catch (error) {
    throw new ApiError(
      ApiErrorType.BAD_REQUEST,
      'リクエストボディの解析に失敗しました',
      400
    )
  }
}

/**
 * ユーザーのアクティブ状態をチェックする
 */
export async function checkUserActive(userId: string): Promise<{
  isActive: boolean
  leftDate: string | null
}> {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('is_active, left_date')
    .eq('id', userId)
    .single()

  if (error || !profile) {
    throw new ApiError(
      ApiErrorType.NOT_FOUND,
      'ユーザーが見つかりません',
      404
    )
  }

  const profileTyped = profile as { is_active?: boolean; left_date?: string | null; [key: string]: any } | null
  return {
    isActive: profileTyped?.is_active ?? false,
    leftDate: profileTyped?.left_date ?? null,
  }
}

/**
 * 日付が過去でないことをチェックする
 */
export function validateDateNotPast(dateString: string): void {
  const date = new Date(dateString)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)

  if (date < today) {
    throw new ApiError(
      ApiErrorType.VALIDATION_ERROR,
      '過去の日付には注文できません',
      400
    )
  }
}

/**
 * 数量が有効であることをチェックする
 */
export function validateQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new ApiError(
      ApiErrorType.VALIDATION_ERROR,
      '数量は1以上の整数で入力してください',
      400
    )
  }
}
