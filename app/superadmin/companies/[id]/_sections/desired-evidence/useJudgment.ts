// §6 人間判断の状態（開いている行・下書き・保存中）と記録／取り下げ処理をまとめたフック
import { useState } from 'react'
import { toast } from 'sonner'
import type { AchievementRuleV1 } from '@/lib/brand/future-design/types'
import type { DesiredEvidenceEvaluationDto } from '@/app/api/superadmin/desired-evidence/evaluations/route'
import type { DesiredEvidence } from '../desired-evidence-rules'
import { authedPost, checkStateProgress, emptyJudgmentDraft, type JudgmentDraft } from './shared'

export function useJudgment({
  companyId,
  evals,
  fetchEvaluations,
  onDataChanged,
}: {
  companyId: string
  evals: Record<string, DesiredEvidenceEvaluationDto>
  fetchEvaluations: () => Promise<void>
  onDataChanged?: () => void
}) {
  // 人間判断パネル（§6）
  const [judgeOpenId, setJudgeOpenId] = useState<string | null>(null)
  const [jDraft, setJDraft] = useState<JudgmentDraft>(emptyJudgmentDraft())
  const [jSaving, setJSaving] = useState(false)

  const openJudgment = (row: DesiredEvidence) => {
    const ev = evals[row.id]
    setJDraft({
      achievementState: (ev?.judgmentState ?? 'met') as JudgmentDraft['achievementState'],
      progress: ev?.judgmentProgress != null ? String(ev.judgmentProgress) : '',
      reason: ev?.judgmentReason ?? '',
    })
    setJudgeOpenId(row.id)
  }

  const saveJudgment = async (row: DesiredEvidence) => {
    if (!jDraft.reason.trim()) {
      toast.error('判断の理由は必須です')
      return
    }
    const consistency = checkStateProgress(jDraft.achievementState, jDraft.progress)
    if (consistency) {
      toast.error(consistency)
      return
    }
    // §6 手動ルールは manual_review、それ以外は自動評価の上書き＝automatic_override
    const r = row.achievement_rule as AchievementRuleV1 | null
    const source = r && typeof r === 'object' && 'type' in r && r.type === 'manual' ? 'manual_review' : 'automatic_override'

    setJSaving(true)
    try {
      await authedPost('/api/superadmin/desired-evidence/judgment', {
        companyId,
        desiredEvidenceId: row.id,
        evaluationSource: source,
        achievementState: jDraft.achievementState,
        progressFraction: jDraft.progress.trim() === '' ? null : Number(jDraft.progress),
        reason: jDraft.reason.trim(),
      })
      toast.success('人間判断を記録しました')
      setJudgeOpenId(null)
      await fetchEvaluations()
      onDataChanged?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '記録に失敗しました')
    } finally {
      setJSaving(false)
    }
  }

  const clearJudgment = async (row: DesiredEvidence) => {
    if (!confirm('人間判断を取り下げて、自動評価に戻しますか？')) return
    setJSaving(true)
    try {
      await authedPost('/api/superadmin/desired-evidence/judgment', {
        companyId,
        desiredEvidenceId: row.id,
        action: 'clear',
      })
      toast.success('自動評価に戻しました')
      setJudgeOpenId(null)
      await fetchEvaluations()
      onDataChanged?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '取り下げに失敗しました')
    } finally {
      setJSaving(false)
    }
  }

  return { judgeOpenId, setJudgeOpenId, jDraft, setJDraft, jSaving, openJudgment, saveJudgment, clearJudgment }
}
