/**
 * データベース接続関連のユーティリティ
 */

/**
 * DATABASE_URL環境変数を取得
 * サーバーサイドでのみ使用可能
 * 
 * @returns DATABASE_URLの値
 * @throws Error DATABASE_URLが設定されていない場合
 */
export function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL environment variable is not set. " +
      "Please set DATABASE_URL in your Vercel project settings or .env.local file."
    );
  }

  return databaseUrl;
}

/**
 * DATABASE_URL環境変数を安全に取得（オプショナル）
 * サーバーサイドでのみ使用可能
 * 
 * @returns DATABASE_URLの値、またはundefined
 */
export function getDatabaseUrlOptional(): string | undefined {
  return process.env.DATABASE_URL;
}
