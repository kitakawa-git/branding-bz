// コピーAI スコア合成（Q1: 点数はTSが付ける。LLMは二値判定のみ）。
// チェックリスト定義＋役割フィルタ＋軸スコア・craft_score・brand_fit・red_flag の決定論合成。
import { COPY_ROLE_MATRIX, type CopyRole } from '@/lib/copy/role-matrix'

export type CheckId =
  | 'stance_absent' | 'strawman' | 'contradicts_fact' | 'named_competitor_attack'
  | 'swap_test_passes' | 'abstract_ending' | 'no_specificity' | 'over_friction'

export type AxisKey = 'stance' | 'differentiation' | 'specificity' | 'politeness' | 'compliance'

export type AxisScores = {
  stance: number
  differentiation: number
  specificity: number
  politeness: number
  compliance: number
  // コード指標（透明化のため同梱・DBの axis_scores jsonb に保存）
  cliche_density: number
  inheritance_overlap: number
  fabricated_count: number
}

// Stage3 で使うコード指標のまとめ
export type CodeMetrics = {
  clicheDensity: number
  clicheHits: string[]
  overlap: number
  blankAfterMask: boolean
  fabricated: string[]
}

// 各チェックの「どの役割に適用するか」（Q1揺さぶり: 役割で項目自体を絞る）
export const CHECKLIST: Record<CheckId, { desc: string; roles: CopyRole[]; axis: AxisKey }> = {
  stance_absent:          { desc: '常識の否定＋独自の代替が無い', roles: ['hero_h1', 'section_heading'], axis: 'stance' },
  strawman:               { desc: '否定した通念がペルソナのpain_pointsと接続しない(藁人形)', roles: ['hero_h1', 'section_heading'], axis: 'stance' },
  contradicts_fact:       { desc: '主張/否定がproof_pointsと矛盾', roles: ['hero_h1', 'section_heading', 'body_copy'], axis: 'specificity' },
  named_competitor_attack:{ desc: '特定競合の名指し批判', roles: ['hero_h1', 'section_heading', 'body_copy', 'cta', 'form_microcopy'], axis: 'compliance' },
  swap_test_passes:       { desc: '主語を競合に置換しても成立(誰でも言える)', roles: ['hero_h1', 'section_heading'], axis: 'differentiation' },
  abstract_ending:        { desc: '抽象名詞(価値/体験/最適化等)で終わる', roles: ['hero_h1', 'section_heading', 'body_copy'], axis: 'specificity' },
  no_specificity:         { desc: '数字/固有名詞/情景が無い', roles: ['body_copy'], axis: 'specificity' },
  over_friction:          { desc: '煽り/余計な言葉で迷わせる', roles: ['cta', 'form_microcopy'], axis: 'politeness' },
}

// 役割に適用される項目だけ返す（プロンプトにもこれだけ渡す）
export function checksForRole(role: CopyRole): CheckId[] {
  return (Object.keys(CHECKLIST) as CheckId[]).filter((id) => CHECKLIST[id].roles.includes(role))
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))
const F = (llm: Partial<Record<CheckId, boolean>>, id: CheckId) => llm[id] === true

// 役割別の軸重み（primaryAxis を厚く）。残りは補助。合計1.0。
const ROLE_WEIGHTS: Record<CopyRole, Partial<Record<AxisKey, number>>> = {
  hero_h1:         { stance: 0.5, differentiation: 0.3, specificity: 0.2 },
  section_heading: { differentiation: 0.45, stance: 0.3, specificity: 0.25 },
  body_copy:       { specificity: 0.6, differentiation: 0.2, stance: 0.2 },
  cta:             { politeness: 1.0 },
  form_microcopy:  { politeness: 1.0 },
}

// 二値判定 + コード指標 → 軸スコア(0-100)
export function computeAxes(
  role: CopyRole,
  llmFailed: Partial<Record<CheckId, boolean>>,
  code: CodeMetrics,
): AxisScores {
  const stance = F(llmFailed, 'stance_absent') || F(llmFailed, 'strawman') ? 25 : 90
  const differentiation = F(llmFailed, 'swap_test_passes') ? 20 : 85
  let specificity = F(llmFailed, 'no_specificity') ? 20 : F(llmFailed, 'abstract_ending') ? 55 : 90
  if (F(llmFailed, 'contradicts_fact')) specificity -= 30
  if (code.fabricated.length > 0) specificity -= 40
  const politeness = F(llmFailed, 'over_friction') ? 30 : 90
  const compliance = F(llmFailed, 'named_competitor_attack') ? 10 : 90
  return {
    stance: clamp(stance),
    differentiation: clamp(differentiation),
    specificity: clamp(specificity),
    politeness: clamp(politeness),
    compliance: clamp(compliance),
    cliche_density: Math.round(code.clicheDensity * 100) / 100,
    inheritance_overlap: Math.round(code.overlap * 100) / 100,
    fabricated_count: code.fabricated.length,
  }
}

// craft_score = Σ(軸×役割重み) − クリシェ減点 − 継承重複減点（0-100 clamp）
export function computeCraftScore(role: CopyRole, axes: AxisScores): number {
  const w = ROLE_WEIGHTS[role]
  let s = 0
  for (const k of Object.keys(w) as AxisKey[]) s += (axes[k] as number) * (w[k] as number)
  s -= axes.cliche_density * 30
  s -= axes.inheritance_overlap * 30
  return clamp(s)
}

// brand_fit = 100 −（重大違反=矛盾×40 / クリシェ警告×15・最大3）−（数字捏造×30）−（競合名指し×40）
export function computeBrandFit(
  role: CopyRole,
  code: CodeMetrics,
  llmFailed: Partial<Record<CheckId, boolean>>,
): number {
  let s = 100
  if (F(llmFailed, 'contradicts_fact')) s -= 40
  s -= Math.min(3, code.clicheHits.length) * 15
  if (code.fabricated.length > 0) s -= 30
  if (F(llmFailed, 'named_competitor_attack')) s -= 40
  return clamp(s)
}

// red_flag（自動リライト送還の条件）
export function computeRedFlag(
  role: CopyRole,
  craft: number,
  brandFit: number,
  axes: AxisScores,
  code: CodeMetrics,
): boolean {
  const spec = COPY_ROLE_MATRIX[role]
  // 正しいが退屈（ブランド適合は高いのに craft が下限以下）
  if (brandFit >= 90 && craft <= spec.craftFloor) return true
  // strict役割でクリシェが1語でも出た
  if (spec.cliche === 'strict' && code.clicheDensity > 0) return true
  // 態度表明 required 役割でスタンス欠落/藁人形（軸stanceが低い＝失格相当）
  if (spec.stance === 'required' && axes.stance <= 25) return true
  // スローガンだけの手抜き（白紙マスク）
  if (code.blankAfterMask) return true
  // 数字捏造 / 競合名指し
  if (code.fabricated.length > 0) return true
  if (axes.compliance <= 10) return true
  return false
}
