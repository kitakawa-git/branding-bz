import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/* 公開サイト（LP・ツールLP・資料請求バナー）のボタン体系。
   管理画面・ポータルは components/ui/button.tsx（shadcn）を使う。こちらはダーク地のLP向けで別物。

   サイズは L / M / S / XS / icon の5つだけ。増やさない。
     L    = 高さ48px / 左右32px / 16px — ページの主要CTA
     M    = 高さ44px / 左右16px / 14px — 本文中の導線（44px はスマホのタップ基準）
     S    = 高さ36px / 左右12px / 14px — バーやカードの中の補助ボタン
     XS   = 高さ32px / 左右12px / 14px — ヘッダー（Nav）専用。ナビのリンク（32px）と高さを揃える
     icon = 36×36px のアイコンのみ（タップ基準を満たしたい場所は className で h-11 w-11 にする）

   文字の太さは semibold に統一する（以前は箇所ごとに bold / medium が混在していた）。 */
export const ctaVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-full font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      size: {
        l: 'h-12 px-8 text-base',
        m: 'h-11 px-4 text-sm',
        s: 'h-9 px-3 text-sm',
        xs: 'h-8 px-3 text-sm',
        icon: 'h-9 w-9 px-0',
      },
      variant: {
        /** 白地のボタン（暗い背景の主要CTA） */
        primary: 'bg-white text-black transition-transform hover:scale-105',
        /** 枠線のみ（暗い背景の副CTA） */
        outline: 'border border-white/25 bg-white/5 text-white backdrop-blur hover:bg-white/10',
        /** 枠線・背景薄め（wiki のピルなど） */
        subtle: 'border border-white/15 bg-white/[0.04] text-white/75 hover:border-white/30 hover:bg-white/10 hover:text-white',
        /** 黒地のボタン（白いカードの中。資料請求バナー） */
        dark: 'bg-[#12141a] text-white hover:opacity-85',
        /** 枠なし（アイコンのみの操作） */
        ghost: 'text-black/40 hover:bg-black/5 hover:text-black/70',
      },
    },
    defaultVariants: { size: 'l', variant: 'primary' },
  }
)

export type CtaVariantProps = VariantProps<typeof ctaVariants>

/** 既存の <Link> / <a> / <button> に当てるクラスを返す（構造を変えずに体系へ寄せるための入口） */
export function ctaClass(props: CtaVariantProps & { className?: string } = {}) {
  const { className, ...variants } = props
  return cn(ctaVariants(variants), className)
}
