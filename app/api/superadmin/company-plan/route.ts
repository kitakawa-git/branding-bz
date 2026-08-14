// 企業のプランを更新する API（スーパー管理者専用）
// PATCH /api/superadmin/company-plan
//
// プラン変更はこれから課金に直結する操作なので、anon キー＋RLS の直 update ではなく
// service_role の API Route に寄せる。Stripe を入れるまでは、この経路が
// プランを変える唯一の手段になる。
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { PLAN_VALUES } from '@/lib/billing/plan-display'

/** リクエスト元がスーパー管理者か確認する。OK なら null、NG ならレスポンスを返す */
async function requireSuperadmin(
  request: NextRequest,
): Promise<{ error: NextResponse } | { error: null; authId: string }> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: '認証が必要です' }, { status: 401 }) }
  }
  const token = authHeader.replace('Bearer ', '')

  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
  if (authError || !user) {
    return { error: NextResponse.json({ error: 'セッションが無効です' }, { status: 401 }) }
  }

  const { data: adminUser } = await getSupabaseAdmin()
    .from('admin_users')
    .select('is_superadmin')
    .eq('auth_id', user.id)
    .single()

  if (!adminUser?.is_superadmin) {
    return { error: NextResponse.json({ error: 'スーパー管理者権限が必要です' }, { status: 403 }) }
  }
  return { error: null, authId: user.id }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSuperadmin(request)
    if (auth.error) return auth.error

    const body = await request.json()
    const { company_id, plan, plan_expires_at, is_demo } = body ?? {}

    if (!company_id || typeof company_id !== 'string') {
      return NextResponse.json({ error: 'company_id は必須です' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}

    if (plan !== undefined) {
      // DB の check 制約と同じ集合。card は販売終了なので新規に割り当てさせない
      if (!PLAN_VALUES.includes(plan)) {
        return NextResponse.json(
          { error: `plan は ${PLAN_VALUES.join(' / ')} のいずれかです` },
          { status: 400 },
        )
      }
      updates.plan = plan
    }

    if (plan_expires_at !== undefined) {
      if (plan_expires_at === null || plan_expires_at === '') {
        updates.plan_expires_at = null // 無期限
      } else if (Number.isNaN(new Date(plan_expires_at).getTime())) {
        return NextResponse.json({ error: 'plan_expires_at の形式が不正です' }, { status: 400 })
      } else {
        updates.plan_expires_at = new Date(plan_expires_at).toISOString()
      }
    }

    if (is_demo !== undefined) {
      if (typeof is_demo !== 'boolean') {
        return NextResponse.json({ error: 'is_demo は真偽値です' }, { status: 400 })
      }
      updates.is_demo = is_demo
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '更新する項目がありません' }, { status: 400 })
    }

    // プランを有償側へ上げるとき、開始日時が未設定なら埋める（いつからの契約か追えるように）
    const supabaseAdmin = getSupabaseAdmin()
    if (typeof updates.plan === 'string' && updates.plan !== 'free') {
      const { data: current } = await supabaseAdmin
        .from('companies')
        .select('plan_started_at')
        .eq('id', company_id)
        .single()
      if (!current?.plan_started_at) updates.plan_started_at = new Date().toISOString()
    }

    const { data, error } = await supabaseAdmin
      .from('companies')
      .update(updates)
      .eq('id', company_id)
      .select('id, plan, plan_started_at, plan_expires_at, is_demo')
      .single()

    if (error) {
      console.error('[CompanyPlan] 更新エラー:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 課金に直結する操作なので、誰がどの企業をどう変えたかを残す
    console.info('[CompanyPlan] 更新', { by: auth.authId, company_id, updates })

    return NextResponse.json({ company: data })
  } catch (err) {
    console.error('[CompanyPlan] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
