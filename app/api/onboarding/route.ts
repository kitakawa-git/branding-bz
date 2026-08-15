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

    // ④は招待リンクの発行と、管理者以外のメンバーが居ることの OR。
    // 招待リンクを使わず直接追加した会社（テックブリッジ等）を未完了にしないため
    const [philosophy, post, announcement, invited, memberCount] = await Promise.all([
      exists('philosophy_elements', companyId),
      exists('timeline_posts', companyId),
      exists('announcements', companyId),
      exists('invite_links', companyId),
      admin
        .from('members')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('is_active', true)
        .then((r) => r.count ?? 0),
    ])

    const status: OnboardingStatus = {
      philosophy,
      post,
      announcement,
      // 管理者自身も members に居るので、2名以上で「他の人を入れた」と見る
      invite: invited || memberCount >= 2,
    }

    return NextResponse.json({
      applicable: true,
      status,
      dismissedAt: adminUser.onboarding_dismissed_at ?? null,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
