// ブランディング用語wiki の公開データ取得（Server Component 専用）。
//
// あえて service_role ではなく anon キーで読む:
//   1. RLS の `status = 'published'` ポリシーがそのまま「公開判定」になる（アプリ側で条件を書き忘れても漏れない）
//   2. SUPABASE_SERVICE_ROLE_KEY を置いていない Vercel Preview でも
//      generateStaticParams / ISR のビルドが落ちない（2026-07-16 の Preview ビルド事故と同じ轍を踏まない）
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  WikiTermDetail,
  WikiTermQuote,
  WikiTermSource,
  WikiTermSummary,
} from '@/lib/types/wiki'

let _client: SupabaseClient | null = null

function getWikiClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY が未設定です。')
    }
    _client = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return _client
}

type SummaryRow = {
  slug: string
  term: string
  en: string | null
  categories: string[] | null
  short_def: string
  wiki_term_quotes: { id: string }[] | null
}

/**
 * 公開済み用語の一覧（index / カテゴリページ用）。
 * 引用の有無だけカードのバッジに使うので同時に取る。
 */
export async function fetchPublishedTermSummaries(): Promise<WikiTermSummary[]> {
  const supabase = getWikiClient()
  const { data, error } = await supabase
    .from('wiki_terms')
    .select('slug, term, en, categories, short_def, wiki_term_quotes(id)')
    .eq('status', 'published')
    .order('term')

  if (error || !data) return []

  return (data as SummaryRow[]).map((row) => ({
    slug: row.slug,
    term: row.term,
    en: row.en ?? '',
    categories: row.categories ?? [],
    short_def: row.short_def,
    has_quote: (row.wiki_term_quotes ?? []).length > 0,
  }))
}

/** 公開済み用語の slug 一覧（generateStaticParams / sitemap 用）。 */
export async function fetchPublishedTermSlugs(): Promise<{ slug: string; updated_at: string }[]> {
  const supabase = getWikiClient()
  const { data, error } = await supabase
    .from('wiki_terms')
    .select('slug, updated_at')
    .eq('status', 'published')
  if (error || !data) return []
  return data as { slug: string; updated_at: string }[]
}

type DetailRow = {
  id: string
  slug: string
  term: string
  reading: string | null
  en: string | null
  aliases: string[] | null
  categories: string[] | null
  short_def: string
  long_def: string
  updated_at: string
  wiki_term_sources: WikiTermSource[] | null
  wiki_term_quotes: WikiTermQuote[] | null
}

/**
 * 詳細ページ用のフル情報。公開されていない用語は null を返す（RLS が弾く）。
 * 関連用語は relations → terms の2段引き（FK制約名に依存する埋め込み構文を避ける）。
 */
export async function fetchTermDetail(slug: string): Promise<WikiTermDetail | null> {
  const supabase = getWikiClient()
  const { data, error } = await supabase
    .from('wiki_terms')
    .select(
      'id, slug, term, reading, en, aliases, categories, short_def, long_def, updated_at, ' +
        'wiki_term_sources(id, source_type, source_id, title, url, excerpt, ordering), ' +
        'wiki_term_quotes(id, ep_no, ep_title, quote, spotify_url, ordering)'
    )
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (error || !data) return null
  const row = data as unknown as DetailRow

  // 関連用語（両端が公開の辺のみ RLS で返る）
  const { data: relRows } = await supabase
    .from('wiki_term_relations')
    .select('to_term_id')
    .eq('from_term_id', row.id)

  let related: WikiTermDetail['related'] = []
  const toIds = (relRows ?? []).map((r) => (r as { to_term_id: string }).to_term_id)
  if (toIds.length > 0) {
    const { data: relTerms } = await supabase
      .from('wiki_terms')
      .select('slug, term, short_def')
      .in('id', toIds)
      .eq('status', 'published')
      .order('term')
    related = (relTerms ?? []) as WikiTermDetail['related']
  }

  return {
    id: row.id,
    slug: row.slug,
    term: row.term,
    reading: row.reading,
    en: row.en ?? '',
    aliases: row.aliases ?? [],
    categories: row.categories ?? [],
    short_def: row.short_def,
    long_def: row.long_def,
    updated_at: row.updated_at,
    sources: (row.wiki_term_sources ?? []).slice().sort((a, b) => a.ordering - b.ordering),
    quotes: (row.wiki_term_quotes ?? []).slice().sort((a, b) => a.ordering - b.ordering),
    related,
  }
}
