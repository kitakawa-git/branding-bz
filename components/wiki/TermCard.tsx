import Link from 'next/link'
import { Mic } from 'lucide-react'
import type { WikiTermSummary } from '@/lib/types/wiki'

/* 用語wiki の一覧カード（index / カテゴリページ共通）。
   ダーク基調のマーケLP系トーンに合わせる。カード全体がリンク＝タップ領域は十分に確保。 */
export default function TermCard({ term }: { term: WikiTermSummary }) {
  return (
    <Link
      href={`/wiki/${encodeURIComponent(term.slug)}`}
      className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-white/20 hover:bg-white/[0.06]"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {term.categories.map((c) => (
          <span
            key={c}
            className="inline-flex items-center rounded-full border border-blue-400/20 bg-blue-500/15 px-2.5 py-0.5 text-xs font-medium text-blue-300"
          >
            {c}
          </span>
        ))}
        {term.has_quote && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
            <Mic size={12} />
            ポッドキャスト
          </span>
        )}
      </div>

      <h3 className="text-base font-bold text-white transition-colors group-hover:text-blue-300">
        {term.term}
      </h3>
      {term.en && <p className="mt-0.5 text-sm text-white/35">{term.en}</p>}

      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-white/55">{term.short_def}</p>
    </Link>
  )
}
