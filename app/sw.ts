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

// ── Supabase（REST・Auth 等）もネットワーク直行 ──
// defaultCache の cross-origin ルール（NetworkFirst・10秒で打ち切り・最大32件）に任せると、
// - 認証付きの応答がディスクに残る
// - 通信が10秒を超えると古い応答が返る（投稿直後の取り直しに「投稿0件」の古い一覧が返ると、空のままに見える）
// 公開ストレージの画像だけは従来どおりキャッシュしてよい。
const supabaseBypass: RuntimeCaching = {
  matcher: ({ url }) =>
    url.hostname.endsWith(".supabase.co") && !url.pathname.startsWith("/storage/v1/object/public/"),
  handler: new NetworkOnly(),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // 新SWを待機させず即時有効化する。
  // 以前は skipWaiting:false にして「新しいバージョンがあります／更新」の
  // トーストを出していたが、押しても押さなくても次の遷移で反映されるもので、
  // 利用者に判断させる意味が無いのでやめた（components/pwa/PWARegister.tsx と対）。
  // 開きっぱなしのタブが古いチャンクを取りに行って失敗する分は、
  // PWARegister の ChunkLoadError リカバリが黙って読み直す。
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // 認証バイパスを先頭に。残りは Next.js 最適化済みの defaultCache
  // （静的資産=CacheFirst/SWR、公開ページHTML=NetworkFirst 等）に委ねる。
  runtimeCaching: [authBypass, supabaseBypass, ...defaultCache],
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

// 以前の版が cross-origin キャッシュに残した Supabase の応答を消す（認証付きの内容をディスクに残さない）
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.open("cross-origin").then(async (cache) => {
      const keys = await cache.keys();
      await Promise.all(
        keys
          .filter((req) => {
            const url = new URL(req.url);
            return url.hostname.endsWith(".supabase.co") && !url.pathname.startsWith("/storage/v1/object/public/");
          })
          .map((req) => cache.delete(req)),
      );
    }),
  );
});

// ── Web Push（お知らせ等の通知）──
// 送信ペイロード: { title, body, url }
self.addEventListener("push", (event) => {
  let payload: { title?: string; body?: string; url?: string } = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { title: "branding.bz", body: event.data.text() };
    }
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "branding.bz", {
      body: payload.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url || "/portal/announcements" },
    }),
  );
});

// 通知タップ: 既存のウィンドウがあればフォーカスして遷移、なければ新規に開く
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url: string =
    (event.notification.data && (event.notification.data as { url?: string }).url) ||
    "/portal/announcements";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const wc = client as WindowClient;
        if ("focus" in wc) {
          wc.navigate?.(url);
          return wc.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
