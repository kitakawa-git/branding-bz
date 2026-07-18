// 未来設計 判定エンジンのIO層（**読み取り専用**）。
// DBから素材を集め、純粋関数（evaluate / resolveEvaluation / computeProgress）へ渡す形に整えるだけ。
// ここでは insert/update/delete を一切行わない（自動評価は保存しない・§2-3）。
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type {
  AchievementRuleV1, DesiredEvidenceInput, ExecutionState,
  HumanJudgmentInput, MeasurementInput, ProofInput,
} from './types'

export type DesiredEvidenceRow = {
  id: string
  company_id: string
  title: string
  importance_weight: number
  execution_state: ExecutionState
  evidence_updated_at: string
  achievement_rule: AchievementRuleV1
  sort_order: number
}

/** 1つの獲得目標を判定するのに必要な素材一式 */
export type DesiredEvidenceBundle = {
  row: DesiredEvidenceRow
  de: DesiredEvidenceInput
  proofs: ProofInput[]
  humanJudgment: HumanJudgmentInput | null
  /** §14.2 DB側で算出した現在ルールのハッシュ（override 失効判定用） */
  currentRuleHash: string | null
}

const toMeasurement = (m: Record<string, unknown>): MeasurementInput => ({
  metric_key: (m.metric_key as string) ?? '',
  metric_value: Number(m.metric_value),
  metric_unit: (m.metric_unit as string) ?? '',
  measured_at: (m.measured_at as string | null) ?? null,
})

/** company の獲得目標を取得（cancelled も含む。除外は呼び出し側の責務＝§7の分母定義） */
export async function fetchDesiredEvidence(companyId: string): Promise<DesiredEvidenceRow[]> {
  if (!companyId) return []
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('desired_evidence')
    .select('id, company_id, title, importance_weight, execution_state, evidence_updated_at, achievement_rule, sort_order')
    .eq('company_id', companyId)
    .order('sort_order', { ascending: true })
  if (error) {
    console.error('[future-design] desired_evidence 取得失敗:', error)
    return []
  }
  return (data ?? []) as unknown as DesiredEvidenceRow[]
}

/**
 * verifies（proof_point → desired_evidence）で採用済みの実績と、その測定値を取得。
 * 端点解決済み（存在する proof_point のみ）＝幽霊エッジは自然に除外される。
 */
export async function fetchAdoptedProofs(companyId: string, desiredEvidenceIds: string[]): Promise<Map<string, ProofInput[]>> {
  const out = new Map<string, ProofInput[]>()
  if (!companyId || desiredEvidenceIds.length === 0) return out
  const supabase = getSupabaseAdmin()

  const { data: rels, error: relErr } = await supabase
    .from('element_relations')
    .select('source_id, target_id')
    .eq('company_id', companyId)
    .eq('relation_type', 'verifies')
    .eq('source_kind', 'proof_point')
    .eq('target_kind', 'desired_evidence')
    .in('target_id', desiredEvidenceIds)
  if (relErr) {
    console.error('[future-design] verifies 関係の取得失敗:', relErr)
    return out
  }
  const relations = (rels ?? []) as Array<{ source_id: string; target_id: string }>
  const proofIds = Array.from(new Set(relations.map((r) => r.source_id)))
  if (proofIds.length === 0) return out

  // 端点解決（実在する proof_point のみ採用）
  const { data: pps } = await supabase.from('proof_points').select('id').eq('company_id', companyId).in('id', proofIds)
  const livePpIds = new Set(((pps ?? []) as Array<{ id: string }>).map((p) => p.id))

  const { data: ms } = await supabase
    .from('proof_point_measurements')
    .select('proof_point_id, metric_key, metric_value, metric_unit, measured_at')
    .eq('company_id', companyId)
    .in('proof_point_id', Array.from(livePpIds))
  const byProof = new Map<string, MeasurementInput[]>()
  for (const m of (ms ?? []) as Array<Record<string, unknown>>) {
    const pid = m.proof_point_id as string
    const arr = byProof.get(pid) ?? []
    arr.push(toMeasurement(m))
    byProof.set(pid, arr)
  }

  for (const rel of relations) {
    if (!livePpIds.has(rel.source_id)) continue
    const list = out.get(rel.target_id) ?? []
    if (list.some((p) => p.id === rel.source_id)) continue // 同一PPの重複エッジは1件に
    list.push({ id: rel.source_id, measurements: byProof.get(rel.source_id) ?? [] })
    out.set(rel.target_id, list)
  }
  return out
}

/** 現行の人間判断（is_current=true）を DE ごとに取得。有効性（is_valid）は動的算出＝§14.4 */
export async function fetchCurrentHumanJudgments(
  companyId: string,
  desiredEvidenceIds: string[],
): Promise<Map<string, HumanJudgmentInput>> {
  const out = new Map<string, HumanJudgmentInput>()
  if (!companyId || desiredEvidenceIds.length === 0) return out
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('desired_evidence_evaluations')
    .select('desired_evidence_id, evaluation_source, achievement_state, progress_fraction, rule_hash, evidence_version_at_eval, valid_until')
    .eq('company_id', companyId)
    .eq('is_current', true)
    .in('desired_evidence_id', desiredEvidenceIds)
  if (error) {
    console.error('[future-design] 人間判断の取得失敗:', error)
    return out
  }
  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    out.set(r.desired_evidence_id as string, {
      source: r.evaluation_source as HumanJudgmentInput['source'],
      achievement_state: r.achievement_state as HumanJudgmentInput['achievement_state'],
      progress_fraction: r.progress_fraction === null || r.progress_fraction === undefined ? null : Number(r.progress_fraction),
      rule_hash: (r.rule_hash as string | null) ?? null,
      evidence_version_at_eval: (r.evidence_version_at_eval as string | null) ?? null,
      valid_until: (r.valid_until as string | null) ?? null,
    })
  }
  return out
}

/** §14.2 rule_hash はDB側で算出（アプリでは作らない）。現在ルールのハッシュを読み出す。 */
export async function fetchCurrentRuleHashes(companyId: string, desiredEvidenceIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (!companyId || desiredEvidenceIds.length === 0) return out
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('desired_evidence_rule_hashes', {
    p_company_id: companyId,
    p_ids: desiredEvidenceIds,
  })
  if (error) {
    // RPC 未整備でも致命でない：override は失効扱い（自動評価にフォールバック）
    console.warn('[future-design] rule_hash 取得不可（override は失効扱い）:', error.message)
    return out
  }
  for (const r of (data ?? []) as Array<{ id: string; rule_hash: string }>) out.set(r.id, r.rule_hash)
  return out
}

/** company 単位で判定素材を一括収集（読み取りのみ） */
export async function fetchEvaluationBundles(companyId: string): Promise<DesiredEvidenceBundle[]> {
  const rows = await fetchDesiredEvidence(companyId)
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)
  const [proofsMap, hjMap, hashMap] = await Promise.all([
    fetchAdoptedProofs(companyId, ids),
    fetchCurrentHumanJudgments(companyId, ids),
    fetchCurrentRuleHashes(companyId, ids),
  ])
  return rows.map((row) => ({
    row,
    de: {
      rule: row.achievement_rule,
      importance_weight: Number(row.importance_weight),
      execution_state: row.execution_state,
      evidence_updated_at: row.evidence_updated_at,
    },
    proofs: proofsMap.get(row.id) ?? [],
    humanJudgment: hjMap.get(row.id) ?? null,
    currentRuleHash: hashMap.get(row.id) ?? null,
  }))
}
