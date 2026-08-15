// POST /api/onboarding/dismiss — 初回セットアップ案内を「あとで」で閉じる（管理者のみ）
//
// 閉じるのはポータル側の案内だけ。管理画面の鏡写しカードは 4/4 完了まで残す。
// 案内は消せるが迷子にはさせない、という分担。
import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST() {
  try {
    const supabaseUser = await createServerSupabase()
    const {
      data: { user },
    } = await supabaseUser.auth.getUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const admin = getSupabaseAdmin()
    // 更新できた行を数えたいので select を繋ぐ。
    // supabase-js は select 無しだと影響行を返さず、0行でも error が null になる
    const { data, error } = await admin
      .from('admin_users')
      .update({ onboarding_dismissed_at: new Date().toISOString() })
      .eq('auth_id', user.id)
      .select('id')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) {
      return NextResponse.json({ error: '管理者のみ操作できます' }, { status: 403 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
