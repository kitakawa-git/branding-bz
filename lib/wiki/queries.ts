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

const DETAIL_COLUMNS =
  'id, slug, term, reading, en, aliases, categories, short_def, long_def, updated_at, ' +
  'wiki_term_sources(id, source_type, source_id, title, url, excerpt, ordering), ' +
  'wiki_term_quotes(id, ep_no, ep_title, quote, spotify_url, ordering)'

// PostgREST が1リクエストで返す上限（Supabase 既定の max_rows）。これを超える分はページ送りで取る
const PAGE_SIZE = 1000

/**
 * 詳細ページ用のデータを、全用語ぶんまとめて取る。
 *
 * 以前は詳細ページ1件ごとに「用語本体 → 関連 → 関連用語」の3往復をしていた。
 * ビルドでは約265ページを事前生成するので1回あたり約800リクエストになり、
 * Vercel と手元のビルドが重なった 2026-10-07 には5時間で約3万件に達して、
 * DB（バースト型の小さいインスタンス）の CPU を使い切った。その後しばらく
 * 管理画面・ポータル・ログインまで数秒〜数十秒かかった。
 *
 * 1プロセスのあいだ結果を使い回すので、ビルドワーカー1つあたり数リクエストで済む。
 * 本番の ISR（revalidate = 3600）でも同じプロセスが温まっていれば使い回すが、
 * BULK_TTL_MS で取り直すので、ページの revalidate より古いデータは出さない。
 */
const BULK_TTL_MS = 5 * 60 * 1000

type TermBulk = {
  bySlug: Map<string, DetailRow>
  /** 一覧は term 順で取っているので、この順位で並べれば DB の order('term') と同じ並びになる */
  byId: Map<string, { slug: string; term: string; short_def: string; rank: number }>
  relatedIds: Map<string, string[]>
}

let _bulk: { at: number; promise: Promise<TermBulk> } | null = null

async function fetchAllPages<T>(
  run: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await run(from, from + PAGE_SIZE - 1)
    if (error || !data) throw error ?? new Error('empty response')
    const page = data as T[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

async function loadTermBulk(): Promise<TermBulk> {
  const supabase = getWikiClient()
  const [terms, relations] = await Promise.all([
    fetchAllPages<DetailRow>((from, to) =>
      supabase
        .from('wiki_terms')
        .select(DETAIL_COLUMNS)
        .eq('status', 'published')
        .order('term')
        .order('id')
        .range(from, to),
    ),
    // 両端が公開の辺だけ RLS で返る
    fetchAllPages<{ from_term_id: string; to_term_id: string }>((from, to) =>
      supabase
        .from('wiki_term_relations')
        .select('from_term_id, to_term_id')
        .order('from_term_id')
        .order('to_term_id')
        .range(from, to),
    ),
  ])

  const bySlug = new Map<string, DetailRow>()
  const byId: TermBulk['byId'] = new Map()
  terms.forEach((row, rank) => {
    bySlug.set(row.slug, row)
    byId.set(row.id, { slug: row.slug, term: row.term, short_def: row.short_def, rank })
  })
  const relatedIds = new Map<string, string[]>()
  for (const r of relations) {
    const list = relatedIds.get(r.from_term_id)
    if (list) list.push(r.to_term_id)
    else relatedIds.set(r.from_term_id, [r.to_term_id])
  }
  return { bySlug, byId, relatedIds }
}

function getTermBulk(): Promise<TermBulk> {
  const now = Date.now()
  if (!_bulk || now - _bulk.at > BULK_TTL_MS) {
    const promise = loadTermBulk()
    _bulk = { at: now, promise }
    // 失敗を使い回さない（次の呼び出しで取り直す）
    promise.catch(() => {
      if (_bulk?.promise === promise) _bulk = null
    })
  }
  return _bulk.promise
}

function toTermDetail(row: DetailRow, related: WikiTermDetail['related']): WikiTermDetail {
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
    // 参考ソースは「実際に参照できるもの」だけ出す。
    // ai_supplement は ID INC. の既存コンテンツに元ネタが無く AI が書いた印で、
    // URL も参照先も存在しない（176件すべて url 空）。見出しだけあって辿れない行は
    // 読者にとって情報価値がないので詳細ページには出さない。
    sources: (row.wiki_term_sources ?? [])
      .filter((s) => s.source_type !== 'ai_supplement')
      .slice()
      .sort((a, b) => a.ordering - b.ordering),
    quotes: (row.wiki_term_quotes ?? []).slice().sort((a, b) => a.ordering - b.ordering),
    related,
  }
}

/**
 * 詳細ページ用のフル情報。公開されていない用語は null を返す（RLS が弾く）。
 * まとめ取り（getTermBulk）から組み立てる。まとめ取りに失敗したときだけ1件ずつ引く。
 */
export async function fetchTermDetail(slug: string): Promise<WikiTermDetail | null> {
  let bulk: TermBulk
  try {
    bulk = await getTermBulk()
  } catch {
    return fetchTermDetailSingle(slug)
  }
  const row = bulk.bySlug.get(slug)
  // まとめ取りの後に公開された用語（ISR の初回アクセス）は1件で引き直す
  if (!row) return fetchTermDetailSingle(slug)

  const related = (bulk.relatedIds.get(row.id) ?? [])
    .map((id) => bulk.byId.get(id))
    .filter((t): t is NonNullable<typeof t> => !!t)
    .sort((a, b) => a.rank - b.rank)
    .map(({ slug, term, short_def }) => ({ slug, term, short_def }))
  return toTermDetail(row, related)
}

/**
 * 1件だけ引く（まとめ取りの後備え）。
 * 関連用語は relations → terms の2段引き（FK制約名に依存する埋め込み構文を避ける）。
 */
async function fetchTermDetailSingle(slug: string): Promise<WikiTermDetail | null> {
  const supabase = getWikiClient()
  const { data, error } = await supabase
    .from('wiki_terms')
    .select(DETAIL_COLUMNS)
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

  return toTermDetail(row, related)
}
