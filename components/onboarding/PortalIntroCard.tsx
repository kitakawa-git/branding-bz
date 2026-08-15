'use client'

// ポータルの役割を説明するカード（管理者・初回セットアップ中のみ）。
//
// 初見の管理者が一番混乱するのは「管理画面とポータル、何が違うのか」。
// オンボーディングの各ステップが /admin/... に飛ばすので、
// 行き来する理由を先に理解してもらうために出す。
//
// dismiss は localStorage（オンボーディング本体の DB dismiss とは独立）。
// 一度閉じたら二度と出さない。オンボーディング完了時も自動で消える
// （出す条件を呼び出し側の showOnboarding に乗せているため）。
import { useState, useEffect } from 'react'
import { ArrowRight, ArrowDown, MapPin } from 'lucide-react'

const DISMISS_KEY = 'portal-intro-dismissed'

export function PortalIntroCard() {
  // SSR とクライアントで表示が食い違わないよう、マウント後に判定する
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === '1')
    } catch {
      // localStorage が使えない環境では出したままにする
    }
  }, [])

  const handleDismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // 保存に失敗しても閉じる動作は優先する
    }
  }

  if (!mounted || dismissed) return null

  return (
    <div className="mb-4 rounded-xl border border-border bg-[hsl(0_0%_97%)] p-5">
      {/* 見出し */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="m-0 text-base font-extrabold text-foreground">
            branding.bz のしくみ
          </h2>
          <p className="m-0 mt-1 text-xs leading-relaxed text-muted-foreground">
            管理画面で「登録」し、ポータルで「全員が見る」。この2つを行き来します。
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 cursor-pointer border-0 bg-transparent p-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          閉じる
        </button>
      </div>

      {/* 図解：PCは横並び、モバイルは縦積み */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_40px_1fr] sm:gap-0">
        {/* 左：管理画面。実物の管理画面サイドバーと同じ地色にして、
            「あの暗い画面のこと」と一目で結びつくようにする。
            ⚠️ bg-sidebar は使えない。globals.css の [data-portal] が
            --sidebar-* をポータル用の明るい配色に上書きしているので、
            このカード（ポータル内）では明るいグレーになってしまう。
            地色は 220 13% 21%。globals.css の :root は 18% だが、
            AdminDataProvider が SidebarProvider に 21% を渡して管理画面だけ明るくしている。
            そちらを変えたらここも合わせる（app/admin/components/AdminDataProvider.tsx）。
            文字と枠線は上書きが無いので :root の値をそのまま使う */}
        <div className="flex flex-col rounded-lg border-[hsl(218_14%_26%)] border bg-[hsl(220_13%_21%)] p-3.5">
          <span className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(216_12%_84%)]">
            つくる場所
          </span>
          <p className="m-0 text-[18px] font-extrabold text-white">管理画面</p>
          <p className="m-0 mb-2.5 text-[11.5px] text-[hsl(216_12%_84%)]">管理者のみ</p>
          <ul className="m-0 list-disc pl-4 text-[11.5px] leading-[1.9] text-[hsl(216_12%_84%)]">
            <li>会社の基本情報</li>
            <li>ブランド方針（MVV）</li>
            <li>パーソナリティ</li>
            <li>ビジュアル・バーバル</li>
            <li>メンバー招待</li>
          </ul>
        </div>

        {/* 中央：矢印 */}
        <div className="flex items-center justify-center gap-1.5 sm:flex-col sm:gap-1">
          <ArrowRight
            size={18}
            className="hidden text-muted-foreground sm:block"
            aria-hidden="true"
          />
          <ArrowDown
            size={18}
            className="text-muted-foreground sm:hidden"
            aria-hidden="true"
          />
          <span className="text-[9px] tracking-widest text-muted-foreground sm:[writing-mode:vertical-rl]">
            反映
          </span>
        </div>

        {/* 右：ポータル */}
        <div className="flex flex-col rounded-lg border border-ds-app-accent bg-blue-50 p-3.5">
          <span className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-ds-app-accent">
            見せる場所
          </span>
          <p className="m-0 text-[18px] font-extrabold text-foreground">ポータル</p>
          <p className="m-0 mb-2.5 text-[11.5px] text-muted-foreground">全員が見る</p>
          <ul className="m-0 list-disc pl-4 text-[11.5px] leading-[1.9] text-muted-foreground">
            <li>私たちの「らしさ」4視点</li>
            <li>タイムライン</li>
            <li>KPI・目標</li>
            <li>ラーニング</li>
          </ul>
          <span className="mt-auto inline-flex items-center gap-1 pt-2.5 text-[10.5px] font-bold text-ds-app-accent">
            <MapPin size={11} aria-hidden="true" />
            この画面
          </span>
        </div>
      </div>

      {/* 補足 */}
      {/* カード地が薄いグレーになったので、bg-muted(#f5f5f5) だと沈んで区別がつかない */}
      <div className="mt-3.5 rounded-lg border border-border bg-white px-3 py-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
        <p className="m-0">
          💡
          下のステップから管理画面に移動して登録します。登録が終わるとこのポータルに中身が入り、メンバーを招待できる状態になります。
        </p>
        <p className="m-0 mt-1">
          🔒 左メニューの鍵アイコンが付いた機能は Standard 以上でご利用いただけます。
        </p>
      </div>
    </div>
  )
}
