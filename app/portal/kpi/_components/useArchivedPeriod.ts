// 過去の期間アコーディオンの開閉状態と、期間ごとの目標・KPI読み込み
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { GOAL_COLUMNS } from '@/lib/goals/types'
import type { ArchivedPeriodData, GoalKpi, PersonalGoal } from './kpi-utils'

export function useArchivedPeriod(companyId: string | null | undefined, userId: string | undefined) {
  // 過去の期間アコーディオン
  const [expandedArchiveId, setExpandedArchiveId] = useState<string | null>(null)
  const [archiveData, setArchiveData] = useState<ArchivedPeriodData | null>(null)
  const [archiveLoading, setArchiveLoading] = useState(false)

  // ============================================
  // Load Archive Data
  // ============================================
  const loadArchiveData = async (periodId: string) => {
    if (!companyId || !userId) return
    setArchiveLoading(true)
    try {
      const [goalRes, kpisRes] = await Promise.all([
        supabase.from('goals').select(GOAL_COLUMNS)
          .eq('company_id', companyId).eq('level', 'personal').eq('owner_user_id', userId).eq('period_id', periodId).limit(1).maybeSingle(),
        supabase.from('goal_kpis').select('*').eq('company_id', companyId).eq('user_id', userId).order('created_at', { ascending: true }),
      ])
      const archGoal = goalRes.error ? null : (goalRes.data as PersonalGoal)
      const archKpis = archGoal ? ((kpisRes.data || []) as GoalKpi[]).filter(k => k.goal_id === archGoal.id) : []
      setArchiveData({ goal: archGoal, kpis: archKpis })
    } catch (err) { console.error('[KPI] Archive load error:', err) }
    finally { setArchiveLoading(false) }
  }

  const toggleArchive = (periodId: string) => {
    if (expandedArchiveId === periodId) {
      setExpandedArchiveId(null)
      setArchiveData(null)
    } else {
      setExpandedArchiveId(periodId)
      loadArchiveData(periodId)
    }
  }

  return { expandedArchiveId, archiveData, archiveLoading, toggleArchive }
}
