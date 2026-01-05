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

/**
 * Supabase Authのエラーメッセージを日本語に変換する
 */
export function translateAuthError(message: string): string {
  const errorMessages: { [key: string]: string } = {
    'Invalid login credentials':
      'メールアドレスまたはパスワードが正しくありません',
    'Email not confirmed': 'メールアドレスが確認されていません',
    'User not found': 'ユーザーが見つかりません',
    'Invalid email': 'メールアドレスの形式が正しくありません',
    'Password is too weak': 'パスワードが弱すぎます',
    'Email rate limit exceeded':
      'メール送信の制限を超えました。しばらく時間をおいてから再度お試しください',
    'Signups are disabled': '新規登録が無効になっています',
  }

  // 完全一致するエラーメッセージがあれば日本語に変換
  if (errorMessages[message]) {
    return errorMessages[message]
  }

  // エラーメッセージに特定の文字列が含まれている場合
  const lowerMessage = message.toLowerCase()

  if (lowerMessage.includes('invalid login credentials')) {
    return 'メールアドレスまたはパスワードが正しくありません'
  }
  if (lowerMessage.includes('email not confirmed')) {
    return 'メールアドレスが確認されていません'
  }
  if (lowerMessage.includes('user not found')) {
    return 'ユーザーが見つかりません'
  }
  // メールアドレスの無効エラー（"Email address "xxx" is invalid" の形式）
  if (lowerMessage.includes('is invalid') && lowerMessage.includes('email')) {
    return 'メールアドレスの形式が正しくありません。メールアドレスを確認してください'
  }
  // メールアドレスの無効エラー（"Invalid email" の形式）
  if (lowerMessage.includes('invalid email')) {
    return 'メールアドレスの形式が正しくありません'
  }
  // パスワード関連のエラー
  if (lowerMessage.includes('password') && lowerMessage.includes('weak')) {
    return 'パスワードが弱すぎます'
  }
  // メール送信制限エラー
  if (lowerMessage.includes('rate limit') && lowerMessage.includes('email')) {
    return 'メール送信の制限を超えました。しばらく時間をおいてから再度お試しください'
  }
  // 新規登録無効エラー
  if (lowerMessage.includes('signups are disabled') || lowerMessage.includes('signup disabled')) {
    return '新規登録が無効になっています'
  }

  // それ以外の場合は元のメッセージを返す
  return message
}