import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'

type CtaLink = { href: string; label: string }

type Props = {
  title?: ReactNode
  lead?: ReactNode
  primary?: CtaLink
  /* null を渡すと副ボタンを描画しない */
  secondary?: CtaLink | null
  /* null を渡すと注意書きを描画しない */
  note?: ReactNode | null
}

/* 公開LPの末尾CTA（青ラジアル装飾付きカード）。
   トップ／機能紹介などで使う共通セクション。
   片方を直せば両方に反映される。 */
export default function FinalCta({
  title = '必要なすべてを、ひとつのプラットフォームに。',
  lead = 'まずは無料で、ブランディングの第一歩を。',
  primary = { href: '/signup', label: '無料で始める' },
  secondary = { href: '/contact', label: 'お問い合わせ' },
  note = '※ 業種業態によってはご利用をお断りする場合があります。',
}: Props = {}) {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <div
          className="relative overflow-hidden rounded-[2rem] border border-white/10 px-8 py-20 text-center"
          style={{
            background:
              'radial-gradient(80% 120% at 50% 0%, rgba(37,99,235,0.4) 0%, rgba(8,8,10,0) 60%), #0d0d11',
          }}
        >
          <h2 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-white/60">{lead}</p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={primary.href}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-8 text-base font-semibold text-black transition-transform hover:scale-105"
            >
              {primary.label} <ArrowRight size={18} />
            </Link>
            {secondary && (
              <Link
                href={secondary.href}
                className="inline-flex h-12 items-center rounded-full border border-white/15 bg-white/5 px-8 text-base font-semibold text-white backdrop-blur transition-colors hover:bg-white/10"
              >
                {secondary.label}
              </Link>
            )}
          </div>
          {note && <p className="mt-6 text-xs text-white/40">{note}</p>}
        </div>
      </div>
    </section>
  )
}
