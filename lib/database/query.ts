/**
 * 直接PostgreSQL接続を使用したクエリヘルパー
 * Transaction connection (6543)を使用してパフォーマンスを向上
 */

import { getDatabasePool } from './pool';
import { PoolClient } from 'pg';

/**
 * データベースクエリを実行するヘルパー関数
 * 接続の取得と解放を自動的に処理
 * DATABASE_URLが設定されていない場合はエラーをスロー
 * 
 * @param callback クエリを実行する関数
 * @returns クエリの結果
 * @throws Error DATABASE_URLが設定されていない場合
 */
export async function queryDatabase<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getDatabasePool();
  if (!pool) {
    throw new Error(
      "DATABASE_URL environment variable is not set. " +
      "Please set DATABASE_URL in your Vercel project settings or .env.local file."
    );
  }
  const client = await pool.connect();

  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

/**
 * トランザクション内でクエリを実行するヘルパー関数
 * DATABASE_URLが設定されていない場合はエラーをスロー
 * 
 * @param callback トランザクション内で実行する関数
 * @returns トランザクションの結果
 * @throws Error DATABASE_URLが設定されていない場合
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getDatabasePool();
  if (!pool) {
    throw new Error(
      "DATABASE_URL environment variable is not set. " +
      "Please set DATABASE_URL in your Vercel project settings or .env.local file."
    );
  }
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
