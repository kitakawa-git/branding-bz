// アカウントの一括登録
// POST /api/members/bulk-create
//   body: { rows: [{ display_name, email, password, role_category? }] }
//
// 会社は呼び出した管理者の company_id で確定させる（body では受けない）。
// 1件でも失敗したら全部やめる、という作りにはしない。50人ぶんのファイルで
// 1人がメール重複しただけで全部やり直すのは現実的でないため、
// 行ごとに成否を返して画面で見せる。
//
// 1件ぶんの作成手順は /api/members/create と同じ（Auth → profiles → members）。
// 途中で失敗したらその行だけ巻き戻す。
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { supabase } from '@/lib/supabase'
import { generateRandomSlug } from '@/lib/generate-slug'
import { MEMBER_ROLE_OPTIONS } from '@/lib/constants/member-roles'

export const maxDuration = 60

const ROLE_VALUES = new Set(MEMBER_ROLE_OPTIONS.map((o) => o.value as string))

/** 1回で受ける上限。これを超えると実行時間が読めない */
const MAX_ROWS = 200

interface InputRow {
  display_name?: unknown
  email?: unknown
  password?: unknown
  role_category?: unknown
}

async function getAdminCompanyId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null

  const token = authHeader.replace('Bearer ', '')
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)
  if (error || !user) return null

  const { data: admin } = await getSupabaseAdmin()
    .from('admin_users')
    .select('company_id')
    .eq('auth_id', user.id)
    .single()

  return (admin?.company_id as string) || null
}

export async function POST(request: NextRequest) {
  try {
    const companyId = await getAdminCompanyId(request)
    if (!companyId) {
      return NextResponse.json({ error: '管理者のみ操作できます' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const rows = body?.rows
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: '登録する行がありません' }, { status: 400 })
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `一度に登録できるのは${MAX_ROWS}件までです` },
        { status: 400 }
      )
    }

    const admin = getSupabaseAdmin()
    const results: { email: string; ok: boolean; error?: string }[] = []

    for (const raw of rows as InputRow[]) {
      const displayName = String(raw.display_name ?? '').trim()
      const email = String(raw.email ?? '').trim()
      const password = String(raw.password ?? '')
      const roleCategory = String(raw.role_category ?? '').trim()

      if (!displayName || !email || !password) {
        results.push({ email, ok: false, error: '氏名・メール・パスワードが必要です' })
        continue
      }

      // 1. Auth ユーザー
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (authError || !authData?.user) {
        results.push({ email, ok: false, error: authError?.message ?? 'アカウント作成に失敗' })
        continue
      }

      // 2. profiles（名刺プロフィール）。区分もここに持つ
      const { data: profileData, error: profileError } = await admin
        .from('profiles')
        .insert({
          company_id: companyId,
          name: displayName,
          email,
          slug: generateRandomSlug(),
          card_enabled: true,
          role_category: ROLE_VALUES.has(roleCategory) ? roleCategory : null,
        })
        .select('id')
        .single()

      if (profileError || !profileData) {
        await admin.auth.admin.deleteUser(authData.user.id)
        results.push({ email, ok: false, error: 'プロフィール作成に失敗: ' + profileError?.message })
        continue
      }

      // 3. members
      const { error: memberError } = await admin.from('members').insert({
        auth_id: authData.user.id,
        company_id: companyId,
        display_name: displayName,
        email,
        profile_id: profileData.id,
      })

      if (memberError) {
        await admin.from('profiles').delete().eq('id', profileData.id)
        await admin.auth.admin.deleteUser(authData.user.id)
        results.push({ email, ok: false, error: 'メンバー作成に失敗: ' + memberError.message })
        continue
      }

      results.push({ email, ok: true })
    }

    return NextResponse.json({
      created: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    })
  } catch (err) {
    console.error('[members/bulk-create] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
