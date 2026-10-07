import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/* 公開サイト（LP・ツールLP・ニュース・wiki）の見出し体系。ボタンの cta.ts と同じ考え方で、
   サイズ・太さ・行間・字間はここだけで決める。色・余白・中央寄せはページ側の className で足す。

   段階（PC / スマホ）。増やさない。
     display = 72 / 28〜44（画面幅の8.6%。390pxで33.5）— トップとツールLPのヒーロー
     title   = 60 / display と同じ — 下層ページの大見出し（PageHero）
     section = 36 / 28 — 各セクションの見出し
     sub     = 24 / 20 — 機能グループ名・プラン名・柱カード・完了画面
     card    = 18 / 18 — カードの見出し・FAQの分類
     cardSm  = 16 / 16 — 一覧の小さなカード（wiki の用語カード・ツールカード）
   記事（ニュース・wiki の詳細）
     article = 36 / 30 — 記事の大見出し
     中見出し 20・小見出し 16 は本文の prose 指定側で揃える（news/[slug] と wiki の LongDefinition）

   スマホの display / title を 33.5px（390px）までにしているのは、トップの「AIでブランディングを」を
   語の途中で改行させない上限だから。下層ページだけ大きいと、トップのヒーローより大きく見えて逆転する。 */
/* 折り返し: 日本語の見出しは文字の途中（「とどけ／る。」）で折れないよう、句読点の後でだけ折り返す（keep-all）。
   文節の切れ目は JaWrap が自動で <wbr /> を入れて作る（見出しの中身は <JaWrap> で包む）。
   1文節が1行に収まらないときだけ、はみ出さないよう端で折る（overflow-wrap: break-word）。
   anywhere は使わない: 最小幅が1文字まで縮むので、横並び（flex/grid）の見出しが「サポー／ト」と細く折れる。 */
export const headingVariants = cva('font-bold break-keep [overflow-wrap:break-word]', {
  variants: {
    level: {
      display: 'text-[clamp(28px,8.6vw,44px)] leading-[1.05] tracking-[-0.03em] sm:text-6xl md:text-7xl',
      title: 'text-[clamp(28px,8.6vw,44px)] leading-[1.15] tracking-tight sm:text-5xl md:text-6xl',
      section: 'text-[28px] leading-[1.25] tracking-tight md:text-4xl',
      sub: 'text-xl tracking-tight md:text-2xl',
      card: 'text-lg',
      cardSm: 'text-base',
      article: 'text-3xl tracking-tight md:text-4xl',
    },
  },
})

export type HeadingLevel = NonNullable<VariantProps<typeof headingVariants>['level']>

export function headingClass(level: HeadingLevel, className?: string) {
  return cn(headingVariants({ level }), className)
}
