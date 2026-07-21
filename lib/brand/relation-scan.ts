// AI関係スキャン（ステージA）: 既存の要素データから element_relations の候補をAIが推定する。
//
// 設計（profiling / map-review と同思想）:
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
  isValidRelationShape,
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

/** 焦点スキャンの対象要素。指定するとこの要素を端点に含む候補だけを返す */
export type FocusRef = { kind: ElementKind; id: string }

/** 焦点スキャンで返す候補の上限（1要素の繋ぎ先を選ぶ画面なので絞る） */
export const FOCUS_CANDIDATE_LIMIT = 5

// 各関係種別の意味定義（プロンプト用。方向の意味を明示する）。
// スキャンで提案するのはここに載せた種別だけ。
// - communicatedAs は廃止（レンジを定義できる要素種が無い）
// - 未来設計4種（aspiresTo 等）は獲得目標の設計判断であり、内容の類似から推定するものではない
//   ため対象外（以前は RELATION_TYPES 全10種を列挙して「6種のみ」と言い、4種の説明が
//   undefined になるバグがあった）。
const RELATION_DEFS: Record<string, string> = {
  guides: 'source（理念・ミッション・ビジョン・バリュー）が target の内容・在り方を方向づけている',
  evidencedBy: 'source（提供価値・理念などの約束・主張）が target（証拠・実績）によって裏づけられている',
  promisedTo: 'source（提供価値など）が target（ペルソナ＝約束の相手）に向けて約束されている',
  constrainedBy: 'source の表現・主張が target（表現ルール）によって制約されている',
  conflictsWith: 'source と target が両立しにくい・優先順位がぶつかる場面がありうる（対称的な関係）',
}

const SCAN_TYPES = RELATION_TYPES.filter((r) => r.value in RELATION_DEFS)
const VALID_RELATION_TYPES = new Set(SCAN_TYPES.map((r) => r.value))

const SYSTEM_PROMPT = `あなたはブランド戦略のオントロジー設計者です。ある企業のブランド要素（理念・提供価値・証拠・表現ルール・ペルソナ）の一覧から、要素間に成立している「関係」の候補を推定してください。

関係種別は以下の${SCAN_TYPES.length}種のみ:
${SCAN_TYPES.map((r) => `- ${r.value}（${r.label}）: ${RELATION_DEFS[r.value]}`).join('\n')}

判定方針（厳守）:
- 要素の内容（本文）から確信できる関係のみを提案する。こじつけ・一般論による推測は出さない。
- 同じ relation_type の関係が同一の target に3本以上集まりそうな場合は、最も代表的な1〜2本に絞って提案する。機械的な全列挙はしない。
- mission / vision から提供価値・事業内容への guides は、ブランドの背骨にあたる。本文に明確な根拠があれば優先的に提案してよい。
- 提供価値が要素一覧に無い（未選定の）会社では、バリュー（理念）と実績を結ぶ evidencedBy（バリューを実績が裏づける）を、明確な根拠があれば重視して提案する。
- ペルソナが要素一覧にいる場合、「どの提供価値（無ければ理念）が、どのペルソナへの約束か」を promisedTo で提案することを必ず検討する。ペルソナの課題・ニーズと約束の内容が対応していることが根拠になる。
- 内容が明確にぶつかる組（例: 低価格の約束と高品質保証の約束、スピードの約束と丁寧さのルール）があれば conflictsWith を遠慮なく提案する。矛盾の可視化は失敗ではなく、このスキャンの重要な成果である。
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

// 焦点スキャン用のシステムプロンプト。全体スキャンとの違いは「1要素の繋ぎ先だけを考える」点のみ。
// 判定方針・出力形式は全体スキャンと同一（同じ validateCandidates を通すため）。
const FOCUS_SYSTEM_PROMPT = `あなたはブランド戦略のオントロジー設計者です。ある企業のブランド要素の一覧と、そのうち1つの「焦点要素」が与えられます。焦点要素が他のどの要素と・どの関係で繋がるべきかの候補だけを推定してください。

関係種別は以下の${SCAN_TYPES.length}種のみ:
${SCAN_TYPES.map((r) => `- ${r.value}（${r.label}）: ${RELATION_DEFS[r.value]}`).join('\n')}

判定方針（厳守）:
- **焦点要素を source または target のどちらかに必ず含む候補だけ**を出す。焦点要素と無関係な要素どうしの関係は出さない。
- 方向は関係種別の定義に従って決める。焦点要素が常に source とは限らない（例: 焦点が実績なら、提供価値 -evidencedBy-> 実績 のように target 側になる）。
- 要素の内容（本文）から確信できる関係のみを提案する。こじつけ・一般論による推測は出さない。
- 「既存の関係（提案禁止）」に挙がっている組み合わせは提案しない。
- 同じ要素どうし（自己参照）は提案しない。
- 多くても${FOCUS_CANDIDATE_LIMIT}件まで。確信の高い順に並べる。
- rationale（理由）は必須。両要素の内容のどこが対応しているかを1〜2文の日本語で具体的に書く。
- confidence は high（本文どうしが明確に対応）/ medium（対応はあるが解釈を含む）/ low（推測）。low になるものはそもそも提案しない。
- 妥当な繋ぎ先が見つからなければ空配列 [] を返す。無理に埋めない。

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
  focus?: FocusRef | null,
): string {
  const focusBlock = (() => {
    if (!focus) return ''
    const e = catalog.find((x) => x.kind === focus.kind && x.id === focus.id)
    if (!e) return ''
    const body = bodies.get(`${e.kind}:${e.id}`)
    return `# 焦点要素（この要素の繋ぎ先だけを考える）\n- kind: ${e.kind}\n  id: ${e.id}\n  種別: ${KIND_LABELS[e.kind]}\n  内容: ${body || e.label}\n\n`
  })()
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
  return `${focusBlock}# 要素一覧\n${elementLines}\n\n# 既存の関係（提案禁止）\n${existingLines}`
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
// 自己参照 / relation_type 不正 / ドメイン・レンジ違反（RELATION_RULES＝DBトリガと同基準）/
// confidence が high・medium 以外 / rationale 無し / 候補内の重複
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

    if (!VALID_RELATION_TYPES.has(rt)) continue // スキャン対象外の関係種別
    if (!isValidRelationShape(rt, sk, tk)) continue // ドメイン/レンジ違反（DBトリガでも落ちる組）
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

/**
 * 焦点スキャンの後処理（純関数）。
 * AIが焦点要素と無関係な候補を混ぜてきても、ここで機械的に落とす＝プロンプト任せにしない。
 * 上限も適用する（表示側で切るとAI呼び出し分が無駄になるため、ここで確定させる）。
 */
export function filterToFocus(
  candidates: RelationCandidate[],
  focus: FocusRef,
  limit = FOCUS_CANDIDATE_LIMIT,
): RelationCandidate[] {
  return candidates
    .filter(
      (c) =>
        (c.source_kind === focus.kind && c.source_id === focus.id) ||
        (c.target_kind === focus.kind && c.target_id === focus.id),
    )
    .slice(0, limit)
}

export async function scanRelationCandidates(
  companyId: string,
  // 指定するとこの要素を端点に含む候補だけを返す（未指定＝従来の全体スキャン・挙動不変）
  focus?: FocusRef | null,
): Promise<RelationCandidate[]> {
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
    // 焦点要素がカタログに実在しない（削除済み・別company）ならAIを呼ばずに空で返す
    if (focus && !catalog.some((e) => e.kind === focus.kind && e.id === focus.id)) return []

    const raw = await callClaude({
      system: focus ? FOCUS_SYSTEM_PROMPT : SYSTEM_PROMPT,
      userMessage: buildUserMessage(catalog, bodies, existing, focus),
      maxTokens: 4096,
    })
    const validated = validateCandidates(extractJsonArray(raw), catalog, existing)
    return focus ? filterToFocus(validated, focus) : validated
  } catch (err) {
    console.error('[relation-scan] スキャン失敗:', err)
    return []
  }
}
