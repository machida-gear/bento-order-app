/**
 * PostgreSQL接続プール（Transaction connection使用）
 * SupabaseのConnection Pooler (ポート6543)を使用してパフォーマンスを向上
 * 
 * 注意: この接続はサーバーサイドでのみ使用可能です
 */

import { Pool } from 'pg';
import { getDatabaseUrlOptional } from '@/lib/utils/database';

let pool: Pool | null = null;

/**
 * PostgreSQL接続プールを取得（シングルトン）
 * Transaction connection (6543)を使用
 * DATABASE_URLが設定されていない場合はnullを返す
 */
export function getDatabasePool(): Pool | null {
  if (!pool) {
    const databaseUrl = getDatabaseUrlOptional();
    if (!databaseUrl) {
      return null;
    }
    
    // DATABASE_URLがTransaction connection (6543)を使用していることを確認
    // 形式: postgresql://postgres:[PASSWORD]@[HOST]:6543/postgres?pgbouncer=true
    if (!databaseUrl.includes(':6543') && !databaseUrl.includes('pgbouncer=true')) {
      console.warn(
        'DATABASE_URL does not appear to use Transaction connection (port 6543). ' +
        'For better performance, use Supabase Connection Pooler with port 6543.'
      );
    }

    pool = new Pool({
      connectionString: databaseUrl,
      // 接続プールの設定
      max: 20, // 最大接続数
      idleTimeoutMillis: 30000, // アイドル接続のタイムアウト（30秒）
      connectionTimeoutMillis: 2000, // 接続タイムアウト（2秒）
    });

    // エラーハンドリング
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  return pool;
}

/**
 * データベース接続をクリーンアップ
 * 主にテストやシャットダウン時に使用
 */
export async function closeDatabasePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
