"use client";

// PWA 更新通知 ＋ ChunkLoadError 自動リカバリ
// SWは skipWaiting:false で待機する設計。新バージョン検知→sonnerトースト→
// ユーザーが「更新」を押したら新SWを有効化し、そのタブだけリロードする。
import { useEffect } from "react";
import { toast } from "sonner";

export function PWAUpdatePrompt() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // dev では SW を無効化しているので何もしない
    if (process.env.NODE_ENV !== "production") return;

    let serwist: import("@serwist/window").Serwist | undefined;

    (async () => {
      const { Serwist } = await import("@serwist/window");
      serwist = new Serwist("/sw.js", { scope: "/", type: "classic" });

      // 新SWがインストール済みで待機中 ＝ 新バージョンあり
      serwist.addEventListener("waiting", () => {
        toast("新しいバージョンがあります", {
          description: "更新すると最新の状態でご利用いただけます。",
          duration: Infinity, // ユーザーが操作するまで残す
          // 文字・ボタンを一回り大きく（モバイルで見やすく・押しやすく）
          classNames: {
            title: "!text-base !font-bold",
            description: "!text-sm",
          },
          actionButtonStyle: {
            height: "44px",
            padding: "0 18px",
            fontSize: "15px",
            fontWeight: 700,
            borderRadius: "9999px",
          },
          action: {
            label: "更新",
            onClick: () => {
              // 新SWが制御を取った瞬間にこのタブをリロード
              serwist?.addEventListener("controlling", () => {
                window.location.reload();
              });
              serwist?.messageSkipWaiting();
            },
          },
        });
      });

      await serwist.register();
    })();

    // ── ChunkLoadError 自動リカバリ（保険）──
    // skipWaiting:false で大半は防げるが、SW未登録の初回訪問者がデプロイをまたいだ等の
    // 残ケース用。無限リロードループ防止のため sessionStorage フラグで「セッション中1回だけ」。
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
