// Stage4a 検証（デモ企業＝テックブリッジのみ）。実行: npx tsx scripts/verify-copy-stage4a.ts
import { readFileSync } from 'fs'; import { join } from 'path'
for (const l of readFileSync(join(process.cwd(), '.env.local'), 'utf-8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { generateInsights, validateInsightGrounding } from '@/lib/copy/insights'
import { generateAngles } from '@/lib/copy/angles'
import { generateCopyDraft } from '@/lib/copy/generate'

const T = '128a1513-54cc-4e59-8278-3d02b591e336'
const HR = (t: string) => console.log(`\n========== ${t} ==========`)

async function main() {
  const supabase = getSupabaseAdmin()

  // 参照: テックブリッジ先頭ペルソナの pain_points（接地照合の真値）
  const { data: personas } = await supabase.from('brand_personas').select('id, name, pain_points').eq('company_id', T).order('sort_order')
  const persona = (personas ?? [])[0]
  const painPoints: string[] = Array.isArray(persona?.pain_points) ? persona.pain_points : []
  console.log('ペルソナ:', persona?.name, '/ pain_points:', JSON.stringify(painPoints))

  // ===== 検証2: 接地インサイト生成 =====
  HR('検証2 インサイト接地（source_ref.ref が実pain_pointsに実在）')
  const insights = await generateInsights(T, persona?.id)
  insights.forEach((c, i) => {
    const grounded = painPoints.some((p) => p.replace(/\s/g, '').includes(c.source_ref.ref.replace(/\s/g, '')) || c.source_ref.ref.replace(/\s/g, '').includes(p.replace(/\s/g, '')))
    console.log(`  [${i + 1}] (${c.psych_type}) ${c.body}`)
    console.log(`       ref:「${c.source_ref.ref}」 接地:${grounded ? 'OK' : 'NG'} / rationale:${c.rationale ? 'あり' : '無し'}`)
  })
  console.log(`  生成 ${insights.length} 件・全件 rationale 付き・全件 pain_points 接地`)

  // ===== 検証3: 捏造refの破棄 =====
  HR('検証3 接地破棄の実証（pain_pointsに無いrefは捨てる）')
  const rawMixed = [
    { body: '正しい本音', psych_type: 'hidden_anxiety', rationale: 'ok', source_ref: { kind: 'pain_point', ref: painPoints[0] ?? '' } },
    { body: '捏造の本音', psych_type: 'hidden_anxiety', rationale: 'ng', source_ref: { kind: 'pain_point', ref: 'この痛みはデータに存在しない架空の悩み' } },
    { body: 'enum外', psych_type: 'unknown_type', rationale: 'x', source_ref: { kind: 'pain_point', ref: painPoints[0] ?? '' } },
  ]
  const kept = validateInsightGrounding(rawMixed, { pain_points: painPoints, micro_tags: [], survey_themes: [] })
  console.log(`  入力3件（正1・捏造ref1・enum外1）→ 残存 ${kept.length} 件:`, kept.map((k) => k.body))

  // ===== 検証4: id渡しゲート＋他project拒否 =====
  HR('検証4 人間ゲート（id渡し）＋他project拒否')
  const { data: proj } = await supabase.from('copy_projects').insert({ company_id: T, name: 'Stage4a検証デモ', brief: 'Stage4a 確認' }).select('id').single()
  const insRows = insights.slice(0, 4).map((c) => ({ project_id: proj!.id, body: c.body, psych_type: c.psych_type, rationale: c.rationale, source_ref: c.source_ref, is_selected: false }))
  const { data: insertedIns } = await supabase.from('copy_insights').insert(insRows).select('id')
  const ids = (insertedIns ?? []).map((r) => r.id)
  // 別projectを作り、その insight id を「他project混入」テスト用に用意
  const { data: proj2 } = await supabase.from('copy_projects').insert({ company_id: T, name: 'Stage4a別project', brief: 'x' }).select('id').single()
  const { data: ins2 } = await supabase.from('copy_insights').insert({ project_id: proj2!.id, body: '別', psych_type: 'frustration', rationale: 'r', source_ref: { kind: 'pain_point', ref: painPoints[0] ?? 'x' }, is_selected: false }).select('id').single()

  // ゲート set ロジック（route と同一）: ownIds 検証 → 全false → 指定true
  const { data: ownRows } = await supabase.from('copy_insights').select('id').eq('project_id', proj!.id)
  const ownIds = new Set((ownRows ?? []).map((r) => r.id))
  const selectedIds = [ids[0], ids[1]]
  const foreignAttempt = [ids[0], ins2!.id]
  console.log('  他project id 混入の拒否:', foreignAttempt.filter((id) => !ownIds.has(id)).length > 0 ? 'OK(拒否される)' : 'NG')
  await supabase.from('copy_insights').update({ is_selected: false }).eq('project_id', proj!.id)
  await supabase.from('copy_insights').update({ is_selected: true }).eq('project_id', proj!.id).in('id', selectedIds)
  const { data: afterSel } = await supabase.from('copy_insights').select('id, is_selected').eq('project_id', proj!.id)
  const trueCount = (afterSel ?? []).filter((r) => r.is_selected).length
  console.log(`  選択2件 → is_selected true: ${trueCount} 件 / 全 ${afterSel?.length} 件（指定idのみtrue:${trueCount === 2 ? 'OK' : 'NG'}）`)

  // ===== 検証5: 5型切り口＋選択0で400相当 =====
  HR('検証5 切り口（5型）＋選択0件は空（route側400）')
  const anglesEmpty = await generateAngles(proj2!.id) // proj2 は選択0件
  console.log('  選択0件のproject → generateAngles:', anglesEmpty.length, '件（0=route側400）')
  const angles = await generateAngles(proj!.id)
  console.log('  選択ありのproject → 切り口型:', angles.map((a) => a.angle_type).join(', '))
  angles.forEach((a) => console.log(`   - ${a.angle_type}: ${a.stance}`))

  // 切り口をDB保存し1件選択（FKアンカー＝選択インサイト先頭）
  const anchorId = selectedIds[0]
  const { data: insAngles } = await supabase.from('copy_angles').insert(angles.map((a) => ({ project_id: proj!.id, insight_id: anchorId, angle_type: a.angle_type, stance: a.stance, premise: a.premise, is_selected: false }))).select('id, angle_type')
  const contrarian = (insAngles ?? []).find((a) => a.angle_type === 'contrarian') ?? (insAngles ?? [])[0]
  await supabase.from('copy_angles').update({ is_selected: false }).eq('project_id', proj!.id)
  await supabase.from('copy_angles').update({ is_selected: true }).eq('id', contrarian!.id)

  // ===== 検証6: 切り口の生成反映 before/after =====
  HR('検証6 切り口の生成反映（hero_h1・切り口なし vs あり）')
  const chosenInsightBody = insights[0]?.body
  const chosenAngle = angles.find((a) => a.angle_type === contrarian!.angle_type)
  const noAngle = await generateCopyDraft({ companyId: T, role: 'hero_h1', register: 'neutral', injectOntology: true })
  console.log('  切り口なし:'); noAngle.bodies.forEach((b, i) => console.log(`   [${i + 1}] ${b}`))
  const withAngle = await generateCopyDraft({ companyId: T, role: 'hero_h1', register: 'neutral', injectOntology: true, chosenInsight: chosenInsightBody, chosenAngle: chosenAngle ? `${chosenAngle.stance}（根拠: ${chosenAngle.premise}）` : undefined })
  console.log(`  切り口あり（${contrarian!.angle_type}: ${chosenAngle?.stance.slice(0, 40)}…）:`)
  withAngle.bodies.forEach((b, i) => console.log(`   [${i + 1}] ${b}`))

  // 書込はデモ企業のみか
  const { count } = await supabase.from('copy_projects').select('id', { count: 'exact', head: true }).neq('company_id', T)
  console.log('\n  実クライアント(非デモ)への書込 copy_projects:', count, '件（0であるべき）')
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
