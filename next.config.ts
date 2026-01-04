import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16ではTurbopackがデフォルトのため、webpack設定は削除
  // pdfkitのフォント問題は、フォントを指定せずにデフォルト動作に任せることで解決を試みる
};

export default nextConfig;
