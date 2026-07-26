import Link from 'next/link'

/* 関連用語チップ。他の用語ページへの回遊導線。
   タップ領域を 44px 確保するため py と min-h を明示する。 */
export default function RelatedChips({
  related,
}: {
  related: { slug: string; term: string; short_def: string }[]
}) {
  if (related.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {related.map((r) => (
        <Link
          key={r.slug}
          href={`/wiki/${encodeURIComponent(r.slug)}`}
          title={r.short_def}
          className="inline-flex min-h-11 items-center rounded-full border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/75 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
        >
          {r.term}
        </Link>
      ))}
    </div>
  )
}
