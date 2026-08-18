// wiki_terms.long_def だけを terms.json の内容で更新する。実行: npx tsx scripts/update-wiki-longdef.ts
//
// なぜ seed-wiki.ts を使わないか:
//   seed-wiki.ts は子テーブル（sources/quotes/relations）を毎回作り直す。
//   本番では氏名・番組定型を含む引用8件を削除済みだが、その削除は terms.json に反映されていない
//   （Cowork 側で terms.json が再生成され、8件が復活している）。
//   seed を回すと消したはずの引用が戻るため、ここでは long_def だけを触る。
//
// 触るもの: wiki_terms.long_def / updated_at
// 触らないもの: short_def / categories / en / aliases / status / 子テーブル一式
import { readFileSync } from 'fs'
import { join } from 'path'

for (const line of readFileSync(join(process.cwd(), '.env.local'), 'utf-8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

import { getSupabaseAdmin } from '@/lib/supabase-admin'

type SeedTerm = { slug: string; term: string; long_def: string }

const APPLY = !process.argv.includes('--dry-run')

async function main() {
  const supabase = getSupabaseAdmin()
  const terms: SeedTerm[] = JSON.parse(
    readFileSync(join(process.cwd(), 'scripts', 'wiki-seed', 'terms.json'), 'utf-8')
  )

  const { data: rows, error } = await supabase.from('wiki_terms').select('id, slug, long_def')
  if (error) throw error
  const existing = new Map<string, { id: string; long_def: string }>(
    (rows ?? []).map((r: { id: string; slug: string; long_def: string }) => [
      r.slug,
      { id: r.id, long_def: r.long_def },
    ])
  )

  console.log(`▶ terms.json: ${terms.length}件 / DB: ${existing.size}件`)

  const missing = terms.filter((t) => !existing.has(t.slug)).map((t) => t.slug)
  const orphan = [...existing.keys()].filter((s) => !terms.some((t) => t.slug === s))
  if (missing.length) console.log(`⚠️  DBに存在しない slug: ${missing.join(', ')}`)
  if (orphan.length) console.log(`⚠️  terms.json に無い DB 行: ${orphan.join(', ')}`)

  const targets = terms.filter((t) => {
    const cur = existing.get(t.slug)
    return cur && cur.long_def !== t.long_def
  })
  const unchanged = terms.length - targets.length - missing.length

  const lens = targets.map((t) => t.long_def.length)
  const before = targets.map((t) => existing.get(t.slug)!.long_def.length)
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0)

  console.log(`▶ 更新対象: ${targets.length}件 / 変更なし: ${unchanged}件`)
  console.log(`   文字数 平均 ${avg(before)} → ${avg(lens)}（最小 ${Math.min(...lens)} / 最大 ${Math.max(...lens)}）`)
  console.log(`   「###」見出しを含む: ${targets.filter((t) => t.long_def.includes('### ')).length}件`)

  if (!APPLY) {
    console.log('\n--dry-run のため更新はしていません。')
    return
  }

  let updated = 0
  for (const t of targets) {
    const { error: upErr } = await supabase
      .from('wiki_terms')
      .update({ long_def: t.long_def, updated_at: new Date().toISOString() })
      .eq('slug', t.slug)
    if (upErr) throw new Error(`${t.slug}: ${upErr.message}`)
    updated++
    if (updated % 50 === 0) console.log(`   ...${updated}/${targets.length}`)
  }
  console.log(`✅ long_def を更新: ${updated}件`)

  // 検証: 他の列と子テーブルが動いていないこと
  const { data: after } = await supabase.from('wiki_terms').select('long_def, status')
  const rowsAfter = (after ?? []) as { long_def: string; status: string }[]
  const [{ count: quotes }, { count: sources }, { count: relations }] = await Promise.all([
    supabase.from('wiki_term_quotes').select('*', { count: 'exact', head: true }),
    supabase.from('wiki_term_sources').select('*', { count: 'exact', head: true }),
    supabase.from('wiki_term_relations').select('*', { count: 'exact', head: true }),
  ])

  console.log('')
  console.log(`📊 long_def 平均: ${avg(rowsAfter.map((r) => r.long_def.length))}字`)
  console.log(`📊 見出しあり: ${rowsAfter.filter((r) => r.long_def.includes('### ')).length}/${rowsAfter.length}件`)
  console.log(`📊 published: ${rowsAfter.filter((r) => r.status === 'published').length}件`)
  console.log(`📊 子テーブル（未変更のはず）: quotes=${quotes} / sources=${sources} / relations=${relations}`)
}

main().catch((e) => {
  console.error('❌ 更新失敗:', e)
  process.exit(1)
})
