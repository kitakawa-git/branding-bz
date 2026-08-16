'use client'

// セットアップに詰まった管理者に、オンラインの入力サポートを案内する。
//
// 出す条件はオンボーディングと同じ（管理者・未完了）。完了すれば消えるので
// 閉じるボタンは付けない。置き場所が2つあり形が違うため variant で分ける。
//   sidebar … ポータルの左サイドバー下部（幅 200px 前後の縦長）
//   banner  … 管理画面「セットアップの進捗」の下（幅 660px 前後の横長）
//
// 申し込みはログインしたまま SetupSupportDialog で完結させる。
// 以前は外部の問い合わせフォーム（/contact）に飛ばしていたが、
// サービスサイトに出てしまい「アプリの中で助けてもらえる」感じが切れていた。
//
// 紫青のグラデは AIButton と同系統。サービス全体で「特別な機能・サポート」の
// 視覚言語として揃える。ds系トークンは hex 変数で不透明度修飾が効かないため、
// ここでは素の Tailwind violet-* / blue-* を使う（白の半透明は標準色なので効く）。
import { useState } from 'react'
import { Check, Calendar, ChevronRight, Headset } from 'lucide-react'
import { SetupSupportDialog } from './SetupSupportDialog'

export function SetupSupportBanner({ variant }: { variant: 'sidebar' | 'banner' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      {variant === 'sidebar' ? (
        <SidebarCard onOpen={() => setOpen(true)} />
      ) : (
        <GradientBanner onOpen={() => setOpen(true)} />
      )}
      <SetupSupportDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

/** ポータル左サイドバー下部：コンパクトカード */
function SidebarCard({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      // 地色は AIButton と同じ紫青グラデ。サービス全体で
      // 「AI・特別なサポート」の視覚言語として揃える
      // 出るのは判定が済んだあと（少し遅れて現れる）ので、
      // ふっと差し込まれると視線を奪う。ゆっくり浮かび上がらせる
      className="group animate-in fade-in slide-in-from-bottom-2 block w-full cursor-pointer rounded-xl border-0 bg-gradient-to-br from-violet-600 to-blue-600 p-4 text-left text-white no-underline duration-700 ease-out transition-all hover:shadow-[0_2px_8px_rgba(124,58,237,0.35)]"
    >
      <p className="m-0 flex items-start gap-1.5 text-base font-bold leading-snug">
        <Headset size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
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
    </button>
  )
}

/** 管理画面「セットアップの進捗」の下：グラデーション帯 */
function GradientBanner({ onOpen }: { onOpen: () => void }) {
  return (
    // カード全体を押せるようにする。中の「相談を予約する」はボタンの入れ子に
    // できないので span にし、見た目とホバーだけ group から効かせる
    <button
      type="button"
      onClick={onOpen}
      className="group relative mt-4 block w-full cursor-pointer overflow-hidden rounded-xl border-0 bg-gradient-to-br from-violet-600 to-blue-600 px-5 py-6 text-center text-white"
    >
      {/* うっすら光を通す装飾。装飾なので読み上げ対象にしない */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08)_50%,transparent)]"
      />
      <span className="relative mb-2.5 inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/20 px-3 py-[3px] text-[11px] font-bold">
        <Check size={11} strokeWidth={3} aria-hidden="true" />
        完全無料
      </span>
      <p className="relative m-0 text-[18px] font-extrabold">入力にお困りですか？</p>
      <p className="relative m-0 mb-3.5 mt-1.5 text-sm leading-relaxed opacity-90">
        オンラインで画面を見ながら、ID INC. のスタッフが入力をサポートします。
        <br className="hidden sm:block" />
        「何から書けばいいか分からない」の段階からご相談ください。
      </p>
      <span className="relative inline-flex items-center gap-1.5 rounded-full bg-white px-6 py-2.5 text-sm font-extrabold text-violet-600 transition-all group-hover:-translate-y-px group-hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)]">
        <Calendar size={14} aria-hidden="true" />
        相談を予約する
      </span>
    </button>
  )
}
