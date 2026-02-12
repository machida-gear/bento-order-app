import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercelサーバーレス環境でpdfkitのフォントファイル(.afm)をバンドルに含める
  // pdfkitは実行時にこれらのファイルを読み込むが、Next.jsのツリーシェイキングでは
  // importされていない静的ファイルが除外されるため、明示的に含める必要がある
  outputFileTracingIncludes: {
    '/api/admin/orders/today/pdf': ['./node_modules/pdfkit/js/data/**/*'],
    '/api/admin/orders/today/order-list-pdf': ['./node_modules/pdfkit/js/data/**/*'],
  },
};

export default nextConfig;
