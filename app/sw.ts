import { defaultCache } from "@serwist/next/worker";
import { Serwist, NetworkOnly } from "serwist";
import type { PrecacheEntry, SerwistGlobalConfig, RuntimeCaching } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

// ── 認証ページ・APIは「絶対にキャッシュしない」──
// runtimeCaching は配列の先頭から評価され、最初にマッチしたハンドラが使われる。
// 認証バイパスを defaultCache より前に置くことで、認証配下のHTML/RSC/APIは
// 常にネットワーク直行（キャッシュ汚染ゼロ）になる。
// オフライン時は NetworkOnly が失敗 → 下の fallbacks が汎用 /offline を返すため、
// 「前ユーザーの認証済み画面」がディスクから出ることは構造的に起こり得ない。
const authBypass: RuntimeCaching = {
  matcher: ({ url, sameOrigin }) =>
    sameOrigin && /^\/(portal|admin|superadmin|api)(\/|$)/.test(url.pathname),
  handler: new NetworkOnly(),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // 認証バイパスを先頭に。残りは Next.js 最適化済みの defaultCache
  // （静的資産=CacheFirst/SWR、公開ページHTML=NetworkFirst 等）に委ねる。
  runtimeCaching: [authBypass, ...defaultCache],
  // オフライン時、document ナビゲーションは /offline にフォールバック
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
