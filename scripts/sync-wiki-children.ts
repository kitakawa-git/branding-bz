// 用語wiki の子テーブル（引用 / 参考ソース / 関連リンク）を terms.json の内容に揃える。
// 実行: npx tsx scripts/sync-wiki-children.ts [--dry-run]
//
// wiki_terms 本体は触らない（別途 Cowork 側で投入済み）。
// 子テーブルは全削除 → 再投入で terms.json を正とする。
//
// 引用は QUOTE-FILTER-RULES.json のフィルタを必ず通す。
// （番組の名乗り・エンディング定型・年末挨拶・話者名ラベル付き雑談・宣伝は
//   用語の解説として無価値で、過去に北川さん承認のうえ削除した経緯がある）
import { readFileSync } from 'fs'
import { join } from 'path'

for (const line of readFileSync(join(process.cwd(), '.env.local'), 'utf-8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { WikiSourceType } from '@/lib/types/wiki'

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
  sources: SeedSource[]
  kitagawa_quotes: SeedQuote[]
  related: string[]
}

/** terms.json の type 表記 → DB の source_type */
const SOURCE_TYPE_MAP: Record<string, WikiSourceType> = {
  'bc/support': 'bc_support',
  'id-main/tips': 'id_tips',
  podcast: 'podcast',
  external: 'external',
  'ai-supplement': 'ai_supplement',
}

const SEED_DIR = join(process.cwd(), 'scripts', 'wiki-seed')
const APPLY = !process.argv.includes('--dry-run')

async function main() {
  const supabase = getSupabaseAdmin()
  const terms: SeedTerm[] = JSON.parse(readFileSync(join(SEED_DIR, 'terms.json'), 'utf-8'))
  const rules = JSON.parse(readFileSync(join(SEED_DIR, 'QUOTE-FILTER-RULES.json'), 'utf-8')) as {
    exclude_patterns: string[]
    promo_patterns: string[]
  }
  const quoteFilters = [...rules.exclude_patterns, ...rules.promo_patterns].map((p) => new RegExp(p))

  // ---- slug → id ----
  const { data: rows, error } = await supabase.from('wiki_terms').select('id, slug, term')
  if (error) throw error
  const idBySlug = new Map<string, string>()
  const idByTerm = new Map<string, string>()
  for (const r of (rows ?? []) as { id: string; slug: string; term: string }[]) {
    idBySlug.set(r.slug, r.id)
    idByTerm.set(r.term, r.id)
  }
  console.log(`▶ terms.json: ${terms.length}件 / DB wiki_terms: ${idBySlug.size}件`)

  const missing = terms.filter((t) => !idBySlug.has(t.slug)).map((t) => t.slug)
  if (missing.length) {
    throw new Error(`DB に存在しない slug が ${missing.length}件: ${missing.slice(0, 10).join(', ')}`)
  }

  // ---- 引用 ----
  const quoteRows: Record<string, unknown>[] = []
  let filtered = 0
  const filteredSamples: string[] = []
  for (const t of terms) {
    const termId = idBySlug.get(t.slug)!
    let ordering = 0
    for (const q of t.kitagawa_quotes) {
      const hit = quoteFilters.find((re) => re.test(q.quote))
      if (hit) {
        filtered++
        filteredSamples.push(`${t.slug}: ${q.quote.slice(0, 44)}…`)
        continue
      }
      if (!q.ep_no || q.ep_no === '?') {
        filtered++
        filteredSamples.push(`${t.slug}: ep_no 不明のため除外`)
        continue
      }
      quoteRows.push({
        term_id: termId,
        ep_no: q.ep_no,
        ep_title: q.ep_title.trim(),
        quote: q.quote,
        spotify_url: q.spotify_url || null,
        ordering: ordering++,
      })
    }
  }

  // ---- 参考ソース ----
  const sourceRows: Record<string, unknown>[] = []
  const unknownTypes = new Set<string>()
  for (const t of terms) {
    const termId = idBySlug.get(t.slug)!
    t.sources.forEach((s, i) => {
      const mapped = SOURCE_TYPE_MAP[s.type]
      if (!mapped) {
        unknownTypes.add(s.type)
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

  // ---- 関連リンク ----
  const relationRows: Record<string, unknown>[] = []
  const seen = new Set<string>()
  let unresolved = 0
  for (const t of terms) {
    const fromId = idBySlug.get(t.slug)!
    for (const name of t.related) {
      const toId = idByTerm.get(name) ?? idBySlug.get(name)
      if (!toId) {
        unresolved++
        continue
      }
      if (toId === fromId) continue
      const key = `${fromId}:${toId}`
      if (seen.has(key)) continue
      seen.add(key)
      relationRows.push({ from_term_id: fromId, to_term_id: toId, strength: 1 })
    }
  }

  console.log(`▶ 投入予定: quotes=${quoteRows.length} / sources=${sourceRows.length} / relations=${relationRows.length}`)
  console.log(`   引用フィルタで除外: ${filtered}件`)
  for (const s of filteredSamples) console.log(`     - ${s}`)
  if (unknownTypes.size) console.log(`⚠️  未知の source type（スキップ）: ${[...unknownTypes].join(', ')}`)
  if (unresolved) console.log(`⚠️  解決できない related: ${unresolved}件`)

  if (!APPLY) {
    console.log('\n--dry-run のため DB は変更していません。')
    return
  }

  // ---- 全削除 → 再投入 ----
  for (const table of ['wiki_term_quotes', 'wiki_term_sources'] as const) {
    const { error: e } = await supabase.from(table).delete().not('term_id', 'is', null)
    if (e) throw e
  }
  {
    const { error: e } = await supabase
      .from('wiki_term_relations')
      .delete()
      .not('from_term_id', 'is', null)
    if (e) throw e
  }
  console.log('🗑  子テーブル3本を全削除')

  async function insertChunked(table: string, rows: Record<string, unknown>[]) {
    for (let i = 0; i < rows.length; i += 500) {
      const { error: e } = await supabase.from(table).insert(rows.slice(i, i + 500))
      if (e) throw new Error(`${table}: ${e.message}`)
    }
    console.log(`✅ ${table}: ${rows.length}件`)
  }
  await insertChunked('wiki_term_quotes', quoteRows)
  await insertChunked('wiki_term_sources', sourceRows)
  await insertChunked('wiki_term_relations', relationRows)

  // ---- 検証 ----
  const count = async (t: string) => (await supabase.from(t).select('*', { count: 'exact', head: true })).count ?? 0
  const [terms_, quotes_, sources_, relations_] = await Promise.all([
    count('wiki_terms'),
    count('wiki_term_quotes'),
    count('wiki_term_sources'),
    count('wiki_term_relations'),
  ])
  const { data: orphanRows } = await supabase.from('wiki_terms').select('id, wiki_term_sources(id)')
  const orphans = (orphanRows ?? []).filter(
    (r) => ((r as { wiki_term_sources: unknown[] }).wiki_term_sources ?? []).length === 0
  ).length

  console.log('')
  console.log(`📊 terms=${terms_} / quotes=${quotes_} / sources=${sources_} / relations=${relations_}`)
  console.log(`📊 参考ソースを持たない用語（orphan_terms）: ${orphans}`)
}

main().catch((e) => {
  console.error('❌ 同期失敗:', e)
  process.exit(1)
})
