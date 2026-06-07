import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'wfabdmfgngjtihhlrrpk.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

// PWA Service Worker（serwist）
// @serwist/next（クラシックモード）は nextConfig.webpack を注入するため、
// Next.js 16 デフォルトの Turbopack と衝突する。SW生成には webpack ビルドが必須なので
// 本番ビルド（npm run build = next build --webpack）でのみラップする。
// dev は Turbopack のまま（SWは元々 dev で無効化する設計）でクリーンに動かす。
const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // 開発中はSWを無効化（キャッシュ地獄・「変えたのに反映されない」事故の回避）
  disable: process.env.NODE_ENV === "development",
  // オンライン復帰時の強制リロードを抑制（SaaSで予期せぬ再読込を防ぐ）
  reloadOnOnline: false,
  // 自動登録をオフにし、@serwist/window で手動登録する（更新検知=waiting購読のため）
  register: false,
});

// next build（NODE_ENV=production）のときだけ serwist を適用する
export default process.env.NODE_ENV === "production"
  ? withSerwist(nextConfig)
  : nextConfig;
