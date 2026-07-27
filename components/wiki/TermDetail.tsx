import Link from 'next/link'
import QuoteBlock from '@/components/wiki/QuoteBlock'
import RelatedChips from '@/components/wiki/RelatedChips'
import SourceList from '@/components/wiki/SourceList'
import type { WikiTermDetail } from '@/lib/types/wiki'

/* 用語詳細の本体。
   読み順: 用語名＋英訳＋カテゴリ → 一文でいうと → 詳細定義 → 関連用語 → ポッドキャスト引用 → 参考ソース */

/* longTitle: 文章に近い長い見出し用。字送り 0.15em のままだとモバイルで無駄に折り返すので詰める。 */
function Section({
  title,
  children,
  longTitle = false,
}: {
  title: React.ReactNode
  children: React.ReactNode
  longTitle?: boolean
}) {
  return (
    <section className="mt-12">
      <h2
        className={`mb-4 text-sm font-semibold text-blue-400 ${
          longTitle ? 'tracking-wide' : 'tracking-[0.15em]'
        }`}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

export default function TermDetail({ term }: { term: WikiTermDetail }) {
  return (
    <article className="mx-auto max-w-3xl">
      {/* ヘッダー */}
      <div className="mb-3 flex flex-wrap gap-2">
        {term.categories.map((c) => (
          <Link
            key={c}
            href={`/wiki/category/${encodeURIComponent(c)}`}
            className="inline-flex items-center rounded-full border border-blue-400/20 bg-blue-500/15 px-3 py-1 text-xs font-medium text-blue-300 transition-colors hover:bg-blue-500/25"
          >
            {c}
          </Link>
        ))}
      </div>

      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{term.term}</h1>
      {term.en && <p className="mt-2 text-base text-white/40">{term.en}</p>}

      {/* 一文でいうと */}
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <p className="mb-2 text-sm font-semibold tracking-[0.15em] text-blue-400">一文でいうと</p>
        <p className="text-lg leading-relaxed text-white/85">{term.short_def}</p>
      </div>

      {/* 詳細定義 */}
      <Section title="詳しく">
        <p className="whitespace-pre-wrap text-base leading-[1.9] text-white/70">{term.long_def}</p>
      </Section>

      {/* 関連用語 */}
      {term.related.length > 0 && (
        <Section title="関連する用語">
          <RelatedChips related={term.related} />
        </Section>
      )}

      {/* ポッドキャスト引用 */}
      {term.quotes.length > 0 && (
        <Section
          longTitle
          /* 番組名はモバイルで「育／てる」のように途中で割れないよう分割禁止にする */
          title={
            <>
              ID INC. のポッドキャスト
              <span className="whitespace-nowrap">「育てるブランディング」より</span>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            {term.quotes.map((q) => (
              <QuoteBlock key={q.id} quote={q} />
            ))}
          </div>
        </Section>
      )}

      {/* 参考ソース */}
      {term.sources.length > 0 && (
        <Section title="参考ソース">
          <SourceList sources={term.sources} />
        </Section>
      )}

      <div className="mt-16 border-t border-white/10 pt-8">
        <Link href="/wiki" className="text-sm text-white/50 transition-colors hover:text-white">
          ← ブランディング用語wiki 一覧に戻る
        </Link>
      </div>
    </article>
  )
}
