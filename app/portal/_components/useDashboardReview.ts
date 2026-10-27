// ポータルダッシュボードの自己評価ポップアップ（開閉・入力中の進捗・保存）
import { useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { KpiItemSummary } from './DashboardKpiSections'

export function useDashboardReview({
  companyId,
  userId,
  kpiGoals,
  setKpiGoals,
}: {
  companyId: string | null
  userId: string | undefined
  kpiGoals: KpiItemSummary[]
  setKpiGoals: Dispatch<SetStateAction<KpiItemSummary[]>>
}) {
  // 自己評価ポップアップ
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewProgress, setReviewProgress] = useState<Record<string, number>>({})
  const [reviewSaving, setReviewSaving] = useState(false)

  const openReviewDialog = () => {
    const initial: Record<string, number> = {}
    kpiGoals.forEach(k => { initial[k.id] = k.progress })
    setReviewProgress(initial)
    setReviewOpen(true)
  }

  const handleReviewSave = async () => {
    if (!companyId || !userId) return
    setReviewSaving(true)
    try {
      const updates = Object.entries(reviewProgress).map(([id, progress]) =>
        supabase.from('goal_kpis').update({ progress, updated_at: new Date().toISOString() }).eq('id', id)
      )
      await Promise.all(updates)
      // ローカルstateを即時更新
      setKpiGoals(prev => prev.map(k => reviewProgress[k.id] !== undefined ? { ...k, progress: reviewProgress[k.id] } : k))
      toast.success('進捗を更新しました')
      setReviewOpen(false)
    } catch {
      toast.error('更新に失敗しました')
    } finally {
      setReviewSaving(false)
    }
  }

  return {
    reviewOpen,
    setReviewOpen,
    reviewProgress,
    setReviewProgress,
    reviewSaving,
    openReviewDialog,
    handleReviewSave,
  }
}
