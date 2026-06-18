// コピーAI インスペクター（Stage3: 批評＝二値判定＋処方箋のみ）。
//
// 原則:
//   Q1: LLMに点数を出させない。チェック項目の二値(failed)＋本文の実引用(quote)のみ返させ、craftはTSで合成。
//   Q1揺さぶり: 役割で適用チェック項目を絞る（hero_h1の断定必須とctaの断定厳禁で正負が逆転するため）。
//   Q4: リライト本文を書かせない。surgical_edits（処方箋＝方向）のみ。
//   モデル分離: インスペクター＝claude-opus-4-8（出題者≠採点者）。
//   ハルシネーション防護: quote が本文に実在しない指摘は破棄。
import { callClaude } from '@/lib/claude-api'
import { COPY_ROLE_MATRIX, type CopyRole } from '@/lib/copy/role-matrix'
import { SHARED_CLICHE } from '@/lib/copy/cliche-lexicon'
import type { CopyOntologyBlocks } from '@/lib/copy/ontology-blocks'
import { computeClicheDensity, computeInheritanceOverlap, detectFabricatedNumbers } from '@/lib/copy/metrics'
import {
  checksForRole,
  CHECKLIST,
  computeAxes,
  computeCraftScore,
  computeBrandFit,
  computeRedFlag,
  type CheckId,
  type AxisScores,
  type CodeMetrics,
} from '@/lib/copy/score'

export const INSPECTOR_MODEL = 'claude-opus-4-8'

// ハルシネーション防護: 指摘の quote が本文に実在するか（実在しない指摘は破棄する）。
export function isQuoteGrounded(body: string, quote: string | null | undefined): boolean {
  const q = (quote ?? '').trim()
  return q.length > 0 && body.includes(q)
}

export type SurgicalEdit = { quote: string; problem: string; rewrite_direction: string }

export type CopyReview = {
  axes: AxisScores
  craftScore: number
  brandFit: number
  redFlag: boolean
  critique: string
  surgicalEdits: SurgicalEdit[]
  llmFailed: Partial<Record<CheckId, boolean>>
  code: CodeMetrics
  reviewerModel: string
}

const STANCE_MODE_JP: Record<string, string> = {
  required: '必須', recommended: '推奨', none: '不要', forbidden: '厳禁',
}

function buildInspectorSystem(role: CopyRole, body: string, ontology: CopyOntologyBlocks, competitorNames: string[]): string {
  const spec = COPY_ROLE_MATRIX[role]
  const checks = checksForRole(role)
  const checklistText = checks.map((id) => `- ${id}: ${CHECKLIST[id].desc}`).join('\n')
  return `あなたは20年選手のコピー編集者です。後輩のコピーを容赦なく査定します。
励まし・点の盛り・総合所感は禁止。評価は「感想」でなく「どの語をどう直すか」で示せ。

# 判定対象
役割: ${spec.label}（尖り度目標 ${spec.sharpness}/100・態度表明:${STANCE_MODE_JP[spec.stance] ?? spec.stance}）
コピー本文: 「${body}」
このブランドの事実(FACT・引用してよい範囲): ${ontology.factBlock || '（登録された実績なし）'}
このペルソナの悩み(pain_points): ${ontology.painPoints.length ? ontology.painPoints.join(' / ') : '（未登録）'}
競合の主語候補: ${competitorNames.length ? competitorNames.join(' / ') : '（特になし）'}

# 次のチェック項目のみ、該当するかを二値で判定せよ（点数は付けない）
${checklistText}

各項目について:
- failed=true は「その問題が起きている」。必ず本文中の根拠を quote に実引用すること。
- 引用できない指摘は出すな（憶測禁止）。該当しなければ failed=false・quote=null。
- 「藁人形(strawman)」は、否定している通念がこのペルソナの pain_points と無関係なら failed=true。
- 「矛盾(contradicts_fact)」は、主張や否定が FACT と食い違うなら failed=true。

# さらに、直すべき箇所の処方箋を出せ（リライト本文そのものは書くな・方向だけ）
surgical_edits: [{ quote:"直す箇所の実引用", problem:"何が弱いか", rewrite_direction:"どの方向に直すか・一言" }]

# 出力（このJSON以外を一切出力しない・前後の説明禁止）
{ "checks":[{ "id":"...", "failed":bool, "quote":"...|null" }],
  "surgical_edits":[{ "quote":"...", "problem":"...", "rewrite_direction":"..." }],
  "verdict_one_line":"辛口の一言" }`
}

// JSON抽出（前後に説明が混ざっても最初の{...}を拾う）
function parseJson(raw: string): { checks?: { id: string; failed?: boolean; quote?: string | null }[]; surgical_edits?: SurgicalEdit[]; verdict_one_line?: string } {
  const s = raw.indexOf('{')
  const e = raw.lastIndexOf('}')
  if (s < 0 || e <= s) return {}
  try {
    return JSON.parse(raw.slice(s, e + 1))
  } catch {
    return {}
  }
}

/**
 * 1ドラフトを批評する。LLM二値（opus）＋コード指標（決定論）→ TS合成スコア。
 * quote が本文に実在しない指摘は破棄（ハルシネーション防護）。
 */
export async function reviewCopyDraft(params: {
  body: string
  role: CopyRole
  ontology: CopyOntologyBlocks
  competitorNames?: string[]
}): Promise<CopyReview> {
  const { body, role, ontology } = params
  const competitorNames = params.competitorNames ?? []
  const allowedChecks = new Set(checksForRole(role))

  // --- LLM 二値＋処方箋（opus） ---
  const system = buildInspectorSystem(role, body, ontology, competitorNames)
  const raw = await callClaude({
    system,
    userMessage: '上記コピーを査定し、指定JSONのみを出力せよ。',
    maxTokens: 1500,
    model: INSPECTOR_MODEL,
  })
  const parsed = parseJson(raw)

  // ハルシネーション防護: quote が本文に実在しない failed 指摘は破棄
  const llmFailed: Partial<Record<CheckId, boolean>> = {}
  for (const c of parsed.checks ?? []) {
    const id = c.id as CheckId
    if (!allowedChecks.has(id)) continue // 役割外の項目は無視
    if (c.failed !== true) continue
    if (!isQuoteGrounded(body, c.quote)) continue // 引用が本文に無い＝破棄
    llmFailed[id] = true
  }
  const surgicalEdits = (parsed.surgical_edits ?? [])
    .filter((e) => e && typeof e.quote === 'string' && isQuoteGrounded(body, e.quote))
    .map((e) => ({ quote: e.quote.trim(), problem: e.problem ?? '', rewrite_direction: e.rewrite_direction ?? '' }))

  // --- コード指標（決定論） ---
  const bannedTerms = [...ontology.bannedTerms, ...SHARED_CLICHE]
  const cliche = computeClicheDensity(body, bannedTerms)
  const inh = computeInheritanceOverlap(body, ontology.intentStrings, ontology.quotablePhrases)
  const fabricated = detectFabricatedNumbers(body, ontology.factText)
  const code: CodeMetrics = {
    clicheDensity: cliche.density,
    clicheHits: cliche.hits,
    overlap: inh.overlap,
    blankAfterMask: inh.blankAfterMask,
    fabricated,
  }

  // --- TS合成 ---
  const axes = computeAxes(role, llmFailed, code)
  const craftScore = computeCraftScore(role, axes)
  const brandFit = computeBrandFit(role, code, llmFailed)
  const redFlag = computeRedFlag(role, craftScore, brandFit, axes, code)

  return {
    axes,
    craftScore,
    brandFit,
    redFlag,
    critique: parsed.verdict_one_line ?? '',
    surgicalEdits,
    llmFailed,
    code,
    reviewerModel: INSPECTOR_MODEL,
  }
}
