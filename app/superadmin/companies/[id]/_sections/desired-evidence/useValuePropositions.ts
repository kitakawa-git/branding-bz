// §8 提供価値のライフサイクル（一覧・処理中ID）の取得と状態変更をまとめたフック
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { authedPost, type VpRow } from './shared'

export function useValuePropositions({
  companyId,
  onDataChanged,
}: {
  companyId: string
  onDataChanged?: () => void
}) {
  // 提供価値のライフサイクル（§8）
  const [vps, setVps] = useState<VpRow[]>([])
  const [vpBusyId, setVpBusyId] = useState<string | null>(null)

  const fetchVps = async () => {
    const { data, error } = await supabase
      .from('value_propositions')
      .select('id, title, lifecycle_state, promoted_at, sort_order')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true })
    if (error) {
      console.error('[DesiredEvidence] 提供価値の取得エラー:', error)
      return
    }
    setVps((data as VpRow[]) || [])
  }

  const changeVpState = async (vp: VpRow, next: string) => {
    if (next === 'current' && (vp.lifecycle_state ?? 'current') !== 'current') {
      if (!confirm(`「${vp.title || '（無題）'}」を現在の約束に昇格しますか？（昇格者と日時が記録されます）`)) return
    }
    setVpBusyId(vp.id)
    try {
      await authedPost('/api/superadmin/value-proposition-lifecycle', {
        companyId,
        valuePropositionId: vp.id,
        lifecycleState: next,
      })
      toast.success(next === 'current' ? '現在の約束に昇格しました' : '状態を変更しました')
      await fetchVps()
      onDataChanged?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '変更に失敗しました')
    } finally {
      setVpBusyId(null)
    }
  }

  return { vps, vpBusyId, fetchVps, changeVpState }
}
