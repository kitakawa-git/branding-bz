// Stage3 検証（デモ企業＝テックブリッジのみ）。実行: npx tsx scripts/verify-copy-stage3.ts
import { readFileSync } from 'fs'; import { join } from 'path'
for (const line of readFileSync(join(process.cwd(), '.env.local'), 'utf-8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { SHARED_CLICHE } from '@/lib/copy/cliche-lexicon'
import { computeClicheDensity, computeInheritanceOverlap, detectFabricatedNumbers } from '@/lib/copy/metrics'
import { buildCopyOntologyBlocks } from '@/lib/copy/ontology-blocks'
import { reviewCopyDraft, isQuoteGrounded, INSPECTOR_MODEL } from '@/lib/copy/inspector'
import { autoRewrite, saveReview } from '@/lib/copy/rewrite'
import { generateCopyDraft } from '@/lib/copy/generate'

const T = '128a1513-54cc-4e59-8278-3d02b591e336'
const HR = (t: string) => console.log(`\n========== ${t} ==========`)

async function main() {
  // ===== Part A: 決定論メトリクス（LLM不要） =====
  HR('検証3 クリシェ検知（決定論）')
  const c = computeClicheDensity('DX推進で生産性向上をワンストップ支援します。', SHARED_CLICHE)
  console.log('  density:', c.density.toFixed(3), 'hits:', c.hits.join('、'))

  HR('検証4 継承重複検知（決定論）')
  const ontology = await buildCopyOntologyBlocks(T)
  const verbatim = ontology.intentStrings[0] || 'お客様の価値を最大化する体験を提供します'
  const o1 = computeInheritanceOverlap(verbatim, ontology.intentStrings, ontology.quotablePhrases)
  console.log('  INTENT逐語コピペ → overlap:', o1.overlap.toFixed(3), 'blankAfterMask:', o1.blankAfterMask, `(原文:「${verbatim.slice(0,30)}…」)`)
  const sloganOnly = 'わたしたちは挑戦を応援します'
  const o2 = computeInheritanceOverlap(sloganOnly, ontology.intentStrings, [sloganOnly])
  console.log('  スローガンだけ → overlap:', o2.overlap.toFixed(3), 'blankAfterMask:', o2.blankAfterMask)

  HR('数字捏造検知（決定論・補助）')
  console.log('  「成約率が98%向上」→ 捏造:', JSON.stringify(detectFabricatedNumbers('成約率が98%向上しました', ontology.factText)))
  console.log('  「利用者の92%が回答」→ 捏造:', JSON.stringify(detectFabricatedNumbers('利用者の92%が回答した', ontology.factText)), '（factに92%あり=空が正）')

  HR('検証7 ハルシネーション防護（決定論）')
  const body = '1973年から、眼科ひとすじ。'
  console.log('  本文に無いquote破棄:', isQuoteGrounded(body, '存在しない文字列') === false ? 'OK(破棄)' : 'NG')
  console.log('  本文にあるquote採用:', isQuoteGrounded(body, '眼科ひとすじ') === true ? 'OK(採用)' : 'NG')

  // ===== Part B: LLM批評（opus採点者） =====
  HR('検証2 退屈検知 before/after（body_copy・LLM）')
  const before = await generateCopyDraft({ companyId: T, role: 'body_copy', register: 'neutral', injectOntology: false })
  const rBefore = await reviewCopyDraft({ body: before.bodies[0], role: 'body_copy', ontology })
  console.log('  BEFORE craft:', rBefore.craftScore, 'brandFit:', rBefore.brandFit, 'redFlag:', rBefore.redFlag, 'reviewer:', rBefore.reviewerModel)
  console.log('    failed:', JSON.stringify(rBefore.llmFailed), 'critique:', rBefore.critique)
  const after = await generateCopyDraft({ companyId: T, role: 'body_copy', register: 'neutral', injectOntology: true })
  const rAfter = await reviewCopyDraft({ body: after.bodies[0], role: 'body_copy', ontology })
  console.log('  AFTER  craft:', rAfter.craftScore, 'brandFit:', rAfter.brandFit, 'redFlag:', rAfter.redFlag)
  console.log('    failed:', JSON.stringify(rAfter.llmFailed), 'critique:', rAfter.critique)
  console.log('  → craft差:', rAfter.craftScore - rBefore.craftScore)

  HR('検証5 藁人形検知（hero_h1・LLM）')
  const straw = 'もう、社員旅行で温泉に行く時代じゃない。テックブリッジは新しい福利厚生を提案する。'
  const rStraw = await reviewCopyDraft({ body: straw, role: 'hero_h1', ontology })
  console.log('  本文:', straw)
  console.log('  strawman failed:', rStraw.llmFailed.strawman === true, '/ stance_absent:', rStraw.llmFailed.stance_absent === true)
  console.log('  craft:', rStraw.craftScore, 'redFlag:', rStraw.redFlag, 'critique:', rStraw.critique)

  HR('検証6 処方箋のみ（リライト本文を書かない）')
  console.log('  surgicalEdits（方向のみ・本文フィールド無し）:')
  rBefore.surgicalEdits.slice(0, 3).forEach((e) => console.log(`   - quote:「${e.quote.slice(0,20)}…」problem:${e.problem} → dir:${e.rewrite_direction}`))

  // ===== 検証8: 自動リライト送還（デモ project に before draft を保存→autoRewrite） =====
  HR('検証8 自動リライト送還（parent_draft_id・最大2回）')
  const supabase = getSupabaseAdmin()
  const { data: proj } = await supabase.from('copy_projects')
    .insert({ company_id: T, name: 'Stage3検証デモ', brief: 'Stage3 自動リライト確認' }).select('id').single()
  const { data: d0 } = await supabase.from('copy_drafts')
    .insert({ project_id: proj!.id, copy_role: 'body_copy', register: 'neutral', body: before.bodies[0], status: 'draft',
      generation_meta: { role: 'body_copy', model: 'claude-sonnet-4-6', pipeline: 'v1', injectOntology: false } })
    .select('id').single()
  await saveReview(supabase, d0!.id, rBefore)
  if (rBefore.redFlag) {
    const rw = await autoRewrite({ supabase, project: { id: proj!.id, company_id: T, persona_id: null, brief: 'Stage3 自動リライト確認' },
      role: 'body_copy', register: 'neutral', ontology, current: { draftId: d0!.id, body: before.bodies[0], review: rBefore } })
    console.log('  stopped:', rw.stopped)
    rw.iterations.forEach((it) => console.log(`   iter${it.iteration}: draft=${it.draftId.slice(0,8)} parent張り済 craft=${it.craftScore} redFlag=${it.redFlag}`))
    console.log('  craft改善: before', rBefore.craftScore, '→', rw.iterations.at(-1)?.craftScore ?? '(なし)')
    // parent_draft_id 確認
    const { data: kids } = await supabase.from('copy_drafts').select('id, parent_draft_id').eq('parent_draft_id', d0!.id)
    console.log('  parent_draft_id付き子draft数:', kids?.length ?? 0)
  } else {
    console.log('  before が赤旗でないためリライト不要（craft=' + rBefore.craftScore + '）')
  }
  console.log('\n  inspector model =', INSPECTOR_MODEL, '/ generator = claude-sonnet-4-6')
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
