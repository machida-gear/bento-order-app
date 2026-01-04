/**
 * 共通の型定義
 */

/**
 * APIレスポンスの基本型
 */
export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  type?: string
  details?: unknown
}

/**
 * ページネーション情報
 */
export interface PaginationParams {
  page?: number
  limit?: number
}

export interface PaginationResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/**
 * 日付範囲
 */
export interface DateRange {
  startDate: string
  endDate: string
}

/**
 * ソートオプション
 */
export interface SortOption {
  field: string
  order: 'asc' | 'desc'
}

/**
 * フィルターオプション
 */
export interface FilterOption {
  field: string
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in'
  value: unknown
}
