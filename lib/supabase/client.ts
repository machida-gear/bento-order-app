/**
 * ブラウザ（クライアントコンポーネント）用 Supabase クライアント
 * 'use client' が必要なコンポーネントで使用
 */
import { createBrowserClient } from '@supabase/ssr'
import { Database } from '../database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

