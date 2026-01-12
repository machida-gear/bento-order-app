/**
 * Supabase Auth Callback Route
 * PKCEフローのコード交換を処理
 * パスワードリセット、メール確認などのリンクからリダイレクトされる
 */
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/login'
  const type = requestUrl.searchParams.get('type')

  console.log('Auth callback - code:', code ? 'exists' : 'missing', 'type:', type, 'next:', next)

  if (code) {
    const supabase = await createClient()
    
    // PKCEコードをセッションに交換
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('Auth callback error:', error)
      // エラーの場合はログインページにリダイレクト
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin)
      )
    }

    console.log('Auth callback - session exchanged successfully, type:', type)

    // パスワードリセットの場合
    if (type === 'recovery' || next.includes('reset=true')) {
      // パスワード更新画面にリダイレクト
      return NextResponse.redirect(
        new URL('/login?update_password=true', requestUrl.origin)
      )
    }

    // メール確認の場合
    if (type === 'signup' || type === 'email_change') {
      // ログインページにリダイレクト（成功メッセージ付き）
      return NextResponse.redirect(
        new URL('/login?verified=true', requestUrl.origin)
      )
    }

    // その他の場合は指定されたnextパスにリダイレクト
    return NextResponse.redirect(new URL(next, requestUrl.origin))
  }

  // codeがない場合はログインページにリダイレクト
  console.log('Auth callback - no code, redirecting to login')
  return NextResponse.redirect(new URL('/login', requestUrl.origin))
}
