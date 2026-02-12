import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkitをバンドル対象から除外し、node_modulesにそのまま保持する
  // pdfkitは実行時に自身のパッケージ内の.afmフォントファイルを読み込むが、
  // Next.jsのバンドラーはJSファイルのみをバンドルし、.afmデータファイルを除外してしまう
  // serverExternalPackagesに指定することで、pdfkitはnode_modulesから直接読み込まれ、
  // 全てのファイル（.afm含む）が保持される
  serverExternalPackages: ['pdfkit'],
  // 日本語フォントファイル（public/fonts/）をサーバーレス関数から参照可能にする
  outputFileTracingIncludes: {
    '/api/admin/orders/today/pdf': ['./public/fonts/**/*'],
    '/api/admin/orders/today/order-list-pdf': ['./public/fonts/**/*'],
  },
};

export default nextConfig;
