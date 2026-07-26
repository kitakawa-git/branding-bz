import { ExternalLink } from 'lucide-react'
import { WIKI_SOURCE_TYPE_LABELS, type WikiTermSource } from '@/lib/types/wiki'

/* 参考ソース一覧。AI補完（ai_supplement）は出典URLを持たないので、
   「どこ由来か」を明示するラベルだけを出す（読者に監修状態を隠さない）。 */
export default function SourceList({ sources }: { sources: WikiTermSource[] }) {
  if (sources.length === 0) return null

  return (
    <ul className="flex flex-col gap-3">
      {sources.map((s) => {
        const label = WIKI_SOURCE_TYPE_LABELS[s.source_type]
        const body = (
          <>
            <span className="inline-flex shrink-0 items-center rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-0.5 text-xs font-medium text-white/60">
              {label}
            </span>
            <span className="text-sm leading-relaxed text-white/60 group-hover:text-white/90">
              {s.title || label}
            </span>
            {s.url && <ExternalLink size={14} className="mt-0.5 shrink-0 text-white/30" />}
          </>
        )

        return (
          <li key={s.id}>
            {s.url ? (
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group -mx-3 flex min-h-11 flex-wrap items-center gap-2 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.04]"
              >
                {body}
              </a>
            ) : (
              <div className="-mx-3 flex flex-wrap items-center gap-2 px-3 py-2.5">{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
