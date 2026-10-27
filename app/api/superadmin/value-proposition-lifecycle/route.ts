// 未来設計 §8 提供価値のライフサイクル状態遷移（superadmin限定・service_role 経由）
// POST /api/superadmin/value-proposition-lifecycle
//   {companyId, valuePropositionId, lifecycleState: 'target'|'transition_candidate'|'current'|'retired'}
// current へ昇格するときは promoted_by / promoted_at も記録する。
// ※ value_propositions の lifecycle_state はクライアント直更新できないため必ずこのAPIを通す。
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireSuperadmin } from '@/lib/auth/caller'

const LIFECYCLE_STATES = ['target', 'transition_candidate', 'current', 'retired'] as const
type LifecycleState = (typeof LIFECYCLE_STATES)[number]

export async function POST(request: NextRequest) {
  try {
    // superadmin 認証（判定は lib/auth/caller に一本化。Bearer と cookie の両方を受ける）
    const caller = await requireSuperadmin(request)
    if (caller.error) return caller.error
    const supabaseAdmin = getSupabaseAdmin()

    const body = await request.json()
    const companyId: string = body?.companyId
    const valuePropositionId: string = body?.valuePropositionId
    const lifecycleState: LifecycleState = body?.lifecycleState
    if (!companyId || !valuePropositionId) {
      return NextResponse.json({ error: 'companyId と valuePropositionId は必須です' }, { status: 400 })
    }
    if (!LIFECYCLE_STATES.includes(lifecycleState)) {
      return NextResponse.json({ error: 'lifecycleState が不正です' }, { status: 400 })
    }

    const { data: vp } = await supabaseAdmin
      .from('value_propositions')
      .select('id, lifecycle_state')
      .eq('id', valuePropositionId)
      .eq('company_id', companyId)
      .maybeSingle()
    if (!vp) {
      return NextResponse.json({ error: '対象の提供価値が見つかりません' }, { status: 404 })
    }

    // ※ value_propositions に updated_at 列は無いので触らない
    const patch: Record<string, unknown> = { lifecycle_state: lifecycleState }
    // current への昇格だけ「誰がいつ昇格させたか」を残す
    if (lifecycleState === 'current' && vp.lifecycle_state !== 'current') {
      patch.promoted_by = caller.authId
      patch.promoted_at = new Date().toISOString()
    }

    const { data: updated, error } = await supabaseAdmin
      .from('value_propositions')
      .update(patch)
      .eq('id', valuePropositionId)
      .eq('company_id', companyId)
      .select('id, title, lifecycle_state, promoted_by, promoted_at')
      .single()
    if (error) throw error

    return NextResponse.json({ ok: true, valueProposition: updated })
  } catch (err) {
    console.error('[value-proposition-lifecycle] エラー:', err)
    const message = err instanceof Error ? err.message : 'サーバーエラーが発生しました'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
