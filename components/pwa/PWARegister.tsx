"use client";

// Service Worker の登録 ＋ ChunkLoadError 自動リカバリ
//
// 以前は「新しいバージョンがあります／更新」というトーストを出し、
// ユーザーが押すまで新SWを待機させていた（skipWaiting:false）。
// 更新は押しても押さなくても次の遷移で反映されるもので、
// 利用者に判断させる意味が無いのでやめた。いまは黙って入れ替える
// （app/sw.ts の skipWaiting:true と対）。
import { useEffect } from "react";

export function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // dev では SW を無効化しているので何もしない
    if (process.env.NODE_ENV !== "production") return;

    (async () => {
      const { Serwist } = await import("@serwist/window");
      const serwist = new Serwist("/sw.js", { scope: "/", type: "classic" });
      await serwist.register();
    })();

    // ── ChunkLoadError 自動リカバリ ──
    // 新SWを即時有効化する（skipWaiting:true）ぶん、開きっぱなしのタブが
    // 古いチャンクを取りに行って失敗する可能性は残る。そのときは黙って
    // 読み直す。無限リロードループ防止のため sessionStorage フラグで
    // 「セッション中1回だけ」。
    const onError = (event: ErrorEvent) => {
      const msg = event.message || "";
      if (/ChunkLoadError|Loading chunk \d+ failed|Loading CSS chunk/i.test(msg)) {
        if (!sessionStorage.getItem("chunk-reloaded")) {
          sessionStorage.setItem("chunk-reloaded", "1");
          window.location.reload();
        }
      }
    };
    // 正常表示できたらフラグ解除（次回のデプロイまたぎに備える）
    const onLoad = () => sessionStorage.removeItem("chunk-reloaded");
    window.addEventListener("error", onError);
    window.addEventListener("load", onLoad);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("load", onLoad);
    };
  }, []);

  return null;
}
