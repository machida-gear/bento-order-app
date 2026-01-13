/**
 * ブラウザ（クライアントコンポーネント）用 Supabase クライアント
 * 'use client' が必要なコンポーネントで使用
 */
import { createBrowserClient } from "@supabase/ssr";
import { Database } from "../database.types";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Supabase SSR のデフォルト設定に合わせる（cookie名等を上書きしない）
  // ※ここを上書きすると、サーバー/ミドルウェア側とセッションが不整合になりやすい
  return createBrowserClient<Database>(supabaseUrl!, supabaseAnonKey!);
}
