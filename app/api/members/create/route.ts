import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { generateRandomSlug } from '@/lib/generate-slug'
import { checkMemberCapacity, memberLimitResponse } from '@/lib/billing/guard'
import { addToActiveSurveys } from '@/lib/brand-score/survey-participants'

export async function POST(req: NextRequest) {
  try {
    // ビルド時（env が揃わない環境）にモジュール評価で落ちないよう、handler 内で lazy 生成
    const supabaseAdmin = getSupabaseAdmin()
    const { email, password, display_name, company_id } = await req.json()

    if (!email || !password || !display_name || !company_id) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    // 人数上限。Auth ユーザーを作ってから気づくとロールバックが要るので先に見る
    const capacity = await checkMemberCapacity(company_id)
    if (!capacity.ok) return memberLimitResponse(capacity)

    // 1. Supabase Auth でユーザー作成
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,  // メール確認をスキップ
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // 2. profiles テーブルにレコード作成（名刺プロフィール）
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        company_id,
        name: display_name,
        email,
        slug: generateRandomSlug(),
        card_enabled: true,
      })
      .select('id')
      .single()

    if (profileError) {
      // Auth ユーザーを削除してロールバック
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: 'プロフィール作成失敗: ' + profileError.message }, { status: 400 })
    }

    // 3. members テーブルにレコード作成（profile_id を紐づけ）
    const { error: memberError } = await supabaseAdmin
      .from('members')
      .insert({
        auth_id: authData.user.id,
        company_id,
        display_name,
        email,
        profile_id: profileData.id,
      })

    if (memberError) {
      // profiles + Auth ユーザーを削除してロールバック
      await supabaseAdmin.from('profiles').delete().eq('id', profileData.id)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: 'メンバー作成失敗: ' + memberError.message }, { status: 400 })
    }

    // 配信中のサーベイがあれば参加者に足す（後から入った人にバナーが出ない問題の対処）
    await addToActiveSurveys(company_id, [profileData.id])

    return NextResponse.json({ success: true, member_id: authData.user.id, profile_id: profileData.id })
  } catch (err) {
    console.error('[API members/create] エラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '不明なエラー' },
      { status: 500 }
    )
  }
}
