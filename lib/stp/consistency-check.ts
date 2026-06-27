// STP分析 戦略整合性スコア（5項目の自動チェック）。純関数・クライアントで算出。
import type { STPSessionData } from '@/app/tools/stp/app/[sessionId]/page'

export interface ConsistencyCheckResult {
  total: number // 0-5
  items: Array<{ key: string; label: string; passed: boolean; reason?: string }>
}

export function checkConsistency(data: STPSessionData): ConsistencyCheckResult {
  const items: ConsistencyCheckResult['items'] = []

  // 1. S↔T: Step 2の切り口に選んだターゲットがマッピングされているか
  const allSegmentNames = new Set<string>()
  for (const v of data.segmentation?.variables || []) {
    for (const s of v.segments || []) {
      if (s.name?.trim()) allSegmentNames.add(s.name.trim())
    }
  }
  const targetsInSegmentation = [data.targeting.main_target, ...(data.targeting.sub_targets || [])]
    .filter(Boolean)
    .every((t) => allSegmentNames.has(t))
  items.push({
    key: 'st_consistency',
    label: 'S↔T整合',
    passed: targetsInSegmentation,
    reason: targetsInSegmentation ? undefined : '選んだターゲットがStep 2のセグメントに見つかりません',
  })

  // 2. S↔ターゲット適合マップ: Step 2の顧客側切り口がマップの軸に使われているか
  const fitMap = data.targeting.target_fit_map
  const fitMapExists = !!(fitMap?.x_axis?.left && fitMap?.y_axis?.top)
  items.push({
    key: 's_fitmap_consistency',
    label: 'S↔ターゲット適合マップ整合',
    passed: fitMapExists,
    reason: fitMapExists ? undefined : 'ターゲット適合マップが未生成です',
  })

  // 3. T↔ターゲット適合マップ: 全ターゲットがカバー範囲内か
  const allInCoverage = fitMap?.consistency_status === 'green'
  items.push({
    key: 't_fitmap_consistency',
    label: 'T↔ターゲット適合マップ整合',
    passed: allInCoverage,
    reason: allInCoverage ? undefined : 'ターゲットの一部がカバー範囲外です',
  })

  // 4. P↔競合差別化: 競合がポジショニングに2社以上配置されているか
  const hasCompetitorPositioning = (data.positioning?.items || []).filter((i) => !i.is_self).length >= 2
  items.push({
    key: 'p_consistency',
    label: 'P↔競合差別化整合',
    passed: hasCompetitorPositioning,
    reason: hasCompetitorPositioning ? undefined : 'ポジショニングマップに競合が2社以上配置されていません',
  })

  // 5. 自社の立ち位置生成: 全ターゲットに対して立ち位置が生成されているか
  const expectedStanceCount = 1 + (data.targeting.sub_targets?.length || 0)
  const stanceCount = data.brand_stance_statements?.statements.length || 0
  const stanceComplete = stanceCount >= expectedStanceCount
  items.push({
    key: 'stance_complete',
    label: '自社の立ち位置生成',
    passed: stanceComplete,
    reason: stanceComplete ? undefined : `${expectedStanceCount}本中${stanceCount}本のみ生成済み`,
  })

  return {
    total: items.filter((i) => i.passed).length,
    items,
  }
}
