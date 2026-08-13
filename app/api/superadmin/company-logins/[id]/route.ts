// スーパー管理: 企業の従業員ごとの最終ログイン日時（superadmin限定）
// GET /api/superadmin/company-logins/[id]
//
// 最終ログインは auth.users.last_sign_in_at にあり、auth スキーマは PostgREST に
// 公開されていないためクライアントからは読めない。service_role の admin API 経由で取る。
// profiles（名刺の従業員）と auth ユーザーは members が繋いでいるので、
// members.profile_id → members.auth_id → auth.users という順にたどる。
// 認可は company-view route と同方針（Bearer → auth.getUser → admin_users.is_superadmin）
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: companyId } = await params
    if (!companyId) {
      return NextResponse.json({ error: 'companyId は必須です' }, { status: 400 })
    }

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
    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '認証エラー: セッションが無効です。' }, { status: 401 })
    }

    const admin = getSupabaseAdmin()
    const { data: adminUser } = await admin
      .from('admin_users')
      .select('is_superadmin')
      .eq('auth_id', user.id)
      .maybeSingle()
    if (!adminUser?.is_superadmin) {
      return NextResponse.json({ error: 'スーパー管理者権限が必要です。' }, { status: 403 })
    }

    const { data: memberRows, error: memberError } = await admin
      .from('members')
      .select('profile_id, auth_id, status')
      .eq('company_id', companyId)
      .not('profile_id', 'is', null)

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 })
    }

    // 1人ずつ問い合わせるのは現状の規模（1社あたり数名〜数十名）で足りるため。
    // 数百名規模の企業が出てきたら listUsers でまとめて引く形に変える
    const logins = await Promise.all(
      (memberRows ?? []).map(async (row) => {
        const authId = row.auth_id as string | null
        let lastSignInAt: string | null = null
        if (authId) {
          try {
            const { data } = await admin.auth.admin.getUserById(authId)
            lastSignInAt = data?.user?.last_sign_in_at ?? null
          } catch {
            lastSignInAt = null
          }
        }
        return {
          profile_id: row.profile_id as string,
          // アカウントが無い（招待前）と、アカウントはあるが未ログイン、を画面で
          // 区別できるようにフラグも返す
          has_account: authId !== null,
          status: (row.status as string | null) ?? null,
          last_sign_in_at: lastSignInAt,
        }
      }),
    )

    return NextResponse.json({ logins })
  } catch (e) {
    const message = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
