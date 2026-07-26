import { ExternalLink, Quote } from 'lucide-react'
import type { WikiTermQuote } from '@/lib/types/wiki'

/* 北川発言の引用ブロック（ID INC. の視点）。
   Quotation の JSON-LD も同じデータからこの場で出力し、表示と構造化データを1ソースに揃える。 */
export default function QuoteBlock({ quote }: { quote: WikiTermQuote }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Quotation',
    text: quote.quote,
    spokenByCharacter: { '@type': 'Person', name: '北川 巧' },
    ...(quote.spotify_url ? { citation: quote.spotify_url } : {}),
  }

  return (
    <figure className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Quote size={18} className="mb-3 text-blue-400" aria-hidden />
      <blockquote className="text-base leading-[1.9] text-white/80">{quote.quote}</blockquote>
      <figcaption className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/10 pt-4">
        <span className="text-sm text-white/45">{quote.ep_title}</span>
        {quote.spotify_url ? (
          <a
            href={quote.spotify_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20"
          >
            Spotify で聴く
            <ExternalLink size={14} />
          </a>
        ) : (
          <span className="text-sm text-white/30">（配信準備中）</span>
        )}
      </figcaption>
    </figure>
  )
}
