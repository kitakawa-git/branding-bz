// AI関係スキャン（ステージA）: 既存の要素データから element_relations の候補をAIが推定する。
//
// 設計（integrity-ai と同思想）:
// - 草案のみ。このモジュールはDBへ一切書き込まない。登録は superadmin UI での人間承認後
//   （クライアント supabase INSERT。RLS・検証トリガが効く経路）。
// - 1社1回の Claude 呼び出し。既存エッジ一覧を渡して「既出の組は提案しない」差分スキャン。
// - ハルシネーション防護: source/target の kind+id がカタログに実在しない候補、既存エッジと
//   重複する候補、自己参照、confidence: low、rationale 無しはコード側で破棄する。
// - 0件・API失敗時は空配列を返す（例外を上げない）。
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { callClaude } from '@/lib/claude-api'
import {
  fetchElementsCatalog,
  KIND_LABELS,
  RELATION_TYPES,
  type ElementKind,
  type ElementRef,
} from '@/lib/brand/elements-catalog'

export type RelationCandidate = {
  source_kind: ElementKind
  source_id: string
  source_label: string
  target_kind: ElementKind
  target_id: string
  target_label: string
  relation_type: string
  confidence: 'high' | 'medium'
  rationale: string
}

export type ExistingEdge = {
  source_kind: string
  source_id: string
  target_kind: string
  target_id: string
  relation_type: string
}

const VALID_RELATION_TYPES = new Set(RELATION_TYPES.map((r) => r.value))

// 各関係種別の意味定義（プロンプト用。方向の意味を明示する）
const RELATION_DEFS: Record<string, string> = {
  guides: 'source（理念・ミッション・ビジョン・バリュー）が target の内容・在り方を方向づけている',
  evidencedBy: 'source（提供価値・理念などの約束・主張）が target（証拠・実績）によって裏づけられている',
  promisedTo: 'source（提供価値など）が target（ペルソナ＝約束の相手）に向けて約束されている',
  communicatedAs: 'source（理念・提供価値）が target の表現・言葉として打ち出されている',
  constrainedBy: 'source の表現・主張が target（表現ルール）によって制約されている',
  conflictsWith: 'source と target が両立しにくい・優先順位がぶつかる場面がありうる（対称的な関係）',
}

const SYSTEM_PROMPT = `あなたはブランド戦略のオントロジー設計者です。ある企業のブランド要素（理念・提供価値・証拠・表現ルール・ペルソナ）の一覧から、要素間に成立している「関係」の候補を推定してください。

関係種別は以下の6種のみ:
${RELATION_TYPES.map((r) => `- ${r.value}（${r.label}）: ${RELATION_DEFS[r.value]}`).join('\n')}

判定方針（厳守）:
- 要素の内容（本文）から確信できる関係のみを提案する。こじつけ・一般論による推測は出さない。
- 同じ relation_type の関係が同一の target に3本以上集まりそうな場合は、最も代表的な1〜2本に絞って提案する。機械的な全列挙はしない。
- mission / vision から提供価値・事業内容への guides は、ブランドの背骨にあたる。本文に明確な根拠があれば優先的に提案してよい。
- 「既存の関係（提案禁止）」に挙がっている組み合わせは提案しない。
- 同じ要素どうし（自己参照）は提案しない。
- rationale（理由）は必須。両要素の内容のどこが対応しているかを1〜2文の日本語で具体的に書く。
- confidence は high（本文どうしが明確に対応）/ medium（対応はあるが解釈を含む）/ low（推測）。low になるものはそもそも提案しない。
- 関係が1つも見つからなければ空配列 [] を返す。

出力は以下のJSON配列のみ。前後に説明文やMarkdownのコードブロックを付けないこと:
[
  {
    "source_kind": "要素一覧に与えられた kind をそのまま",
    "source_id": "要素一覧に与えられた id をそのまま",
    "target_kind": "同上",
    "target_id": "同上",
    "relation_type": "6種のいずれか",
    "confidence": "high または medium",
    "rationale": "この関係が成立すると判断した理由（日本語1〜2文）"
  }
]`

function truncate(s: string, n = 300): string {
  const t = (s || '').replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n) + '…' : t
}

// 要素ごとの本文（プロンプト用）。カタログのラベルは48字スニペットのため、判断材料として
// description / body 等を別途取得して `${kind}:${id}` → 本文 のマップにする。
async function collectElementBodies(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  companyId: string,
): Promise<Map<string, string>> {
  const [philR, vpR, ppR, govR, personaR] = await Promise.all([
    supabase.from('philosophy_elements').select('id, element_type, title, body').eq('company_id', companyId),
    supabase.from('value_propositions').select('id, title, description').eq('company_id', companyId),
    supabase.from('proof_points').select('id, title, description, source_type').eq('company_id', companyId),
    supabase.from('governance_rules').select('id, rule_type, rule_text, ng_example, ok_example').eq('company_id', companyId),
    supabase.from('brand_personas').select('id, name, description, needs, pain_points').eq('company_id', companyId),
  ])
  const map = new Map<string, string>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (philR.data as any[] | null) || []) {
    map.set(`philosophy_element:${r.id}`, truncate([r.title, r.body].filter(Boolean).join('：')))
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (vpR.data as any[] | null) || []) {
    map.set(`value_proposition:${r.id}`, truncate([r.title, r.description].filter(Boolean).join('：')))
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (ppR.data as any[] | null) || []) {
    const src = r.source_type ? `（出典種別: ${r.source_type}）` : ''
    map.set(`proof_point:${r.id}`, truncate([r.title, r.description].filter(Boolean).join('：') + src))
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (govR.data as any[] | null) || []) {
    const ng = r.ng_example ? `／NG例:「${r.ng_example}」` : ''
    const ok = r.ok_example ? `／OK例:「${r.ok_example}」` : ''
    map.set(`governance_rule:${r.id}`, truncate(`[${r.rule_type}] ${r.rule_text || ''}${ng}${ok}`))
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (personaR.data as any[] | null) || []) {
    const needs = Array.isArray(r.needs) && r.needs.length ? `／ニーズ: ${r.needs.join('、')}` : ''
    const pains = Array.isArray(r.pain_points) && r.pain_points.length ? `／課題: ${r.pain_points.join('、')}` : ''
    map.set(`persona:${r.id}`, truncate([r.name, r.description].filter(Boolean).join('：') + needs + pains))
  }
  return map
}

function buildUserMessage(
  catalog: ElementRef[],
  bodies: Map<string, string>,
  existing: ExistingEdge[],
): string {
  const elementLines = catalog
    .map((e) => {
      const body = bodies.get(`${e.kind}:${e.id}`)
      return `- kind: ${e.kind}\n  id: ${e.id}\n  種別: ${KIND_LABELS[e.kind]}\n  内容: ${body || e.label}`
    })
    .join('\n')
  const existingLines =
    existing.length === 0
      ? '（なし）'
      : existing
          .map((r) => `- ${r.source_kind}:${r.source_id} -${r.relation_type}-> ${r.target_kind}:${r.target_id}`)
          .join('\n')
  return `# 要素一覧\n${elementLines}\n\n# 既存の関係（提案禁止）\n${existingLines}`
}

// Claude応答からJSON配列を抽出（Markdownコードブロック対応・失敗時は空配列）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractJsonArray(text: string): any[] {
  let s = (text || '').trim()
  const m = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (m) s = m[1].trim()
  const start = s.indexOf('[')
  const end = s.lastIndexOf(']')
  if (start < 0 || end < 0) return []
  try {
    const parsed = JSON.parse(s.slice(start, end + 1))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const edgeKey = (sk: string, sid: string, rt: string, tk: string, tid: string) =>
  `${sk}:${sid}|${rt}|${tk}:${tid}`

// AI出力の後処理バリデーション（ユニットテスト可能なよう分離・純関数）。
// 破棄条件: 実在しない kind+id / 既存エッジとの重複（conflictsWith は逆向きも重複扱い）/
// 自己参照 / relation_type 不正 / confidence が high・medium 以外 / rationale 無し / 候補内の重複
export function validateCandidates(
  raw: unknown[],
  catalog: ElementRef[],
  existing: ExistingEdge[],
): RelationCandidate[] {
  const labelMap = new Map(catalog.map((e) => [`${e.kind}:${e.id}`, e.label]))
  const existingKeys = new Set<string>()
  for (const r of existing) {
    existingKeys.add(edgeKey(r.source_kind, r.source_id, r.relation_type, r.target_kind, r.target_id))
    // conflictsWith は対称関係のため逆向きも既出扱い
    if (r.relation_type === 'conflictsWith') {
      existingKeys.add(edgeKey(r.target_kind, r.target_id, r.relation_type, r.source_kind, r.source_id))
    }
  }

  const out: RelationCandidate[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = item as any
    const sk = String(f?.source_kind ?? '').trim()
    const sid = String(f?.source_id ?? '').trim()
    const tk = String(f?.target_kind ?? '').trim()
    const tid = String(f?.target_id ?? '').trim()
    const rt = String(f?.relation_type ?? '').trim()
    const rationale = typeof f?.rationale === 'string' ? f.rationale.trim() : ''
    const confidence = f?.confidence === 'high' ? 'high' : f?.confidence === 'medium' ? 'medium' : null

    if (!VALID_RELATION_TYPES.has(rt)) continue // 関係種別が6種以外
    if (!confidence) continue // low・不正値は破棄
    if (!rationale) continue // 理由なしは破棄
    const sourceLabel = labelMap.get(`${sk}:${sid}`)
    const targetLabel = labelMap.get(`${tk}:${tid}`)
    if (!sourceLabel || !targetLabel) continue // 実在しない端点は破棄
    if (sk === tk && sid === tid) continue // 自己参照

    const key = edgeKey(sk, sid, rt, tk, tid)
    const revKey = rt === 'conflictsWith' ? edgeKey(tk, tid, rt, sk, sid) : null
    if (existingKeys.has(key)) continue // 既存エッジと重複
    if (seen.has(key) || (revKey && seen.has(revKey))) continue // 候補内の重複
    seen.add(key)

    out.push({
      source_kind: sk as ElementKind,
      source_id: sid,
      source_label: sourceLabel,
      target_kind: tk as ElementKind,
      target_id: tid,
      target_label: targetLabel,
      relation_type: rt,
      confidence,
      rationale,
    })
  }
  return out
}

export async function scanRelationCandidates(companyId: string): Promise<RelationCandidate[]> {
  if (!companyId) return []
  const supabase = getSupabaseAdmin()

  try {
    const [catalog, bodies, erR] = await Promise.all([
      fetchElementsCatalog(supabase, companyId),
      collectElementBodies(supabase, companyId),
      supabase
        .from('element_relations')
        .select('source_kind, source_id, target_kind, target_id, relation_type')
        .eq('company_id', companyId),
    ])
    if (erR.error) {
      console.error('[relation-scan] element_relations 取得失敗:', erR.error)
      return []
    }
    const existing = (erR.data as ExistingEdge[] | null) || []
    if (catalog.length < 2) return [] // 要素が2つ未満なら関係は成立しない

    const raw = await callClaude({
      system: SYSTEM_PROMPT,
      userMessage: buildUserMessage(catalog, bodies, existing),
      maxTokens: 4096,
    })
    return validateCandidates(extractJsonArray(raw), catalog, existing)
  } catch (err) {
    console.error('[relation-scan] スキャン失敗:', err)
    return []
  }
}
