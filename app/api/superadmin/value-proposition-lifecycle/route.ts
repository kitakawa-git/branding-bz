// 未来設計 §8 提供価値のライフサイクル状態遷移（superadmin限定・service_role 経由）
// POST /api/superadmin/value-proposition-lifecycle
//   {companyId, valuePropositionId, lifecycleState: 'target'|'transition_candidate'|'current'|'retired'}
// current へ昇格するときは promoted_by / promoted_at も記録する。
// ※ value_propositions の lifecycle_state はクライアント直更新できないため必ずこのAPIを通す。
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

const LIFECYCLE_STATES = ['target', 'transition_candidate', 'current', 'retired'] as const
type LifecycleState = (typeof LIFECYCLE_STATES)[number]

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '認証が必要です。再ログインしてください。' }, { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '')
    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    )
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '認証エラー: セッションが無効です。' }, { status: 401 })
    }
    const supabaseAdmin = getSupabaseAdmin()
    const { data: adminUser } = await supabaseAdmin
      .from('admin_users')
      .select('is_superadmin')
      .eq('auth_id', user.id)
      .maybeSingle()
    if (!adminUser?.is_superadmin) {
      return NextResponse.json({ error: 'スーパー管理者権限が必要です。' }, { status: 403 })
    }

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
      patch.promoted_by = user.id
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
