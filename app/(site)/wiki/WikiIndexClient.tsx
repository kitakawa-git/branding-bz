'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import TermCard from '@/components/wiki/TermCard'
import {
  WIKI_CATEGORIES,
  WIKI_SOURCE_FILTER_LABELS,
  type WikiSourceFilter,
  type WikiTermSummary,
} from '@/lib/types/wiki'

/* 用語wiki index のインタラクション部分（検索・カテゴリ絞り込み・出典絞り込み）。
   件数が230件規模なので全件をクライアントに渡してメモリ上で絞る（追加フェッチなし）。 */

const SELECT_CLASS =
  'h-11 w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 text-base text-white/85 outline-none transition-colors focus:border-blue-400/50 sm:w-auto [&>option]:bg-[#111114] [&>option]:text-white'

export default function WikiIndexClient({ terms }: { terms: WikiTermSummary[] }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [source, setSource] = useState<WikiSourceFilter>('all')

  // カテゴリごとの件数（カード表示用）
  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of terms) {
      for (const c of t.categories) map.set(c, (map.get(c) ?? 0) + 1)
    }
    return map
  }, [terms])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return terms.filter((t) => {
      if (category !== 'all' && !t.categories.includes(category)) return false

      if (source === 'has_quote' && !t.has_quote) return false
      if (source !== 'all' && source !== 'has_quote' && !t.source_types.includes(source)) {
        return false
      }

      if (!q) return true
      return (
        t.term.toLowerCase().includes(q) ||
        t.en.toLowerCase().includes(q) ||
        t.short_def.toLowerCase().includes(q)
      )
    })
  }, [terms, query, category, source])

  const hasFilter = query.trim() !== '' || category !== 'all' || source !== 'all'

  return (
    <>
      {/* カテゴリカード */}
      <div className="mb-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {WIKI_CATEGORIES.map((c) => {
          const count = counts.get(c.value) ?? 0
          const active = category === c.value
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(active ? 'all' : c.value)}
              className={`flex min-h-11 flex-col rounded-2xl border p-4 text-left transition-colors ${
                active
                  ? 'border-blue-400/50 bg-blue-500/15'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-base font-bold text-white">{c.value}</span>
                <span className="shrink-0 text-sm tabular-nums text-white/40">{count}語</span>
              </div>
              <span className="mt-1 text-sm leading-relaxed text-white/45">{c.description}</span>
            </button>
          )
        })}
      </div>

      {/* 検索・絞り込み */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={18}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="用語名・説明で検索"
            aria-label="用語を検索"
            className="h-11 w-full rounded-xl border border-white/15 bg-white/[0.04] pl-11 pr-4 text-base text-white placeholder:text-white/30 outline-none transition-colors focus:border-blue-400/50"
          />
        </div>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="カテゴリで絞り込む"
          className={SELECT_CLASS}
        >
          <option value="all">すべてのカテゴリ</option>
          {WIKI_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.value}（{counts.get(c.value) ?? 0}）
            </option>
          ))}
        </select>

        <select
          value={source}
          onChange={(e) => setSource(e.target.value as WikiSourceFilter)}
          aria-label="出典で絞り込む"
          className={SELECT_CLASS}
        >
          {(Object.keys(WIKI_SOURCE_FILTER_LABELS) as WikiSourceFilter[]).map((k) => (
            <option key={k} value={k}>
              {WIKI_SOURCE_FILTER_LABELS[k]}
            </option>
          ))}
        </select>
      </div>

      {/* 件数＋クリア */}
      <div className="mb-6 flex min-h-11 flex-wrap items-center gap-3">
        <p className="text-sm text-white/45">
          {filtered.length}語{hasFilter && ` / 全${terms.length}語`}
        </p>
        {hasFilter && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setCategory('all')
              setSource('all')
            }}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={14} />
            絞り込みを解除
          </button>
        )}
        {category !== 'all' && (
          <Link
            href={`/wiki/category/${encodeURIComponent(category)}`}
            className="inline-flex min-h-11 items-center text-sm text-blue-300 underline-offset-4 transition-colors hover:underline"
          >
            「{category}」のページを開く →
          </Link>
        )}
      </div>

      {/* 用語グリッド */}
      {filtered.length === 0 ? (
        <p className="py-16 text-center text-white/45">該当する用語が見つかりませんでした</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <TermCard key={t.slug} term={t} />
          ))}
        </div>
      )}
    </>
  )
}
