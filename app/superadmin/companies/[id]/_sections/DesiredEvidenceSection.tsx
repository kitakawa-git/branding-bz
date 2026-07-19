'use client'

// スーパー管理画面 企業詳細: 「未来設計（獲得目標＝これから獲得する証拠）」(desired_evidence) CRUD セクション
// - 作法は ProofPointsSection と同一（rows/draft/editingId/saving・クライアント直 supabase・toast・confirm・上下並び替え・onDataChanged）
// - 書き込みは desired_evidence_superadmin_all ポリシー（is_superadmin）で許可される前提
// - achievement_rule は §3-2 の AchievementRuleV1 を組み立て、保存直前に validateRule で検証（不正なら止める）
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import { Plus, Trash2, Pencil, Check, X, ChevronUp, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { validateRule } from '@/lib/brand/future-design/rule-validator'
import type { AchievementRuleV1 } from '@/lib/brand/future-design/types'
import type {
  DesiredEvidenceEvaluationDto,
  VisionProgressDto,
} from '@/app/api/superadmin/desired-evidence/evaluations/route'

type ExecutionState = 'planned' | 'in_progress' | 'paused' | 'cancelled'

type DesiredEvidence = {
  id: string
  company_id: string
  title: string
  description: string | null
  importance_weight: number
  achievement_rule: AchievementRuleV1 | Record<string, never> | null
  verification_method: string | null
  milestone_note: string | null
  execution_state: ExecutionState
  sort_order: number
}

type RuleType = 'boolean' | 'count' | 'aggregate' | 'manual'

type Draft = {
  title: string
  description: string
  importance_weight: string
  verification_method: string
  milestone_note: string
  execution_state: ExecutionState
  // rule エディタ
  rule_type: RuleType
  minimum_proof_count: string
  threshold: string
  filter_metric_key: string
  filter_unit: string
  filter_operator: '' | '>=' | '<='
  filter_value: string
  agg_metric_key: string
  aggregation: 'sum' | 'average' | 'maximum' | 'minimum' | 'latest'
  agg_unit: string
  agg_operator: '>=' | '<='
  agg_target: string
  agg_baseline: string
}

const EXECUTION_STATES: { value: ExecutionState; label: string }[] = [
  { value: 'planned', label: '計画中' },
  { value: 'in_progress', label: '進行中' },
  { value: 'paused', label: '一時停止' },
  { value: 'cancelled', label: '中止' },
]
const execLabel = (v: ExecutionState) => EXECUTION_STATES.find((s) => s.value === v)?.label ?? v

const RULE_TYPES: { value: RuleType; label: string; hint: string }[] = [
  { value: 'boolean', label: '存在（実績があるか）', hint: '立証する実績が必要数そろえば達成' },
  { value: 'count', label: '件数（いくつ集まったか）', hint: '条件を満たす実績の件数で達成を判定' },
  { value: 'aggregate', label: '集計（数値が目標に届いたか）', hint: '測定値を集計して目標値と比較' },
  { value: 'manual', label: '手動（人が判断する）', hint: '自動判定せず、人の判断で達成を記録' },
]
const AGGREGATIONS: { value: Draft['aggregation']; label: string }[] = [
  { value: 'sum', label: '合計' },
  { value: 'average', label: '平均' },
  { value: 'maximum', label: '最大' },
  { value: 'minimum', label: '最小' },
  { value: 'latest', label: '最新' },
]

const emptyDraft = (): Draft => ({
  title: '',
  description: '',
  importance_weight: '1',
  verification_method: '',
  milestone_note: '',
  execution_state: 'planned',
  rule_type: 'boolean',
  minimum_proof_count: '',
  threshold: '3',
  filter_metric_key: '',
  filter_unit: '',
  filter_operator: '',
  filter_value: '',
  agg_metric_key: '',
  aggregation: 'latest',
  agg_unit: '',
  agg_operator: '>=',
  agg_target: '',
  agg_baseline: '',
})

const SELECT_CLASS =
  'h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-ds-app-accent-soft focus:ring-1 focus:ring-ds-app-accent-soft'

/** DBの achievement_rule → フォーム下書き（編集時） */
function ruleToDraft(rule: DesiredEvidence['achievement_rule']): Partial<Draft> {
  const base = emptyDraft()
  const r = rule as AchievementRuleV1 | null
  if (!r || typeof r !== 'object' || !('type' in r)) return { rule_type: 'manual' }
  switch (r.type) {
    case 'boolean':
      return { rule_type: 'boolean', minimum_proof_count: r.minimum_proof_count != null ? String(r.minimum_proof_count) : '' }
    case 'count':
      return {
        rule_type: 'count',
        threshold: String(r.threshold ?? base.threshold),
        filter_metric_key: r.metric_filter?.metric_key ?? '',
        filter_unit: r.metric_filter?.unit ?? '',
        filter_operator: (r.metric_filter?.operator as Draft['filter_operator']) ?? '',
        filter_value: r.metric_filter?.value != null ? String(r.metric_filter.value) : '',
      }
    case 'aggregate':
      return {
        rule_type: 'aggregate',
        agg_metric_key: r.metric_key ?? '',
        aggregation: r.aggregation ?? 'latest',
        agg_unit: r.unit ?? '',
        agg_operator: r.operator ?? '>=',
        agg_target: r.target != null ? String(r.target) : '',
        agg_baseline: r.baseline != null ? String(r.baseline) : '',
      }
    default:
      return { rule_type: 'manual' }
  }
}

/** フォーム下書き → achievement_rule（version:1 を必ず含める） */
function draftToRule(d: Draft): AchievementRuleV1 {
  switch (d.rule_type) {
    case 'boolean': {
      const n = d.minimum_proof_count.trim()
      return n ? { version: 1, type: 'boolean', minimum_proof_count: Number(n) } : { version: 1, type: 'boolean' }
    }
    case 'count': {
      const hasFilter = d.filter_metric_key.trim() !== ''
      const filter = hasFilter
        ? {
            metric_key: d.filter_metric_key.trim(),
            ...(d.filter_unit.trim() ? { unit: d.filter_unit.trim() } : {}),
            ...(d.filter_operator ? { operator: d.filter_operator } : {}),
            ...(d.filter_value.trim() !== '' ? { value: Number(d.filter_value) } : {}),
          }
        : undefined
      return {
        version: 1,
        type: 'count',
        threshold: Number(d.threshold || 0),
        ...(filter ? { metric_filter: filter } : {}),
      }
    }
    case 'aggregate':
      return {
        version: 1,
        type: 'aggregate',
        metric_key: d.agg_metric_key.trim(),
        aggregation: d.aggregation,
        unit: d.agg_unit.trim(),
        operator: d.agg_operator,
        target: Number(d.agg_target || 0),
        ...(d.agg_baseline.trim() !== '' ? { baseline: Number(d.agg_baseline) } : {}),
      }
    case 'manual':
      return { version: 1, type: 'manual' }
  }
}

/** 一覧に出す達成条件の要約 */
function ruleSummary(rule: DesiredEvidence['achievement_rule']): string {
  const r = rule as AchievementRuleV1 | null
  if (!r || typeof r !== 'object' || !('type' in r)) return '未設定'
  switch (r.type) {
    case 'boolean':
      return `存在：実績${r.minimum_proof_count ?? 1}件以上`
    case 'count':
      return `件数：${r.threshold}件以上${r.metric_filter ? `（${r.metric_filter.metric_key}${r.metric_filter.operator ? ` ${r.metric_filter.operator} ${r.metric_filter.value}` : ''}）` : ''}`
    case 'aggregate': {
      const aggLabel = AGGREGATIONS.find((a) => a.value === r.aggregation)?.label ?? r.aggregation
      return `集計：${r.metric_key}(${r.unit}) の${aggLabel} ${r.operator} ${r.target}${r.baseline != null ? `（基準 ${r.baseline}）` : ''}`
    }
    case 'manual':
      return '手動：人が判断'
  }
}

// 判定状態の和訳＋バッジ色（§5 の4状態）
const STATE_META: Record<string, { label: string; cls: string }> = {
  met: { label: '達成', cls: 'bg-emerald-100 text-emerald-800' },
  partially_met: { label: '一部', cls: 'bg-amber-100 text-amber-800' },
  unmet: { label: '未達', cls: 'bg-gray-100 text-gray-700' },
  indeterminate: { label: '判定不能', cls: 'bg-rose-100 text-rose-800' },
}

const pct = (f: number | null | undefined) => (f == null ? null : Math.round(f * 100))

/** 判定理由コードの読み下し（§5・§14.6） */
const REASON_TEXTS: Record<string, string> = {
  MET: '達成条件を満たしています',
  BELOW_TARGET: '目標値にまだ届いていません',
  INSUFFICIENT_COUNT: '立証する実績の件数が足りません',
  NO_MATCHING_MEASUREMENT: 'データ不足で判定できません（条件に合う測定値がありません）',
  NO_MEASURED_DATE: '測定日のない測定値があるため「最新」を判定できません',
  INVALID_RULE: '達成条件が不正です。編集して直してください',
  INVALID_BASELINE: '現状値（基準）の向きが目標と矛盾しているため、進捗率は出せません',
  MANUAL_REVIEW: '手動判定です。人の判断が記録されるまで判定できません',
  MANUAL_OVERRIDE: '人の判断で記録された結果です',
}
const reasonText = (ev: DesiredEvidenceEvaluationDto['evaluation']): string =>
  REASON_TEXTS[ev.reason_code] ?? `判定できません（${ev.reason_code}）`

export default function DesiredEvidenceSection({
  companyId,
  onDataChanged,
}: {
  companyId: string
  onDataChanged?: () => void
}) {
  const [rows, setRows] = useState<DesiredEvidence[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null) // 'new' または行ID
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [saving, setSaving] = useState(false)
  const [metricKeys, setMetricKeys] = useState<string[]>([]) // datalist サジェスト
  // 判定・進捗（読み取り専用API）
  const [evals, setEvals] = useState<Record<string, DesiredEvidenceEvaluationDto>>({})
  const [visionProgress, setVisionProgress] = useState<VisionProgressDto[]>([])
  const [overall, setOverall] = useState<Omit<VisionProgressDto, 'vision_id' | 'vision_label'> | null>(null)
  const [evalError, setEvalError] = useState<string | null>(null)

  const fetchRows = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('desired_evidence')
      .select('*')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) {
      console.error('[DesiredEvidence] 取得エラー:', error)
      toast.error('獲得目標の取得に失敗しました')
    } else {
      setRows((data as DesiredEvidence[]) || [])
      onDataChanged?.()
    }
    setLoading(false)
  }

  // 既存の metric_key をサジェスト（0件なら空）
  const fetchMetricKeys = async () => {
    const { data } = await supabase
      .from('proof_point_measurements')
      .select('metric_key')
      .eq('company_id', companyId)
    const keys = Array.from(
      new Set(((data as { metric_key: string | null }[] | null) || []).map((m) => (m.metric_key || '').trim()).filter(Boolean)),
    ).sort()
    setMetricKeys(keys)
  }

  // 判定・進捗を取得（読み取りのみ。失敗しても CRUD は動かす）
  const fetchEvaluations = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const res = await fetch(`/api/superadmin/desired-evidence/evaluations?companyId=${companyId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || '判定の取得に失敗しました')
      const map: Record<string, DesiredEvidenceEvaluationDto> = {}
      for (const e of (json.evaluations || []) as DesiredEvidenceEvaluationDto[]) map[e.id] = e
      setEvals(map)
      setVisionProgress((json.visionProgress || []) as VisionProgressDto[])
      setOverall(json.overall ?? null)
      setEvalError(null)
    } catch (err) {
      console.error('[DesiredEvidence] 判定取得エラー:', err)
      setEvalError(err instanceof Error ? err.message : '判定の取得に失敗しました')
    }
  }

  useEffect(() => {
    fetchRows()
    fetchMetricKeys()
    fetchEvaluations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  const startAdd = () => {
    setDraft(emptyDraft())
    setEditingId('new')
  }

  const startEdit = (row: DesiredEvidence) => {
    setDraft({
      ...emptyDraft(),
      title: row.title ?? '',
      description: row.description ?? '',
      importance_weight: String(row.importance_weight ?? 1),
      verification_method: row.verification_method ?? '',
      milestone_note: row.milestone_note ?? '',
      execution_state: row.execution_state ?? 'planned',
      ...ruleToDraft(row.achievement_rule),
    })
    setEditingId(row.id)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setDraft(emptyDraft())
  }

  const buildPayload = () => ({
    company_id: companyId,
    title: draft.title.trim(),
    description: draft.description.trim(),
    importance_weight: Number(draft.importance_weight || 1),
    achievement_rule: draftToRule(draft),
    verification_method: draft.verification_method.trim(),
    milestone_note: draft.milestone_note.trim(),
    execution_state: draft.execution_state,
  })

  const save = async () => {
    if (!draft.title.trim()) {
      toast.error('タイトルは必須です')
      return
    }
    const weight = Number(draft.importance_weight)
    if (!Number.isFinite(weight) || weight <= 0) {
      toast.error('重要度は0より大きい数値で入力してください')
      return
    }
    // §3-3 ルール検証（INVALID_BASELINE 等はここで止める）
    const rule = draftToRule(draft)
    const { ok, errors } = validateRule(rule)
    if (!ok) {
      toast.error(`達成条件が不正です: ${errors.join(' / ')}`)
      return
    }

    setSaving(true)
    try {
      if (editingId === 'new') {
        const nextOrder = rows.length > 0 ? Math.max(...rows.map((r) => r.sort_order)) + 1 : 0
        const { error } = await supabase.from('desired_evidence').insert({ ...buildPayload(), sort_order: nextOrder })
        if (error) throw error
        toast.success('追加しました')
      } else if (editingId) {
        const { error } = await supabase
          .from('desired_evidence')
          .update({ ...buildPayload(), updated_at: new Date().toISOString() })
          .eq('id', editingId)
        if (error) throw error
        toast.success('更新しました')
      }
      cancelEdit()
      await fetchRows()
      await fetchEvaluations()
    } catch (err) {
      console.error('[DesiredEvidence] 保存エラー:', err)
      toast.error('保存に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('この獲得目標を削除しますか？')) return
    const { error } = await supabase.from('desired_evidence').delete().eq('id', id)
    if (error) {
      console.error('[DesiredEvidence] 削除エラー:', error)
      toast.error('削除に失敗しました')
      return
    }
    toast.success('削除しました')
    if (editingId === id) cancelEdit()
    await fetchRows()
    await fetchEvaluations()
  }

  // 並び替え（隣と sort_order を入れ替えて両方を更新）
  const move = async (index: number, dir: -1 | 1) => {
    const target = rows[index]
    const swap = rows[index + dir]
    if (!target || !swap) return
    const results = await Promise.all([
      supabase.from('desired_evidence').update({ sort_order: swap.sort_order }).eq('id', target.id),
      supabase.from('desired_evidence').update({ sort_order: target.sort_order }).eq('id', swap.id),
    ])
    if (results.some((r) => r.error)) {
      toast.error('並び替えに失敗しました')
      return
    }
    await fetchRows()
  }

  const renderRuleEditor = () => (
    <div className="border border-border rounded-lg p-3 bg-white space-y-3">
      <div>
        <label className="text-xs font-bold text-foreground mb-1.5 block">達成条件のタイプ</label>
        <select
          className={SELECT_CLASS}
          value={draft.rule_type}
          onChange={(e) => setDraft({ ...draft, rule_type: e.target.value as RuleType })}
        >
          {RULE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-muted-foreground mt-1 m-0">
          {RULE_TYPES.find((t) => t.value === draft.rule_type)?.hint}
        </p>
      </div>

      {draft.rule_type === 'boolean' && (
        <div>
          <label className="text-xs font-bold text-foreground mb-1.5 block">必要な実績数（省略時1）</label>
          <Input
            type="number"
            min={1}
            value={draft.minimum_proof_count}
            onChange={(e) => setDraft({ ...draft, minimum_proof_count: e.target.value })}
            placeholder="1"
            className="h-10"
          />
        </div>
      )}

      {draft.rule_type === 'count' && (
        <>
          <div>
            <label className="text-xs font-bold text-foreground mb-1.5 block">
              必要件数 <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              min={1}
              value={draft.threshold}
              onChange={(e) => setDraft({ ...draft, threshold: e.target.value })}
              className="h-10"
            />
          </div>
          <p className="text-[11px] text-muted-foreground m-0">絞り込み条件（任意）：指標を指定すると、その測定値を持つ実績だけを数えます</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs font-bold text-foreground mb-1.5 block">指標キー</label>
              <Input
                type="text"
                list="de-metric-keys"
                pattern="^[a-z0-9_]+$"
                value={draft.filter_metric_key}
                onChange={(e) => setDraft({ ...draft, filter_metric_key: e.target.value })}
                placeholder="例: case_study"
                className="h-10"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-foreground mb-1.5 block">単位</label>
              <Input
                type="text"
                value={draft.filter_unit}
                onChange={(e) => setDraft({ ...draft, filter_unit: e.target.value })}
                placeholder="例: 件"
                className="h-10"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs font-bold text-foreground mb-1.5 block">条件</label>
              <select
                className={SELECT_CLASS}
                value={draft.filter_operator}
                onChange={(e) => setDraft({ ...draft, filter_operator: e.target.value as Draft['filter_operator'] })}
              >
                <option value="">指定しない</option>
                <option value=">=">以上（&gt;=）</option>
                <option value="<=">以下（&lt;=）</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-foreground mb-1.5 block">しきい値</label>
              <Input
                type="number"
                value={draft.filter_value}
                onChange={(e) => setDraft({ ...draft, filter_value: e.target.value })}
                placeholder="条件を使う場合は必須"
                className="h-10"
              />
            </div>
          </div>
        </>
      )}

      {draft.rule_type === 'aggregate' && (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs font-bold text-foreground mb-1.5 block">
                指標キー <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                list="de-metric-keys"
                pattern="^[a-z0-9_]+$"
                value={draft.agg_metric_key}
                onChange={(e) => setDraft({ ...draft, agg_metric_key: e.target.value })}
                placeholder="例: brand_awareness_rate"
                className="h-10"
              />
              <p className="text-[11px] text-muted-foreground mt-1 m-0">半角小文字・数字・_ のみ。測定値と同じキーにしてください</p>
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-foreground mb-1.5 block">
                単位 <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={draft.agg_unit}
                onChange={(e) => setDraft({ ...draft, agg_unit: e.target.value })}
                placeholder="例: %"
                className="h-10"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs font-bold text-foreground mb-1.5 block">集計方法</label>
              <select
                className={SELECT_CLASS}
                value={draft.aggregation}
                onChange={(e) => setDraft({ ...draft, aggregation: e.target.value as Draft['aggregation'] })}
              >
                {AGGREGATIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-foreground mb-1.5 block">条件</label>
              <select
                className={SELECT_CLASS}
                value={draft.agg_operator}
                onChange={(e) => setDraft({ ...draft, agg_operator: e.target.value as '>=' | '<=' })}
              >
                <option value=">=">以上（&gt;=）</option>
                <option value="<=">以下（&lt;=）</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs font-bold text-foreground mb-1.5 block">
                目標値 <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                value={draft.agg_target}
                onChange={(e) => setDraft({ ...draft, agg_target: e.target.value })}
                placeholder="例: 50"
                className="h-10"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-foreground mb-1.5 block">現状値（基準・任意）</label>
              <Input
                type="number"
                value={draft.agg_baseline}
                onChange={(e) => setDraft({ ...draft, agg_baseline: e.target.value })}
                placeholder="例: 20"
                className="h-10"
              />
              <p className="text-[11px] text-muted-foreground mt-1 m-0">
                入れると進捗率を出せます（以上なら 現状 &lt; 目標、以下なら 現状 &gt; 目標）
              </p>
            </div>
          </div>
        </>
      )}

      <datalist id="de-metric-keys">
        {metricKeys.map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>
    </div>
  )

  // 進捗バー（progress_fraction が null のときは描かない）
  const renderBar = (fraction: number | null) => {
    const p = pct(fraction)
    if (p == null) return null
    return (
      <div className="flex items-center gap-2 mt-1.5">
        <div className="h-1.5 flex-1 rounded-full bg-gray-200 overflow-hidden">
          <div className="h-full rounded-full bg-ds-app-accent-soft" style={{ width: `${Math.min(100, Math.max(0, p))}%` }} />
        </div>
        <span className="text-[11px] text-muted-foreground shrink-0">{p}%</span>
      </div>
    )
  }

  // §7 実証進捗は「判定可能率」と必ずセットで出す
  const renderProgressLine = (label: string, v: Omit<VisionProgressDto, 'vision_id' | 'vision_label'>) => {
    const p = pct(v.progress_fraction)
    const cov = Math.round(v.coverage_weight * 100)
    return (
      <div className="mb-2 last:mb-0">
        <p className="text-[13px] text-foreground m-0 break-words">
          <span className="font-bold">{label}</span>：実証進捗{' '}
          {p == null ? '—' : `${p}%`}
          <span className="text-muted-foreground">
            （判定可能 重み {cov}%・件数 {v.coverage_count.evaluable}/{v.coverage_count.total}）
          </span>
        </p>
        {renderBar(v.progress_fraction)}
      </div>
    )
  }

  const renderProgressPanel = () => {
    if (evalError) {
      return (
        <div className="border border-amber-200 bg-amber-50/60 rounded-lg p-3 mb-3">
          <p className="text-[13px] text-amber-900 m-0">判定・進捗を取得できませんでした（{evalError}）。登録・編集は通常どおり行えます。</p>
        </div>
      )
    }
    // §14.6 分母0＝獲得目標が未設定
    if (!overall || overall.coverage_count.total === 0) {
      if (loading) return null
      return (
        <div className="border border-border rounded-lg p-3 mb-3 bg-background">
          <p className="text-[13px] text-muted-foreground m-0">実証進捗：獲得目標が未設定です</p>
        </div>
      )
    }
    return (
      <div className="border border-border rounded-lg p-3 mb-3 bg-background">
        {renderProgressLine('全体', overall)}
        {visionProgress.map((v) => (
          <div key={v.vision_id}>{renderProgressLine(v.vision_label, v)}</div>
        ))}
        {visionProgress.length === 0 && (
          <p className="text-[11px] text-muted-foreground m-0 mt-1">
            ビジョンから「必要とする」を張ると、ビジョン単位の進捗も出ます
          </p>
        )}
      </div>
    )
  }

  const renderForm = () => (
    <div className="border border-blue-200 bg-blue-50/40 rounded-lg p-4 mb-3 space-y-4">
      <div>
        <label className="text-xs font-bold text-foreground mb-1.5 block">
          タイトル <span className="text-red-500">*</span>
        </label>
        <Input
          type="text"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="例: 導入事例を3件そろえる／認知率50%に到達する"
          className="h-10"
        />
      </div>

      <div>
        <label className="text-xs font-bold text-foreground mb-1.5 block">説明</label>
        <AutoResizeTextarea
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          placeholder="なぜこの証拠が必要か・どんな状態を目指すか"
          className="min-h-[70px]"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="text-xs font-bold text-foreground mb-1.5 block">
            重要度（重み） <span className="text-red-500">*</span>
          </label>
          <Input
            type="number"
            step="0.25"
            min="0.25"
            value={draft.importance_weight}
            onChange={(e) => setDraft({ ...draft, importance_weight: e.target.value })}
            className="h-10"
          />
          <p className="text-[11px] text-muted-foreground mt-1 m-0">進捗の重み付けに使います（0より大きい数値）</p>
        </div>
        <div className="flex-1">
          <label className="text-xs font-bold text-foreground mb-1.5 block">進行状態</label>
          <select
            className={SELECT_CLASS}
            value={draft.execution_state}
            onChange={(e) => setDraft({ ...draft, execution_state: e.target.value as ExecutionState })}
          >
            {EXECUTION_STATES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground mt-1 m-0">「中止」は進捗の分母から外れます</p>
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-foreground mb-1.5 block">達成条件（判定ルール）</label>
        {renderRuleEditor()}
      </div>

      <div>
        <label className="text-xs font-bold text-foreground mb-1.5 block">立証方法</label>
        <Input
          type="text"
          value={draft.verification_method}
          onChange={(e) => setDraft({ ...draft, verification_method: e.target.value })}
          placeholder="例: 年1回のブランド認知調査（n=1000）"
          className="h-10"
        />
      </div>

      <div>
        <label className="text-xs font-bold text-foreground mb-1.5 block">マイルストーン・メモ</label>
        <AutoResizeTextarea
          value={draft.milestone_note}
          onChange={(e) => setDraft({ ...draft, milestone_note: e.target.value })}
          placeholder="いつまでに・どう進めるか"
          className="min-h-[60px]"
        />
      </div>

      <div className="flex gap-2">
        <Button type="button" onClick={save} disabled={saving} size="sm">
          <Check size={14} />
          {saving ? '保存中...' : '保存'}
        </Button>
        <Button type="button" variant="outline" onClick={cancelEdit} disabled={saving} size="sm">
          <X size={14} />
          キャンセル
        </Button>
      </div>
    </div>
  )

  return (
    <div>
      <p className="text-[13px] text-muted-foreground mt-0 mb-3">
        いま無いが「これから獲得する証拠」を登録します。実績（事実）とは分けて管理し、関係性ステップで
        ビジョンから「必要とする」、実績から「立証する」を張ってつなげます。
      </p>

      {renderProgressPanel()}

      {loading ? (
        <p className="text-muted-foreground text-sm">読み込み中...</p>
      ) : rows.length === 0 && editingId !== 'new' ? (
        <p className="text-muted-foreground text-sm mb-3">獲得目標が登録されていません</p>
      ) : (
        rows.map((row, index) =>
          editingId === row.id ? (
            <div key={row.id}>{renderForm()}</div>
          ) : (
            <div key={row.id} className="border border-border rounded-lg p-4 mb-3 bg-background">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className="py-0.5 px-2 bg-violet-100 text-violet-800 rounded text-xs font-semibold">
                      {execLabel(row.execution_state)}
                    </span>
                    <span className="py-0.5 px-2 bg-gray-100 text-gray-600 rounded text-xs font-semibold">
                      重要度 {row.importance_weight}
                    </span>
                    {evals[row.id] && (
                      <span
                        className={`py-0.5 px-2 rounded text-xs font-semibold ${
                          STATE_META[evals[row.id].evaluation.state]?.cls ?? 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {STATE_META[evals[row.id].evaluation.state]?.label ?? evals[row.id].evaluation.state}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-foreground break-words">{row.title}</p>
                  {row.description && (
                    <p className="text-[13px] text-muted-foreground mt-1 whitespace-pre-line break-words">
                      {row.description}
                    </p>
                  )}
                  <p className="text-[13px] text-muted-foreground mt-1 break-words">
                    達成条件: {ruleSummary(row.achievement_rule)}
                  </p>
                  {evals[row.id] && (
                    <>
                      {renderBar(evals[row.id].evaluation.progress_fraction)}
                      <p className="text-[13px] text-muted-foreground mt-1 break-words">
                        {reasonText(evals[row.id].evaluation)}
                        {evals[row.id].evaluation.source === 'manual' && '（人の判断）'}
                      </p>
                    </>
                  )}
                  {row.verification_method && (
                    <p className="text-[13px] text-muted-foreground mt-0.5 break-words">
                      立証方法: {row.verification_method}
                    </p>
                  )}
                  {row.milestone_note && (
                    <p className="text-[13px] text-muted-foreground mt-0.5 whitespace-pre-line break-words">
                      {row.milestone_note}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button type="button" variant="outline" size="icon" onClick={() => move(index, -1)} disabled={index === 0} className="size-8">
                    <ChevronUp size={14} />
                  </Button>
                  <Button type="button" variant="outline" size="icon" onClick={() => move(index, 1)} disabled={index === rows.length - 1} className="size-8">
                    <ChevronDown size={14} />
                  </Button>
                  <Button type="button" variant="outline" size="icon" onClick={() => startEdit(row)} className="size-8">
                    <Pencil size={14} />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => remove(row.id)}
                    className="size-8 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </div>
          ),
        )
      )}

      {editingId === 'new' && renderForm()}

      {editingId === null && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={startAdd} className="py-2 px-4 text-[13px]">
            <Plus size={16} />
            獲得目標を追加
          </Button>
        </div>
      )}
    </div>
  )
}
