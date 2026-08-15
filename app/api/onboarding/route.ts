// 初回セットアップ案内の状態
// GET  /api/onboarding — 各ステップの完了状況と「あとで」の有無を返す（管理者のみ）
// POST /api/onboarding/dismiss は別ファイル
//
// 完了判定そのものは lib/onboarding/status.ts に置く。入力サポートの
// 相談リクエスト（/api/setup-support-requests）も同じ判定を使うため。
import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { computeOnboardingStatus } from '@/lib/onboarding/status'

export async function GET() {
  try {
    const supabaseUser = await createServerSupabase()
    const {
      data: { user },
    } = await supabaseUser.auth.getUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const admin = getSupabaseAdmin()
    const { data: adminUser } = await admin
      .from('admin_users')
      .select('company_id, onboarding_dismissed_at')
      .eq('auth_id', user.id)
      .maybeSingle()

    // 管理者以外にはそもそも案内を出さないので、404 ではなく「対象外」を返す
    if (!adminUser?.company_id) {
      return NextResponse.json({ applicable: false })
    }
    const companyId = adminUser.company_id as string

    const status = await computeOnboardingStatus(companyId)

    return NextResponse.json({
      applicable: true,
      // 「準備完了」通知の基準値を会社ごとに持つためにクライアントへ返す。
      // 1値だと、同じタブで別企業を跨いで見たときに誤発火する余地がある
      companyId,
      status,
      dismissedAt: adminUser.onboarding_dismissed_at ?? null,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
