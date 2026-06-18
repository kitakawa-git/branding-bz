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
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { fetchPhilosophy } from '@/lib/brand/philosophy'
import { fetchElementsCatalog, type ElementKind } from '@/lib/brand/elements-catalog'

export type CopyOntologyBlocks = {
  intentBlock: string        // philosophy(mission/vision/value/action_guideline) + value_propositions（引用禁止素材）＋事業概要(引用可)
  factBlock: string          // proof_points（title/description/数字）＋ communicatedAsで承認済み要素
  rulesBlock: string         // governance_rules（severity・rule_text・NG/OK例）
  personaBlock: string       // brand_personas（name/description/needs/pain_points）
  injectedProofIds: string[] // generation_meta に残す（根拠の追跡）
  quotablePhrases: string[]  // communicatedAs承認フレーズ＋スローガン（Stage3のマスク用に温存）
}

const SEVERITY_LABEL: Record<string, string> = { block: '絶対遵守', warn: '原則遵守', info: '参考' }
const SOURCE_TYPE_LABEL: Record<string, string> = {
  jisseki: '実績', jirei: '事例', data: 'データ', voice: '顧客の声', award: '受賞', other: 'その他',
}

const txt = (s: string | null | undefined) => (s || '').replace(/\s+/g, ' ').trim()
const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : txt(String((x as { text?: string })?.text ?? x)))).filter(Boolean) : []

// brand_personas から1体ぶんの「読み手」ブロックを組む（personaId指定→該当、未指定→sort先頭）。
// 0件なら空文字（呼び出し側で「ペルソナ未登録」フォールバック）。
export async function fetchPersonaBlock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  companyId: string,
  personaId?: string,
): Promise<string> {
  if (!companyId) return ''
  const { data } = await supabase
    .from('brand_personas')
    .select('id, name, age_range, occupation, description, needs, pain_points, sort_order')
    .eq('company_id', companyId)
    .order('sort_order', { ascending: true })
  const rows = Array.isArray(data) ? data : []
  if (rows.length === 0) return ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = (personaId ? rows.find((r: any) => r.id === personaId) : null) ?? rows[0]
  if (!p) return ''
  const meta = [p.age_range, p.occupation].map(txt).filter(Boolean).join('・')
  const needs = arr(p.needs)
  const pains = arr(p.pain_points)
  return [
    `${txt(p.name) || '（名称未設定）'}${meta ? `（${meta}）` : ''}`,
    txt(p.description) ? `状況: ${txt(p.description)}` : '',
    needs.length ? `望み: ${needs.join(' / ')}` : '',
    pains.length ? `痛み・不満: ${pains.join(' / ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export async function buildCopyOntologyBlocks(
  companyId: string,
  personaId?: string,
): Promise<CopyOntologyBlocks> {
  const empty: CopyOntologyBlocks = {
    intentBlock: '', factBlock: '', rulesBlock: '', personaBlock: '',
    injectedProofIds: [], quotablePhrases: [],
  }
  if (!companyId) return empty
  const supabase = getSupabaseAdmin()

  const [philosophy, vpRes, proofRes, ruleRes, relRes, catalog, bgRes, personaBlock] = await Promise.all([
    fetchPhilosophy(supabase, companyId),
    supabase.from('value_propositions').select('title, description').eq('company_id', companyId).order('sort_order', { ascending: true }),
    supabase.from('proof_points').select('id, title, description, source_type').eq('company_id', companyId).order('sort_order', { ascending: true }),
    supabase.from('governance_rules').select('rule_text, ng_example, ok_example, severity').eq('company_id', companyId).order('sort_order', { ascending: true }),
    supabase.from('element_relations').select('source_kind, source_id, target_kind, target_id, relation_type').eq('company_id', companyId).eq('relation_type', 'communicatedAs').order('sort_order', { ascending: true }),
    fetchElementsCatalog(supabase, companyId),
    supabase.from('brand_guidelines').select('slogan').eq('company_id', companyId).maybeSingle(),
    fetchPersonaBlock(supabase, companyId, personaId),
  ])

  // ---- INTENT（引用禁止：意味だけ抜く）＋ 事業概要（引用可の客観情報） ----
  const serviceLines = philosophy.services
    .map((s) => [txt(s.title), txt(s.description)].filter(Boolean).join('：'))
    .filter(Boolean)
  const intentLines: string[] = []
  if (philosophy.mission) intentLines.push(`- ミッション: ${txt(philosophy.mission)}`)
  if (philosophy.vision) intentLines.push(`- ビジョン: ${txt(philosophy.vision)}`)
  for (const v of philosophy.values) {
    const t = [txt(v.name), txt(v.description)].filter(Boolean).join('：')
    if (t) intentLines.push(`- バリュー: ${t}`)
  }
  for (const g of philosophy.action_guidelines) {
    const t = [txt(g.title), txt(g.description)].filter(Boolean).join('：')
    if (t) intentLines.push(`- 行動指針: ${t}`)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vps = (Array.isArray(vpRes.data) ? vpRes.data : []) as any[]
  const vpLines = vps
    .map((v) => [txt(v.title), txt(v.description)].filter(Boolean).join('：'))
    .filter(Boolean)
    .map((t) => `- 提供価値: ${t}`)

  const intentSections: string[] = []
  if (serviceLines.length) {
    intentSections.push(`## 事業概要（客観情報・引用可）\n${serviceLines.map((s) => `- ${s}`).join('\n')}`)
  }
  if (intentLines.length || vpLines.length) {
    intentSections.push(
      `## 理念・価値観・提供価値（社内語彙＝引用禁止：語をそのまま使わず意味だけ抜く）\n${[...intentLines, ...vpLines].join('\n')}`,
    )
  }
  const intentBlock = intentSections.join('\n\n')

  // ---- FACT（引用可：数字・固有名詞の接地元） ----
  // proof_points: title空（要確認の空欄実績）は除外。※現行スキーマに needs_confirmation 列は無いため title 空で代替判定。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proofs = ((Array.isArray(proofRes.data) ? proofRes.data : []) as any[]).filter((p) => txt(p.title))
  const injectedProofIds = proofs.map((p) => p.id as string)
  const factLines = proofs.map((p) => {
    const label = SOURCE_TYPE_LABEL[p.source_type as string] ?? null
    const body = [txt(p.title), txt(p.description)].filter(Boolean).join('：')
    return `- ${body}${label ? `（${label}）` : ''}`
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

  // quotablePhrases：communicatedAs承認フレーズ＋スローガン（Stage3のマスク用に温存）
  const slogan = txt((bgRes.data as { slogan?: string } | null)?.slogan)
  const quotablePhrases = Array.from(new Set([...communicatedLabels, ...(slogan ? [slogan] : [])]))

  return { intentBlock, factBlock, rulesBlock, personaBlock, injectedProofIds, quotablePhrases }
}
