'use client'

// API Route が 403 {error:'plan_required', requiredPlan, feature} を返したときの共通処理。
// 従来は各ツールが `toast.error('○○に失敗しました')` を出していたが、原因が「プラン外」
// のときはそれでは何をすればよいか伝わらない。この関数で「{requiredPlan} からです」と
// 伝え、/plan への導線をつける。
//
// 使い方（Step5 等）:
//   const res = await fetch(...)
//   const data = await res.json()
//   if (!res.ok) {
//     if (handlePlanRequired(res, data)) return   // プラン外ならここで終わり
//     toast.error(data.error || '○○に失敗しました')
//     return
//   }
import { toast } from 'sonner'
import { PLAN_LABELS } from './plan-display'
import type { FeatureKey, Plan } from './entitlements'

type PlanRequiredBody = {
  error: 'plan_required'
  requiredPlan: Plan
  feature: FeatureKey
}

function isPlanRequired(body: unknown): body is PlanRequiredBody {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  return (
    b.error === 'plan_required' &&
    typeof b.requiredPlan === 'string' &&
    typeof b.feature === 'string'
  )
}

/**
 * API 応答が 403 plan_required なら、アップセルトーストを出して true を返す。
 * それ以外は何もせず false を返す（呼び出し側は従来のエラー処理を続ける）。
 */
export function handlePlanRequired(res: Response, data: unknown): boolean {
  if (res.status !== 403) return false
  if (!isPlanRequired(data)) return false
  const label = PLAN_LABELS[data.requiredPlan] ?? data.requiredPlan
  toast.message(`この機能は ${label} からです`, {
    description: '料金プランを見て、必要なプランに切り替えてください。',
    duration: 8000,
    action: {
      label: '料金プランを見る',
      onClick: () => {
        if (typeof window !== 'undefined') window.location.href = '/plan'
      },
    },
  })
  return true
}
