"use client";

// プッシュ通知の オン/オフ トグル（マイプロフィールに設置）
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Bell, BellOff } from "lucide-react";

// VAPID公開鍵(base64url) → Uint8Array（pushManager.subscribe 用）
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

type PermState = "default" | "granted" | "denied";

export function PushToggle() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  // ブラウザ/OSの通知許可状態。"denied" は一度「許可しない」を選んだ状態で、
  // requestPermission() を呼んでも再びダイアログは出ない（設定からの解除が必要）。
  const [permission, setPermission] = useState<PermState>("default");
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && !!vapid;
    setSupported(ok);
    if (!ok) return;
    setPermission(Notification.permission as PermState);
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {});
  }, [vapid]);

  const enable = async () => {
    if (!vapid) {
      toast.error("通知の設定が未完了です（管理者に連絡してください）");
      return;
    }
    setBusy(true);
    try {
      const result = (await Notification.requestPermission()) as PermState;
      setPermission(result);
      if (result === "denied") {
        // 一度「許可しない」を選ぶと再度ダイアログは出ない。設定からの解除を案内（下の案内UIに切替）。
        toast.error("通知がブロックされています。端末の設定から許可してください");
        return;
      }
      if (result !== "granted") {
        // "default"（ダイアログを閉じた等）。再度ボタンを押せば再試行できる。
        toast.error("通知が許可されませんでした");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid) as unknown as BufferSource,
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), userAgent: navigator.userAgent }),
      });
      if (!res.ok) throw new Error("save failed");
      setSubscribed(true);
      toast.success("通知をオンにしました");
    } catch {
      toast.error("通知をオンにできませんでした");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success("通知をオフにしました");
    } catch {
      toast.error("通知をオフにできませんでした");
    } finally {
      setBusy(false);
    }
  };

  if (!supported) {
    return (
      <p className="text-sm text-muted-foreground m-0 leading-relaxed">
        この端末/ブラウザでは通知に対応していません。iPhone の場合は、ホーム画面に追加したアプリ（PWA）から開くと利用できます。
      </p>
    );
  }

  // 一度「許可しない」を選んだ状態。ボタンを押しても再ダイアログは出ないので、
  // 設定からの解除手順を案内する（購読中＝subscribed のときは通常のオフ操作を優先）。
  if (permission === "denied" && !subscribed) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-amber-800">
          <BellOff className="size-4 shrink-0" />
          通知がブロックされています
        </div>
        <p className="mt-2 text-sm text-amber-800 leading-relaxed m-0">
          以前に「許可しない」を選んだため、このボタンからはオンにできません。お使いの端末の設定から通知を許可してください。
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-amber-800 leading-relaxed">
          <li>
            <span className="font-semibold">iPhone：</span>
            設定 → 通知 →（このアプリ）→「通知を許可」をオン
          </li>
          <li>
            <span className="font-semibold">パソコン：</span>
            アドレスバーの🔒（鍵）アイコン → 通知 →「許可」
          </li>
        </ul>
        <p className="mt-3 text-sm text-amber-800/80 leading-relaxed m-0">
          設定を変更したら、この画面を再読み込みしてから「通知をオンにする」を押してください。
        </p>
      </div>
    );
  }

  return subscribed ? (
    <Button variant="outline" onClick={disable} disabled={busy} className="h-11">
      <BellOff className="mr-2 size-4" />
      通知をオフにする
    </Button>
  ) : (
    <Button onClick={enable} disabled={busy} className="h-11">
      <Bell className="mr-2 size-4" />
      通知をオンにする
    </Button>
  );
}
