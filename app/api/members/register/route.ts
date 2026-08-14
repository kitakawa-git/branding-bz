import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { generateRandomSlug } from '@/lib/generate-slug'
import { checkMemberCapacity, memberLimitResponse } from '@/lib/billing/guard'

export async function POST(req: NextRequest) {
  try {
    // ビルド時（env が揃わない環境）にモジュール評価で落ちないよう、handler 内で lazy 生成
    const supabaseAdmin = getSupabaseAdmin()
    const { email, password, display_name, token } = await req.json()

    if (!email || !password || !display_name || !token) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    // 1. invite_links テーブルでトークン検証 → company_id 取得
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('invite_links')
      .select('company_id')
      .eq('token', token)
      .eq('is_active', true)
      .single()

    if (inviteError || !invite) {
      return NextResponse.json({ error: '無効または期限切れの招待リンクです' }, { status: 400 })
    }

    const company_id = invite.company_id

    // 招待リンクは何人でも通れてしまうので、ここでも人数上限を見る。
    // 断るのは招待された本人なので、文面は「管理者に連絡してほしい」寄りにしたいが、
    // 上限と現在人数は共通の 403 で返し、画面側で言い換える
    const capacity = await checkMemberCapacity(company_id)
    if (!capacity.ok) return memberLimitResponse(capacity)

    // 2. Supabase Auth でユーザー作成
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,  // メール確認をスキップ
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // 3. profiles テーブルにレコード作成（名刺プロフィール）
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

    // 4. members テーブルにレコード作成（profile_id を紐づけ）
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

    // email と password を返す（クライアント側で signInWithPassword するため）
    return NextResponse.json({ success: true, email, password })
  } catch (err) {
    console.error('[API members/register] エラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '不明なエラー' },
      { status: 500 }
    )
  }
}
