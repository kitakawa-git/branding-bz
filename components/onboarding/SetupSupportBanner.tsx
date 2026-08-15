'use client'

// セットアップに詰まった管理者に、オンラインの入力サポートを案内する。
//
// 出す条件はオンボーディングと同じ（管理者・未完了）。完了すれば消えるので
// 閉じるボタンは付けない。置き場所が2つあり形が違うため variant で分ける。
//   sidebar … ポータルの左サイドバー下部（幅 200px 前後の縦長）
//   banner  … 管理画面「セットアップの進捗」の下（幅 660px 前後の横長）
//
// 紫青のグラデは AIButton と同系統。サービス全体で「特別な機能・サポート」の
// 視覚言語として揃える。ds系トークンは hex 変数で不透明度修飾が効かないため、
// ここでは素の Tailwind violet-* / blue-* を使う（白の半透明は標準色なので効く）。
import Link from 'next/link'
import { Check, Calendar, ChevronRight, MessageSquareText } from 'lucide-react'

// TODO(北川さん確認): 予約フォームのURL。決まるまでは問い合わせページに送る
const SUPPORT_HREF = '/contact?subject=setup-support'

export function SetupSupportBanner({ variant }: { variant: 'sidebar' | 'banner' }) {
  if (variant === 'sidebar') return <SidebarCard />
  return <GradientBanner />
}

/** ポータル左サイドバー下部：コンパクトカード */
function SidebarCard() {
  return (
    <Link
      href={SUPPORT_HREF}
      // 地色は AIButton と同じ紫青グラデ。サービス全体で
      // 「AI・特別なサポート」の視覚言語として揃える
      className="group block rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 p-3 text-white no-underline transition-all hover:shadow-[0_2px_8px_rgba(124,58,237,0.35)]"
    >
      <p className="m-0 flex items-start gap-1.5 text-base font-bold leading-snug">
        <MessageSquareText size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        入力にお困りですか？
      </p>
      <p className="m-0 mt-2 text-[12px] leading-relaxed opacity-90">
        オンラインで入力サポート
        <br />
        無料でいたします
      </p>
      <span className="mt-1.5 inline-flex items-center gap-0.5 text-sm font-bold">
        相談する
        <ChevronRight
          size={10}
          className="transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
    </Link>
  )
}

/** 管理画面「セットアップの進捗」の下：グラデーション帯 */
function GradientBanner() {
  return (
    <div className="relative mt-4 overflow-hidden rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 px-5 py-6 text-center text-white">
      {/* うっすら光を通す装飾。装飾なので読み上げ対象にしない */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08)_50%,transparent)]"
      />
      <span className="relative mb-2.5 inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/20 px-3 py-[3px] text-[11px] font-bold">
        <Check size={11} strokeWidth={3} aria-hidden="true" />
        完全無料
      </span>
      <p className="relative m-0 text-[17px] font-extrabold">入力にお困りですか？</p>
      <p className="relative m-0 mb-3.5 mt-1.5 text-[12.5px] leading-relaxed opacity-90">
        オンラインで画面を見ながら、担当者が入力をサポートします。
        <br className="hidden sm:block" />
        「何から書けばいいか分からない」の段階からご相談ください。
      </p>
      <Link
        href={SUPPORT_HREF}
        className="relative inline-flex items-center gap-1.5 rounded-full bg-white px-6 py-2.5 text-[13.5px] font-extrabold text-violet-600 no-underline transition-all hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)]"
      >
        <Calendar size={14} aria-hidden="true" />
        相談を予約する
      </Link>
      <p className="relative m-0 mt-2 text-[10.5px] opacity-80">
        所要 30分・オンライン・回数制限なし
      </p>
    </div>
  )
}
