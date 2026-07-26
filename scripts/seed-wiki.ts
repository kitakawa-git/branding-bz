// ブランディング用語wiki のシード。実行: npx tsx scripts/seed-wiki.ts
//
// scripts/wiki-seed/terms.json（230語）を wiki_terms / wiki_term_sources /
// wiki_term_quotes / wiki_term_relations の4テーブルへ投入する。
//
// - 冪等: slug で upsert。子テーブル（sources/quotes/relations）は毎回 term_id 単位で全消し→再投入。
// - 全件 status='review' で投入する（監修が終わった用語から published に UPDATE して段階公開）。
//   すでに published になっている用語の status は上書きしない。
// - spotify_url が空の引用は、ep_no（または ep_title から抽出した話数）で
//   scripts/wiki-seed/spotify-mapping.json を引いて補完する。
import { readFileSync } from 'fs'
import { join } from 'path'

// .env.local を読む（他の scripts/*.ts と同じ方式）
for (const line of readFileSync(join(process.cwd(), '.env.local'), 'utf-8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { WIKI_CATEGORY_VALUES, type WikiSourceType } from '@/lib/types/wiki'

type SeedSource = {
  type: string
  source_id?: string | number | null
  title?: string | null
  url?: string | null
  excerpt?: string | null
}

type SeedQuote = {
  ep_no: string
  ep_title: string
  quote: string
  spotify_url?: string | null
}

type SeedTerm = {
  slug: string
  term: string
  aliases?: string[]
  categories: string[]
  sources: SeedSource[]
  kitagawa_quotes: SeedQuote[]
  short_def: string
  long_def: string
  en?: string
  related: string[]
}

const SEED_DIR = join(process.cwd(), 'scripts', 'wiki-seed')

const terms: SeedTerm[] = JSON.parse(readFileSync(join(SEED_DIR, 'terms.json'), 'utf-8'))
const spotifyMap: Record<string, string> = JSON.parse(
  readFileSync(join(SEED_DIR, 'spotify-mapping.json'), 'utf-8')
).ep_to_url

/** terms.json の type 表記 → DB の source_type */
const SOURCE_TYPE_MAP: Record<string, WikiSourceType> = {
  'bc/support': 'bc_support',
  'id-main/tips': 'id_tips',
  podcast: 'podcast',
  external: 'external',
  'ai-supplement': 'ai_supplement',
}

/**
 * カテゴリの正規化。
 * terms.json には1件だけ「特化・応用 (ID INC.独自)」があるが、
 * カテゴリカード／カテゴリページは7カテゴリ設計なので「特化・応用」に寄せる。
 */
function normalizeCategory(raw: string): string {
  const trimmed = raw.trim()
  if (WIKI_CATEGORY_VALUES.includes(trimmed)) return trimmed
  const base = trimmed.replace(/\s*[（(].*?[)）]\s*$/, '').trim()
  return WIKI_CATEGORY_VALUES.includes(base) ? base : trimmed
}

/** ep_no が '?' のとき ep_title（例「第22話-2：…」）から話数を復元する。 */
function resolveEpNo(quote: SeedQuote): string {
  if (quote.ep_no && quote.ep_no !== '?') return quote.ep_no
  const m = quote.ep_title.trim().match(/^第(\d+)話(-\d+)?/)
  return m ? `${m[1]}${m[2] ?? ''}` : quote.ep_no
}

async function main() {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()

  console.log(`▶ terms.json: ${terms.length}件`)

  // ---------------------------------------------------------------
  // 1. 用語本体を upsert（slug で一意判定）
  // ---------------------------------------------------------------
  // すでに published のものは status を review に戻さないため、既存 status を先に引く
  const { data: existingRows, error: existingErr } = await supabase
    .from('wiki_terms')
    .select('slug, status')
  if (existingErr) throw existingErr
  const existingStatus = new Map<string, string>(
    (existingRows ?? []).map((r: { slug: string; status: string }) => [r.slug, r.status])
  )

  const unknownCategories = new Set<string>()
  const payload = terms.map((t) => {
    const categories = t.categories.map((c) => {
      const n = normalizeCategory(c)
      if (n !== c.trim()) unknownCategories.add(`${c} → ${n}`)
      return n
    })
    return {
      slug: t.slug,
      term: t.term,
      reading: null, // よみがなは今回未投入（50音インデックスは後段フェーズ）
      en: t.en ?? '',
      aliases: t.aliases ?? [],
      categories,
      short_def: t.short_def,
      long_def: t.long_def,
      status: existingStatus.get(t.slug) === 'published' ? 'published' : 'review',
      updated_at: now,
    }
  })

  const { error: upsertErr } = await supabase
    .from('wiki_terms')
    .upsert(payload, { onConflict: 'slug' })
  if (upsertErr) throw upsertErr
  console.log(`✅ wiki_terms upsert: ${payload.length}件`)
  if (unknownCategories.size > 0) {
    console.log(`   ↳ カテゴリ正規化: ${Array.from(unknownCategories).join(' / ')}`)
  }

  // ---------------------------------------------------------------
  // 2. slug → id のマップを作る
  // ---------------------------------------------------------------
  const { data: idRows, error: idErr } = await supabase.from('wiki_terms').select('id, slug, term')
  if (idErr) throw idErr
  const idBySlug = new Map<string, string>()
  const idByTerm = new Map<string, string>()
  for (const r of (idRows ?? []) as { id: string; slug: string; term: string }[]) {
    idBySlug.set(r.slug, r.id)
    idByTerm.set(r.term, r.id)
  }

  const termIds = terms.map((t) => idBySlug.get(t.slug)!).filter(Boolean)

  // ---------------------------------------------------------------
  // 3. 子テーブルを作り直す（冪等性のため全消し→再投入）
  // ---------------------------------------------------------------
  for (const table of ['wiki_term_sources', 'wiki_term_quotes'] as const) {
    const { error } = await supabase.from(table).delete().in('term_id', termIds)
    if (error) throw error
  }
  {
    const { error } = await supabase.from('wiki_term_relations').delete().in('from_term_id', termIds)
    if (error) throw error
  }

  // 参考ソース
  const sourceRows: Record<string, unknown>[] = []
  const unknownSourceTypes = new Set<string>()
  for (const t of terms) {
    const termId = idBySlug.get(t.slug)
    if (!termId) continue
    t.sources.forEach((s, i) => {
      const mapped = SOURCE_TYPE_MAP[s.type]
      if (!mapped) {
        unknownSourceTypes.add(s.type)
        return
      }
      sourceRows.push({
        term_id: termId,
        source_type: mapped,
        source_id: s.source_id != null ? String(s.source_id) : null,
        title: s.title ?? null,
        url: s.url ?? null,
        excerpt: s.excerpt ?? null,
        ordering: i,
      })
    })
  }

  // 北川発言引用（spotify_url を話数マッピングで補完）
  const quoteRows: Record<string, unknown>[] = []
  let backfilled = 0
  let stillMissing = 0
  for (const t of terms) {
    const termId = idBySlug.get(t.slug)
    if (!termId) continue
    t.kitagawa_quotes.forEach((q, i) => {
      const epNo = resolveEpNo(q)
      let url = q.spotify_url || ''
      if (!url) {
        const mapped = spotifyMap[epNo]
        if (mapped) {
          url = mapped
          backfilled++
        } else {
          stillMissing++
        }
      }
      quoteRows.push({
        term_id: termId,
        ep_no: epNo,
        ep_title: q.ep_title.trim(),
        quote: q.quote,
        spotify_url: url || null,
        ordering: i,
      })
    })
  }

  // 関連用語グラフ（related は用語名で書かれているので term → id で解決）
  const relationRows: Record<string, unknown>[] = []
  const seenPairs = new Set<string>()
  let unresolvedRelations = 0
  for (const t of terms) {
    const fromId = idBySlug.get(t.slug)
    if (!fromId) continue
    for (const relatedName of t.related) {
      const toId = idByTerm.get(relatedName) ?? idBySlug.get(relatedName)
      if (!toId) {
        unresolvedRelations++
        continue
      }
      if (toId === fromId) continue // 自己参照は張らない
      const key = `${fromId}:${toId}`
      if (seenPairs.has(key)) continue
      seenPairs.add(key)
      relationRows.push({ from_term_id: fromId, to_term_id: toId, strength: 1 })
    }
  }

  // ---------------------------------------------------------------
  // 4. 投入（1000件ずつに分割）
  // ---------------------------------------------------------------
  async function insertChunked(table: string, rows: Record<string, unknown>[]) {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from(table).insert(rows.slice(i, i + 500))
      if (error) throw error
    }
    console.log(`✅ ${table} insert: ${rows.length}件`)
  }

  await insertChunked('wiki_term_sources', sourceRows)
  await insertChunked('wiki_term_quotes', quoteRows)
  await insertChunked('wiki_term_relations', relationRows)

  if (unknownSourceTypes.size > 0) {
    console.log(`⚠️  未知の source type（スキップ）: ${Array.from(unknownSourceTypes).join(', ')}`)
  }
  if (unresolvedRelations > 0) {
    console.log(`⚠️  解決できなかった関連用語: ${unresolvedRelations}件`)
  }
  console.log(`   ↳ Spotify URL 補完: ${backfilled}件 / 未公開回のため空のまま: ${stillMissing}件`)

  // ---------------------------------------------------------------
  // 5. 検証
  // ---------------------------------------------------------------
  const counts = await Promise.all(
    ['wiki_terms', 'wiki_term_sources', 'wiki_term_quotes', 'wiki_term_relations'].map(
      async (table) => {
        const { count } = await supabase.from(table).select('*', { count: 'exact', head: true })
        return `${table}=${count ?? 0}`
      }
    )
  )
  const { count: publishedCount } = await supabase
    .from('wiki_terms')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published')

  console.log('')
  console.log(`📊 テーブル件数: ${counts.join(' / ')}`)
  console.log(`📊 published: ${publishedCount ?? 0}件（残りは review = 公開ページ非表示）`)
}

main().catch((e) => {
  console.error('❌ シード失敗:', e)
  process.exit(1)
})
