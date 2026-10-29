// 構築ツールの今月の残り回数
// GET /api/tools/usage
//
// 429（上限到達）は「権限がない」ではなく「今月使い切った」なので、
// 先に残り回数を見せて予告できるようにする。
// buildToolsUnlimited のプランでは limit=null を返し、UI 側はバッジを出さない。
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase/server'
import { MONTHLY_FREE_LIMIT, countCompletedThisMonth, type BuildToolAppType } from '@/lib/tools/free-limits'
import { getEffectivePlan, getBuildToolMonthlyLimit } from '@/lib/billing/entitlements'
import { fetchCompanyPlan, fetchCompanyIdForAuth } from '@/lib/billing/guard'

/** mini_app_sessions.app_type と画面上のツールの対応 */
const APP_TYPES: readonly BuildToolAppType[] = ['brand_colors', 'stp', 'persona', 'personality'] as const

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const companyId = await fetchCompanyIdForAuth(user.id)
    const plan = getEffectivePlan(await fetchCompanyPlan(companyId))
    const limit = getBuildToolMonthlyLimit(plan)

    // 無制限のプランでは数えない（バッジも出さない）
    if (limit === null) {
      return NextResponse.json({ limit: null, remaining: null })
    }

    // 261006_v1: カウントは会社単位。会社が無ければ従来どおり user_id で数える。
    const admin = getSupabaseAdmin()
    const counts = await Promise.all(
      APP_TYPES.map(async (appType) => {
        const used = await countCompletedThisMonth(admin, appType, { companyId, authId: user.id })
        return [appType, Math.max(0, MONTHLY_FREE_LIMIT - used)] as const
      }),
    )

    return NextResponse.json({
      limit,
      remaining: Object.fromEntries(counts) as Record<string, number>,
    })
  } catch (err) {
    console.error('[ToolsUsage] エラー:', err)
    return NextResponse.json({ error: 'Unknown error' }, { status: 500 })
  }
}
