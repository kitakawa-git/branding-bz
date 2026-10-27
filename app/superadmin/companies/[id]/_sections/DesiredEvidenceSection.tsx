'use client'

// スーパー管理画面 企業詳細: 「未来設計（獲得目標＝これから獲得する証拠）」(desired_evidence) CRUD セクション
// - 作法は ProofPointsSection と同一（rows/draft/editingId/saving・クライアント直 supabase・toast・confirm・上下並び替え・onDataChanged）
// - 書き込みは desired_evidence_superadmin_all ポリシー（is_superadmin）で許可される前提
// - achievement_rule は §3-2 の AchievementRuleV1 を組み立て、保存直前に validateRule で検証（不正なら止める）
// - 表示ブロックとフックは ./desired-evidence/ に分割（このファイルは状態・取得・CRUD と組み立てのみ）
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { validateRule } from '@/lib/brand/future-design/rule-validator'
import type { MetricSelection } from './MetricPicker'
import type {
  DesiredEvidenceEvaluationDto,
  VisionProgressDto,
} from '@/app/api/superadmin/desired-evidence/evaluations/route'
import { DesiredEvidence, Draft, emptyDraft, ruleToDraft, draftToRule } from './desired-evidence-rules'
import type { ProgressSummary } from './desired-evidence/shared'
import { useJudgment } from './desired-evidence/useJudgment'
import { useValuePropositions } from './desired-evidence/useValuePropositions'
import ProgressPanel from './desired-evidence/ProgressPanel'
import ValuePropositionPanel from './desired-evidence/ValuePropositionPanel'
import EvidenceForm from './desired-evidence/EvidenceForm'
import EvidenceRow from './desired-evidence/EvidenceRow'
import JudgmentPanel from './desired-evidence/JudgmentPanel'

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
  // 指標辞書（編集時にプレビュー表示名を復元するため metric_key→定義 を持つ）
  const [metricDefs, setMetricDefs] = useState<Record<string, MetricSelection>>({})
  // 判定・進捗（読み取り専用API）
  const [evals, setEvals] = useState<Record<string, DesiredEvidenceEvaluationDto>>({})
  const [visionProgress, setVisionProgress] = useState<VisionProgressDto[]>([])
  const [overall, setOverall] = useState<ProgressSummary | null>(null)
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

  // 指標辞書を取得（プレビューの表示名復元・単位の突き合わせに使う）
  const fetchMetricDefs = async () => {
    const { data } = await supabase
      .from('metric_definitions')
      .select('metric_key, display_name, canonical_unit')
      .eq('company_id', companyId)
    const map: Record<string, MetricSelection> = {}
    for (const d of ((data as MetricSelection[] | null) || [])) map[d.metric_key] = d
    setMetricDefs(map)
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

  // 人間判断パネル（§6）
  const { judgeOpenId, setJudgeOpenId, jDraft, setJDraft, jSaving, openJudgment, saveJudgment, clearJudgment } = useJudgment({
    companyId,
    evals,
    fetchEvaluations,
    onDataChanged,
  })
  // 提供価値のライフサイクル（§8）
  const { vps, vpBusyId, fetchVps, changeVpState } = useValuePropositions({ companyId, onDataChanged })

  useEffect(() => {
    fetchRows()
    fetchMetricDefs()
    fetchEvaluations()
    fetchVps()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  const startAdd = () => {
    setDraft(emptyDraft())
    setEditingId('new')
  }

  const startEdit = (row: DesiredEvidence) => {
    const ruleDraft = ruleToDraft(row.achievement_rule)
    // 編集時はプレビュー用の表示名を指標辞書から復元する
    const aggLabel = ruleDraft.agg_metric_key ? metricDefs[ruleDraft.agg_metric_key]?.display_name ?? '' : ''
    const filterLabel = ruleDraft.filter_metric_key ? metricDefs[ruleDraft.filter_metric_key]?.display_name ?? '' : ''
    setDraft({
      ...emptyDraft(),
      title: row.title ?? '',
      description: row.description ?? '',
      importance_weight: String(row.importance_weight ?? 1),
      verification_method: row.verification_method ?? '',
      milestone_note: row.milestone_note ?? '',
      execution_state: row.execution_state ?? 'planned',
      ...ruleDraft,
      agg_metric_label: aggLabel,
      filter_metric_label: filterLabel,
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

  const renderForm = () => (
    <EvidenceForm
      companyId={companyId}
      draft={draft}
      setDraft={setDraft}
      saving={saving}
      onSave={save}
      onCancel={cancelEdit}
    />
  )

  return (
    <div>
      <p className="text-[13px] text-muted-foreground mt-0 mb-3">
        いま無いが「これから獲得する証拠」を登録します。実績（事実）とは分けて管理し、関係性ステップで
        ビジョンから「必要とする」、実績から「立証する」を張ってつなげます。
      </p>

      <ProgressPanel evalError={evalError} overall={overall} visionProgress={visionProgress} loading={loading} />
      <ValuePropositionPanel vps={vps} vpBusyId={vpBusyId} changeVpState={changeVpState} />


      {loading ? (
        <p className="text-muted-foreground text-sm">読み込み中...</p>
      ) : rows.length === 0 && editingId !== 'new' ? (
        <p className="text-muted-foreground text-sm mb-3">獲得目標が登録されていません</p>
      ) : (
        rows.map((row, index) =>
          editingId === row.id ? (
            <div key={row.id}>{renderForm()}</div>
          ) : (
            <EvidenceRow
              key={row.id}
              row={row}
              index={index}
              rowCount={rows.length}
              ev={evals[row.id]}
              onMove={move}
              onEdit={startEdit}
              onRemove={remove}
            >
              <JudgmentPanel
                row={row}
                ev={evals[row.id]}
                open={judgeOpenId === row.id}
                jDraft={jDraft}
                setJDraft={setJDraft}
                jSaving={jSaving}
                onOpen={openJudgment}
                onSave={saveJudgment}
                onClear={clearJudgment}
                onCancel={() => setJudgeOpenId(null)}
              />
            </EvidenceRow>
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
