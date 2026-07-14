// Stage2 検証スクリプト（デモ企業限定・本番=実クライアントには書き込まない）。
// 実行: npx tsx scripts/verify-copy-stage2.ts
// .env.local を process.env へロード → generateCopyDraft を直接実行（before/after・役割温度差・0件フォールバック）。
import { readFileSync } from 'fs'
import { join } from 'path'

// --- .env.local を process.env にロード（getSupabaseAdmin が参照） ---
for (const line of readFileSync(join(process.cwd(), '.env.local'), 'utf-8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

import { generateCopyDraft } from '@/lib/copy/generate'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

const TECHBRIDGE = '128a1513-54cc-4e59-8278-3d02b591e336' // 株式会社テックブリッジ（デモ）
const ZERO = '70b56abb-5f38-42f3-bf71-e0b19b05035d'       // テスト株式会社（proof/rule 0件）

const HR = (t: string) => console.log(`\n========== ${t} ==========`)

async function main() {
  // ===== 検証2: before/after（テックブリッジ） =====
  HR('検証2 hero_h1 BEFORE (injectOntology=false)')
  const heroBefore = await generateCopyDraft({ companyId: TECHBRIDGE, role: 'hero_h1', register: 'neutral', injectOntology: false })
  heroBefore.bodies.forEach((b, i) => console.log(`  [${i + 1}] ${b}`))

  HR('検証2 hero_h1 AFTER (injectOntology=true)')
  const heroAfter = await generateCopyDraft({ companyId: TECHBRIDGE, role: 'hero_h1', register: 'neutral', injectOntology: true })
  heroAfter.bodies.forEach((b, i) => console.log(`  [${i + 1}] ${b}`))
  console.log('  injectedProofIds:', heroAfter.injectedProofIds.length)

  HR('検証2 body_copy BEFORE')
  const bodyBefore = await generateCopyDraft({ companyId: TECHBRIDGE, role: 'body_copy', register: 'neutral', injectOntology: false })
  bodyBefore.bodies.forEach((b) => console.log(`  ${b}`))

  HR('検証2 body_copy AFTER')
  const bodyAfter = await generateCopyDraft({ companyId: TECHBRIDGE, role: 'body_copy', register: 'neutral', injectOntology: true })
  bodyAfter.bodies.forEach((b) => console.log(`  ${b}`))

  // ===== 検証4: 役割の温度差（hero_h1 vs cta、ともに after） =====
  HR('検証4 cta AFTER（尖らない・定番許容）')
  const cta = await generateCopyDraft({ companyId: TECHBRIDGE, role: 'cta', register: 'neutral', injectOntology: true })
  cta.bodies.forEach((b, i) => console.log(`  [${i + 1}] ${b}`))

  // ===== 検証3: 0件フォールバック（テスト株式会社）＝例外なし・数字捏造なし =====
  HR('検証3 0件企業 hero_h1 AFTER（捏造なしを確認）')
  try {
    const zero = await generateCopyDraft({ companyId: ZERO, role: 'hero_h1', register: 'neutral', injectOntology: true })
    zero.bodies.forEach((b, i) => console.log(`  [${i + 1}] ${b}`))
    console.log('  injectedProofIds:', zero.injectedProofIds.length, '（0であるべき）')
    console.log('  例外なし: OK')
  } catch (e) {
    console.log('  例外発生（NG）:', (e as Error).message)
  }

  // ===== 検証5: デモdrafts永続化（テックブリッジに demo project＋after drafts を残す） =====
  HR('検証5 デモ project＋drafts を copy_drafts へ永続化（デモ企業のみ）')
  const supabase = getSupabaseAdmin()
  const { data: proj, error: pErr } = await supabase
    .from('copy_projects')
    .insert({ company_id: TECHBRIDGE, name: 'Stage2検証デモ', brief: 'コピーAI Stage2 の動作確認用デモ案件' })
    .select('id')
    .single()
  if (pErr || !proj) {
    console.log('  project作成エラー:', pErr?.message)
    return
  }
  const rows = [
    ...heroAfter.bodies.map((b) => ({ project_id: proj.id, copy_role: 'hero_h1', register: 'neutral', body: b, status: 'draft', generation_meta: { role: 'hero_h1', model: 'claude-sonnet-4-6', pipeline: 'v1', injectedProofIds: heroAfter.injectedProofIds, injectOntology: true } })),
    ...bodyAfter.bodies.map((b) => ({ project_id: proj.id, copy_role: 'body_copy', register: 'neutral', body: b, status: 'draft', generation_meta: { role: 'body_copy', model: 'claude-sonnet-4-6', pipeline: 'v1', injectedProofIds: bodyAfter.injectedProofIds, injectOntology: true } })),
  ]
  const { data: drafts, error: dErr } = await supabase.from('copy_drafts').insert(rows).select('id')
  console.log('  project_id:', proj.id)
  console.log('  inserted drafts:', drafts?.length ?? 0, dErr ? `(エラー: ${dErr.message})` : '')
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
