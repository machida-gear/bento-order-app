import { NextResponse } from 'next/server'

/**
 * APIエラーの種類
 */
export enum ApiErrorType {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  BAD_REQUEST = 'BAD_REQUEST',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

/**
 * APIエラークラス
 */
export class ApiError extends Error {
  constructor(
    public type: ApiErrorType,
    public message: string,
    public statusCode: number,
    public details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * エラーレスポンスを作成する
 */
export function createErrorResponse(
  error: unknown,
  defaultMessage = 'エラーが発生しました'
): NextResponse {
  // ApiErrorの場合はそのまま使用
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: error.message,
        type: error.type,
        details: error.details,
      },
      { status: error.statusCode }
    )
  }

  // Errorオブジェクトの場合
  if (error instanceof Error) {
    return NextResponse.json(
      {
        error: error.message || defaultMessage,
        type: ApiErrorType.INTERNAL_ERROR,
      },
      { status: 500 }
    )
  }

  // その他の場合
  return NextResponse.json(
    {
      error: defaultMessage,
      type: ApiErrorType.INTERNAL_ERROR,
    },
    { status: 500 }
  )
}

/**
 * 認証エラーレスポンス
 */
export function unauthorizedResponse(message = '認証が必要です'): NextResponse {
  return NextResponse.json(
    { error: message, type: ApiErrorType.UNAUTHORIZED },
    { status: 401 }
  )
}

/**
 * 権限エラーレスポンス
 */
export function forbiddenResponse(message = '権限がありません'): NextResponse {
  return NextResponse.json(
    { error: message, type: ApiErrorType.FORBIDDEN },
    { status: 403 }
  )
}

/**
 * リソース未検出エラーレスポンス
 */
export function notFoundResponse(
  message = 'リソースが見つかりません',
  resource?: string
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      type: ApiErrorType.NOT_FOUND,
      resource,
    },
    { status: 404 }
  )
}

/**
 * バリデーションエラーレスポンス
 */
export function validationErrorResponse(
  message: string,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      type: ApiErrorType.VALIDATION_ERROR,
      details,
    },
    { status: 400 }
  )
}

/**
 * 内部エラーレスポンス
 */
export function internalErrorResponse(
  message = '内部エラーが発生しました',
  details?: unknown
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      type: ApiErrorType.INTERNAL_ERROR,
      details,
    },
    { status: 500 }
  )
}
