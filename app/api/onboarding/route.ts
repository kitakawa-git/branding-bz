// 初回セットアップ案内の状態
// GET  /api/onboarding — 4ステップの完了状況と「あとで」の有無を返す（管理者のみ）
// POST /api/onboarding/dismiss は別ファイル
//
// 完了判定は「データがあるか」だけを見る。ポータルと管理画面の両方から呼ぶので、
// 判定は必ずここ1箇所を通す（lib/onboarding/steps.ts の定義とセット）。
import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { OnboardingStatus } from '@/lib/onboarding/steps'

/** 自社に1件でもあるか。count だけ取るので行は読まない */
async function exists(table: string, companyId: string) {
  const { count } = await getSupabaseAdmin()
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
  return (count ?? 0) > 0
}

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

    // プランによって使うステップが違うので、全ステップぶんの判定をまとめて返し、
    // どれを見るかは lib/onboarding/steps.ts の定義に任せる。
    // どれも件数だけを見る（head: true）ので行は読まない。
    //
    // 招待は「招待リンクの発行」と「管理者以外のメンバーが居る」の OR。
    // 招待リンクを使わず直接追加した会社（テックブリッジ等）を未完了にしないため。
    // ビジュアルは brand_visuals の行。
    // companies.brand_color_primary は DEFAULT '#000000' で最初から値が入るため
    // 判定には使えない（使うと初日から完了扱いになる）。
    //
    // バーバルは brand_personalities.communication_style（トーン）と brand_terms（用語）の OR。
    // バーバル画面はトーンだけ保存しても用語の行を作らないので、用語だけを見ると
    // 説明どおりに操作した人が未完了のまま残る。
    // なお communication_style はパーソナリティ診断の本体連携でも書かれるため、
    // 診断から連携した人は画面を開かずに完了になる。中身は実際に入っているので許容する。
    const [
      philosophy,
      post,
      announcement,
      invited,
      visuals,
      terms,
      tone,
      memberCount,
      companyRow,
    ] = await Promise.all([
      exists('philosophy_elements', companyId),
      exists('timeline_posts', companyId),
      exists('announcements', companyId),
      exists('invite_links', companyId),
      exists('brand_visuals', companyId),
      exists('brand_terms', companyId),
      admin
        .from('brand_personalities')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .not('communication_style', 'is', null)
        .then((r) => (r.count ?? 0) > 0),
      admin
        .from('members')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('is_active', true)
        .then((r) => r.count ?? 0),
      admin
        .from('companies')
        .select('industry_category')
        .eq('id', companyId)
        .maybeSingle()
        .then((r) => r.data),
    ])

    const status: OnboardingStatus = {
      // ロゴは任意なので条件に入れない（画像を持たない会社が永久に未完了になる）
      basics: !!companyRow?.industry_category,
      philosophy,
      visuals,
      verbal: tone || terms,
      post,
      announcement,
      // 管理者自身も members に居るので、2名以上で「他の人を入れた」と見る
      invite: invited || memberCount >= 2,
    }

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
