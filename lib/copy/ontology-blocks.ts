// コピーAI 3層分離アセンブラ（v1.2 設計の肝・Q3）。
//
// 素材を物理的に3層へ分けて生成器へ渡し、「意味の翻訳（引用禁止）」と「事実の接地（引用可）」を分離する:
//   INTENT（引用禁止）= philosophy_elements(mission/vision/value/action_guideline) + value_propositions
//                        ＋事業概要(service)は客観情報として引用可ラベルで同梱
//   FACT  （引用可）  = proof_points（数字・固有名詞の接地はここからのみ）
//                        ＋ element_relations.communicatedAs で「対外表現として承認済み」の要素
//   RULES （厳守）    = governance_rules（禁則）
//
// 既存 getGuardrailsPromptForCompany() は proof と rule を混ぜるため使わない（FACT/RULES分離が必須）。
// 取得は getSupabaseAdmin()（service_role）でRLSをバイパス。0件・失敗は空文字フォールバック（捏造させない）。
//
// §9 FACT/ASPIRATION の物理分離（未来設計）:
//   FACT       = proof_points（＋測定値）＋ lifecycle_state='current' の提供価値（null は current 扱い＝後方互換）
//   ASPIRATION = lifecycle_state ∈ {target, transition_candidate} の提供価値＋未達の獲得目標＋ビジョン
//   → ASPIRATION は「目指す/これから」の形でのみ言及可。事実として断定・数値引用してはならない。
//   → 獲得目標(desired_evidence)は met でも引用不可（引用できる事実は紐づく proof_points＝FACT のみ・§14.5）。
//   → ASPIRATION が0件なら注入なし＝従来挙動と完全一致。
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { fetchPhilosophy } from '@/lib/brand/philosophy'
import { fetchElementsCatalog, type ElementKind } from '@/lib/brand/elements-catalog'
import { fetchEvaluationBundles } from '@/lib/brand/future-design/fetch'
import { resolveEvaluation } from '@/lib/brand/future-design/human-judgment'

export type CopyOntologyBlocks = {
  intentBlock: string        // philosophy(mission/vision/value/action_guideline) + value_propositions（引用禁止素材）＋事業概要(引用可)
  factBlock: string          // proof_points（title/description/数字）＋ communicatedAsで承認済み要素＋現在の提供価値
  aspirationBlock: string    // §9 未来（target/transition_candidate の提供価値・未達の獲得目標・ビジョン）。断定・引用禁止
  rulesBlock: string         // governance_rules（severity・rule_text・NG/OK例）
  personaBlock: string       // brand_personas（name/description/needs/pain_points）
  injectedProofIds: string[] // generation_meta に残す（根拠の追跡）
  quotablePhrases: string[]  // communicatedAs承認フレーズ＋スローガン（Stage3のマスク用に温存）
  intentStrings: string[]    // INTENT素材の生フレーズ（引用禁止対象。Stage3 継承重複の照合元）
  factText: string           // FACT素材の生コーパス（Stage3 数字捏造照合元＝proof+承認表現）
  painPoints: string[]       // 対象ペルソナの pain_points（Stage3 藁人形判定の素材）
  bannedTerms: string[]      // governance_rules(banned_word/discouraged_expression)の生語（Stage3 クリシェ密度の照合元）
}

const SEVERITY_LABEL: Record<string, string> = { block: '絶対遵守', warn: '原則遵守', info: '参考' }
const SOURCE_TYPE_LABEL: Record<string, string> = {
  jisseki: '実績', jirei: '事例', data: 'データ', voice: '顧客の声', award: '受賞', other: 'その他',
}

const txt = (s: string | null | undefined) => (s || '').replace(/\s+/g, ' ').trim()
const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : txt(String((x as { text?: string })?.text ?? x)))).filter(Boolean) : []

export type RuleLike = { rule_text?: string | null; ng_example?: string | null; rule_type?: string | null }

/**
 * 禁止語チェック（Stage3 クリシェ密度）の照合元を取り出す。
 * rule_type='banned_word' の rule_text / ng_example のみを対象にする。
 */
export function extractBannedTerms(rules: RuleLike[]): string[] {
  return Array.from(
    new Set(
      rules
        .filter((r) => r.rule_type === 'banned_word')
        .flatMap((r) => [txt(r.rule_text), txt(r.ng_example)])
        .filter(Boolean),
    ),
  )
}

// ---- §9 FACT/ASPIRATION 分離の純粋ロジック（DB非依存＝単体テスト対象） ----

export type VpLike = { title?: string | null; description?: string | null; lifecycle_state?: string | null }
export type DeLike = { title?: string | null; description?: string | null; state: string }

/** lifecycle_state が未設定の提供価値は current 扱い（後方互換） */
export const isCurrentVp = (v: VpLike): boolean => (v.lifecycle_state ?? 'current') === 'current'
/** target / transition_candidate は「未来の約束」。transition_candidate は昇格まで保守的に ASPIRATION 扱い。 */
export const isAspirationVp = (v: VpLike): boolean =>
  v.lifecycle_state === 'target' || v.lifecycle_state === 'transition_candidate'

const vpText = (v: VpLike) => [txt(v.title), txt(v.description)].filter(Boolean).join('：')

/**
 * ASPIRATION ブロックを組み立てる。素材が1件も無ければ空文字を返す（＝注入なし＝従来挙動）。
 * ここに入るものは「事実として断定・引用してはならない」素材のみ。
 */
export function buildAspirationBlock(input: {
  vps: VpLike[]
  desiredEvidence: DeLike[]
  vision?: string | null
}): { block: string; strings: string[] } {
  const lines: string[] = []
  const strings: string[] = []

  const vision = txt(input.vision)
  if (vision) {
    lines.push(`- 目指す姿（ビジョン）: ${vision}`)
    strings.push(vision)
  }
  for (const v of input.vps.filter(isAspirationVp)) {
    const t = vpText(v)
    if (!t) continue
    const stateNote = v.lifecycle_state === 'transition_candidate' ? '移行候補・まだ確定していない' : 'これから約束したい価値'
    lines.push(`- 未来の提供価値（${stateNote}）: ${t}`)
    strings.push(txt(v.title), txt(v.description))
  }
  // 達成済み(met)の獲得目標も、獲得目標そのものは引用対象にしない（§14.5）。未達のものだけ「これから」として示す。
  for (const d of input.desiredEvidence.filter((d) => d.state !== 'met')) {
    const t = [txt(d.title), txt(d.description)].filter(Boolean).join('：')
    if (!t) continue
    lines.push(`- これから獲得する証拠（未達成）: ${t}`)
    strings.push(txt(d.title))
  }

  if (lines.length === 0) return { block: '', strings: [] }
  return { block: lines.join('\n'), strings: Array.from(new Set(strings.filter(Boolean))) }
}

// brand_personas から1体ぶんの「読み手」データを取り出す（personaId指定→該当、未指定→sort先頭）。
// block=プロンプト用整形文字列、painPoints=藁人形判定などStage3で使う生配列。
// 0件なら block='' / painPoints=[]（呼び出し側で「ペルソナ未登録」フォールバック）。
export async function fetchPersonaData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  companyId: string,
  personaId?: string,
): Promise<{ block: string; painPoints: string[] }> {
  if (!companyId) return { block: '', painPoints: [] }
  const { data } = await supabase
    .from('brand_personas')
    .select('id, name, age_range, occupation, description, needs, pain_points, sort_order')
    .eq('company_id', companyId)
    .order('sort_order', { ascending: true })
  const rows = Array.isArray(data) ? data : []
  if (rows.length === 0) return { block: '', painPoints: [] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = (personaId ? rows.find((r: any) => r.id === personaId) : null) ?? rows[0]
  if (!p) return { block: '', painPoints: [] }
  const meta = [p.age_range, p.occupation].map(txt).filter(Boolean).join('・')
  const needs = arr(p.needs)
  const pains = arr(p.pain_points)
  const block = [
    `${txt(p.name) || '（名称未設定）'}${meta ? `（${meta}）` : ''}`,
    txt(p.description) ? `状況: ${txt(p.description)}` : '',
    needs.length ? `望み: ${needs.join(' / ')}` : '',
    pains.length ? `痛み・不満: ${pains.join(' / ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
  return { block, painPoints: pains }
}

// 後方互換: 整形済みブロック文字列のみ返す（generate.ts のベースライン経路が使用）。
export async function fetchPersonaBlock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  companyId: string,
  personaId?: string,
): Promise<string> {
  return (await fetchPersonaData(supabase, companyId, personaId)).block
}

export async function buildCopyOntologyBlocks(
  companyId: string,
  personaId?: string,
): Promise<CopyOntologyBlocks> {
  const empty: CopyOntologyBlocks = {
    intentBlock: '', factBlock: '', aspirationBlock: '', rulesBlock: '', personaBlock: '',
    injectedProofIds: [], quotablePhrases: [], intentStrings: [], factText: '', painPoints: [], bannedTerms: [],
  }
  if (!companyId) return empty
  const supabase = getSupabaseAdmin()

  const [philosophy, vpRes, proofRes, ruleRes, relRes, catalog, bgRes, personaData] = await Promise.all([
    fetchPhilosophy(supabase, companyId),
    supabase.from('value_propositions').select('title, description, lifecycle_state').eq('company_id', companyId).order('sort_order', { ascending: true }),
    supabase.from('proof_points').select('id, title, description, source_type').eq('company_id', companyId).order('sort_order', { ascending: true }),
    supabase.from('governance_rules').select('rule_text, ng_example, ok_example, severity, rule_type').eq('company_id', companyId).order('sort_order', { ascending: true }),
    supabase.from('element_relations').select('source_kind, source_id, target_kind, target_id, relation_type').eq('company_id', companyId).eq('relation_type', 'communicatedAs').order('sort_order', { ascending: true }),
    fetchElementsCatalog(supabase, companyId),
    supabase.from('brand_guidelines').select('slogan').eq('company_id', companyId).maybeSingle(),
    fetchPersonaData(supabase, companyId, personaId),
  ])
  const personaBlock = personaData.block

  // ---- INTENT（引用禁止：意味だけ抜く）＋ 事業概要（引用可の客観情報） ----
  const serviceLines = philosophy.services
    .map((s) => [txt(s.title), txt(s.description)].filter(Boolean).join('：'))
    .filter(Boolean)
  const intentLines: string[] = []
  const intentStrings: string[] = [] // 継承重複の照合元（引用禁止素材の生フレーズ。service=引用可は含めない）
  if (philosophy.mission) { intentLines.push(`- ミッション: ${txt(philosophy.mission)}`); intentStrings.push(txt(philosophy.mission)) }
  // ※ビジョンは §9 で ASPIRATION（未来）に置くため INTENT には出さない（同じ素材を二重注入しない）。
  //   引用禁止であることは変わらないので intentStrings（Stage3の照合元）には残す。
  if (philosophy.vision) intentStrings.push(txt(philosophy.vision))
  for (const v of philosophy.values) {
    const t = [txt(v.name), txt(v.description)].filter(Boolean).join('：')
    if (t) { intentLines.push(`- バリュー: ${t}`); intentStrings.push(txt(v.name), txt(v.description)) }
  }
  for (const g of philosophy.action_guidelines) {
    const t = [txt(g.title), txt(g.description)].filter(Boolean).join('：')
    if (t) { intentLines.push(`- 行動指針: ${t}`); intentStrings.push(txt(g.title), txt(g.description)) }
  }
  // §9 提供価値は lifecycle_state で行き先が変わる: current→FACT / target・transition_candidate→ASPIRATION。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vps = (Array.isArray(vpRes.data) ? vpRes.data : []) as VpLike[]
  const currentVps = vps.filter(isCurrentVp)
  const currentVpTexts = currentVps.map(vpText).filter(Boolean)
  // INTENT に残すのは「引用禁止」の未来側だけ（current は FACT へ移すので intentStrings に入れない）
  for (const v of vps.filter(isAspirationVp)) intentStrings.push(txt(v.title), txt(v.description))

  const intentSections: string[] = []
  if (serviceLines.length) {
    intentSections.push(`## 事業概要（客観情報・引用可）\n${serviceLines.map((s) => `- ${s}`).join('\n')}`)
  }
  if (intentLines.length) {
    intentSections.push(
      `## 理念・価値観（社内語彙＝引用禁止：語をそのまま使わず意味だけ抜く）\n${intentLines.join('\n')}`,
    )
  }
  const intentBlock = intentSections.join('\n\n')

  // ---- FACT（引用可：数字・固有名詞の接地元） ----
  // proof_points 除外: title空、および description 先頭が【要確認】の未確定実績（現行スキーマに
  // needs_confirmation 列は無いため、description 先頭の【要確認】を「要確認」フラグとして扱う）。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proofs = ((Array.isArray(proofRes.data) ? proofRes.data : []) as any[]).filter(
    (p) => txt(p.title) && !txt(p.description).startsWith('【要確認】'),
  )
  const injectedProofIds = proofs.map((p) => p.id as string)

  // 測定値（proof_point_measurements）＝事実。実績行にぶら下げて引用可の数字として渡す。
  const { data: measData } = await supabase
    .from('proof_point_measurements')
    .select('proof_point_id, metric_label, metric_key, metric_value, metric_unit, measured_at')
    .eq('company_id', companyId)
    .in('proof_point_id', injectedProofIds.length ? injectedProofIds : ['00000000-0000-0000-0000-000000000000'])
  const measByProof = new Map<string, string[]>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const m of (Array.isArray(measData) ? measData : []) as any[]) {
    const label = txt(m.metric_label) || txt(m.metric_key)
    const value = `${m.metric_value}${txt(m.metric_unit)}`
    const when = txt(m.measured_at) ? `${txt(m.measured_at)}時点` : ''
    const line = [label, value].filter(Boolean).join(' ') + (when ? `（${when}）` : '')
    const arr2 = measByProof.get(m.proof_point_id as string) ?? []
    arr2.push(line)
    measByProof.set(m.proof_point_id as string, arr2)
  }

  const factLines = proofs.map((p) => {
    const label = SOURCE_TYPE_LABEL[p.source_type as string] ?? null
    const body = [txt(p.title), txt(p.description)].filter(Boolean).join('：')
    const ms = measByProof.get(p.id as string) ?? []
    return `- ${body}${label ? `（${label}）` : ''}${ms.length ? ` ／ 測定値: ${ms.join('・')}` : ''}`
  })

  // communicatedAs：対外表現として承認済みの要素ラベル（引用可）
  const labelMap = new Map(catalog.map((e) => [`${e.kind}:${e.id}`, e.label]))
  const refLabel = (kind: ElementKind, id: string) => labelMap.get(`${kind}:${id}`) ?? ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rels = (Array.isArray(relRes.data) ? relRes.data : []) as any[]
  const communicatedLabels: string[] = []
  for (const r of rels) {
    const target = txt(refLabel(r.target_kind, r.target_id)) // 「A は B として表現される」の B＝承認済み対外表現
    if (target) communicatedLabels.push(target)
  }
  const factSections: string[] = []
  if (factLines.length) factSections.push(`## 実績・証拠（この数字・固有名詞のみ引用可）\n${factLines.join('\n')}`)
  if (currentVpTexts.length) {
    factSections.push(
      `## 現在の提供価値（すでに約束している＝事実として言い切ってよい）\n${currentVpTexts.map((t) => `- ${t}`).join('\n')}`,
    )
  }
  if (communicatedLabels.length) {
    factSections.push(
      `## 承認済みの対外表現（そのまま使ってよい）\n${communicatedLabels.map((l) => `- 「${l}」`).join('\n')}`,
    )
  }
  const factBlock = factSections.join('\n\n')

  // ---- RULES（厳守：禁則） ----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rules = (Array.isArray(ruleRes.data) ? ruleRes.data : []) as any[]
  const ruleLines = rules
    .filter((r) => txt(r.rule_text))
    .map((r) => {
      const sev = SEVERITY_LABEL[r.severity as string] ?? r.severity ?? ''
      const ex = [
        txt(r.ng_example) ? `NG例: ${txt(r.ng_example)}` : '',
        txt(r.ok_example) ? `OK例: ${txt(r.ok_example)}` : '',
      ]
        .filter(Boolean)
        .join(' / ')
      return `- [${sev}] ${txt(r.rule_text)}${ex ? `（${ex}）` : ''}`
    })
  const rulesBlock = ruleLines.join('\n')

  // bannedTerms: クリシェ密度の照合元（禁止語の生語＝rule_text＋ng_example）。
  // ※ rule_type の実在値は banned_word / claim_rule / compliance_rule / tone_rule。
  //   禁止語彙は banned_word のみ（かつては非実在の 'discouraged_expression' を見ていて常に空だった）。
  const bannedTerms = extractBannedTerms(rules)

  // quotablePhrases：communicatedAs承認フレーズ＋スローガン（Stage3のマスク用に温存）
  const slogan = txt((bgRes.data as { slogan?: string } | null)?.slogan)
  const quotablePhrases = Array.from(new Set([...communicatedLabels, ...(slogan ? [slogan] : [])]))

  // factText: 数字捏造照合の生コーパス（proof title+description ＋ 測定値 ＋ 承認済み対外表現 ＋ 現在の提供価値）。
  const factText = [
    ...proofs.map((p) => [txt(p.title), txt(p.description)].filter(Boolean).join(' ')),
    ...Array.from(measByProof.values()).flat(),
    ...communicatedLabels,
    ...currentVpTexts,
  ].join(' ')

  // ---- ASPIRATION（§9・断定/引用禁止：未来の話） ----
  // 獲得目標の達成状態は future-design で判定（読み取りのみ）。失敗・0件なら ASPIRATION は出さない。
  let deLikes: DeLike[] = []
  try {
    const bundles = await fetchEvaluationBundles(companyId)
    deLikes = bundles.map((b) => ({
      title: b.row.title,
      state: resolveEvaluation(b.de, b.proofs, b.humanJudgment, { currentRuleHash: b.currentRuleHash }).state,
    }))
  } catch (err) {
    console.warn('[copy/ontology] 獲得目標の判定に失敗（ASPIRATIONから除外）:', err)
  }
  const aspiration = buildAspirationBlock({ vps, desiredEvidence: deLikes, vision: philosophy.vision })
  const aspirationBlock = aspiration.block
  // ASPIRATION も引用禁止素材＝Stage3 の継承重複照合に含める
  for (const s of aspiration.strings) intentStrings.push(s)

  return {
    intentBlock, factBlock, aspirationBlock, rulesBlock, personaBlock, injectedProofIds, quotablePhrases,
    intentStrings: Array.from(new Set(intentStrings.filter(Boolean))),
    factText,
    painPoints: personaData.painPoints,
    bannedTerms,
  }
}
