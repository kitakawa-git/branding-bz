// API Route 用：呼び出した人の認証・所属をセッションから決める共通ヘルパー（サーバー専用）。
//
// ⚠️ body / query の company_id・userId・profileId を信用しないこと。
//    受け取った ID をそのまま使うと、他社の ID を渡すだけで他社のデータを読み書きできてしまう。
//    会社・ユーザーは必ずここで決めた値を使う。
//
// 認証は2系統あるので両方受ける：
//   - Authorization: Bearer <access_token>（管理画面・スーパー管理の一部が送る）
//   - @supabase/ssr の cookie セッション（それ以外の画面。fetch は同一オリジンなら cookie を送る）
//
// 返り値は「error があればそのまま return する」形に統一する。
//   const caller = await requireCompanyAdmin(request)
//   if (caller.error) return caller.error
import 'server-only'
import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

type Failure = { error: NextResponse }

export type CallerContext = {
  authId: string
  /** auth.users.email（依頼メールの差出人表示などに使う） */
  email: string | null
  /** 所属会社（admin_users → members の順）。どちらにも居なければ null */
  companyId: string | null
  isAdmin: boolean
  isSuperadmin: boolean
  /** members.profile_id（ポータル側）。管理者だけの人は null のことがある */
  profileId: string | null
}

export type CompanyCallerContext = CallerContext & { companyId: string }

function fail(status: 401 | 403, message: string): Failure {
  return { error: NextResponse.json({ error: message }, { status }) }
}

/** Bearer があればそれで、なければ cookie セッションで getUser する。未ログインなら null */
export async function getCallerUser(request?: Request): Promise<{ id: string; email: string | null } | null> {
  const authHeader = request?.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length)
    const supabaseUser = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { autoRefreshToken: false, persistSession: false },
      },
    )
    const { data: { user } } = await supabaseUser.auth.getUser(token)
    return user ? { id: user.id, email: user.email ?? null } : null
  }

  // 動的 import は next/headers に依存するモジュールを循環させないため
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user ? { id: user.id, email: user.email ?? null } : null
}

/** getCallerUser の id だけ版 */
export async function getCallerAuthId(request?: Request): Promise<string | null> {
  return (await getCallerUser(request))?.id ?? null
}

/** ログインしていれば所属を引いて返す。会社に属していなくても通す（構築ツールの個人利用など） */
export async function requireCaller(request?: Request): Promise<Failure | (CallerContext & { error?: undefined })> {
  const user = await getCallerUser(request)
  if (!user) return fail(401, '認証が必要です')
  const authId = user.id

  const admin = getSupabaseAdmin()
  const [{ data: adminRow }, { data: memberRow }] = await Promise.all([
    admin.from('admin_users').select('company_id, is_superadmin').eq('auth_id', authId).maybeSingle(),
    admin.from('members').select('company_id, profile_id, is_active').eq('auth_id', authId).maybeSingle(),
  ])

  return {
    authId,
    email: user.email,
    companyId: adminRow?.company_id ?? (memberRow?.is_active === false ? null : memberRow?.company_id) ?? null,
    isAdmin: !!adminRow,
    isSuperadmin: !!adminRow?.is_superadmin,
    profileId: memberRow?.profile_id ?? null,
  }
}

/** 会社に属している（管理者 or 有効なメンバー）人だけ通す */
export async function requireCompanyMember(request?: Request): Promise<Failure | (CompanyCallerContext & { error?: undefined })> {
  const caller = await requireCaller(request)
  if (caller.error) return caller
  if (!caller.companyId) return fail(403, '所属会社が見つかりません')
  return { ...caller, companyId: caller.companyId }
}

/** 会社の管理者（admin_users）だけ通す */
export async function requireCompanyAdmin(request?: Request): Promise<Failure | (CompanyCallerContext & { error?: undefined })> {
  const caller = await requireCaller(request)
  if (caller.error) return caller
  if (!caller.isAdmin || !caller.companyId) return fail(403, '管理者権限が必要です')
  return { ...caller, companyId: caller.companyId }
}

/** スーパー管理者だけ通す */
/**
 * スーパー管理者だけ通す。
 * 文言は superadmin API が以前から返していたものに揃えてある（画面がトーストにそのまま出すため変えない）:
 *   トークンもセッションも無い → 401「認証が必要です。再ログインしてください。」
 *   Bearer はあるが無効       → 401「認証エラー: セッションが無効です。」
 *   superadmin ではない        → 403「スーパー管理者権限が必要です。」
 */
export async function requireSuperadmin(request?: Request): Promise<Failure | (CallerContext & { error?: undefined })> {
  const hasBearer = !!request?.headers.get('authorization')?.startsWith('Bearer ')
  const caller = await requireCaller(request)
  if (caller.error) {
    return hasBearer
      ? fail(401, '認証エラー: セッションが無効です。')
      : fail(401, '認証が必要です。再ログインしてください。')
  }
  if (!caller.isSuperadmin) return fail(403, 'スーパー管理者権限が必要です。')
  return caller
}

/**
 * 「本人の操作か」。構築ツールのように画面が userId を送ってくる API で使う。
 * userId はセッションの持ち主と一致するときだけ通し、以降はセッションの authId を使う。
 * userId を省略した呼び出しはセッションの持ち主として扱う。
 */
export async function requireSelf(
  request: Request | undefined,
  claimedUserId: string | null | undefined,
): Promise<Failure | { error?: undefined; authId: string }> {
  const authId = await getCallerAuthId(request)
  if (!authId) return fail(401, '認証が必要です')
  if (claimedUserId && claimedUserId !== authId) return fail(403, '他のユーザーのデータにはアクセスできません')
  return { authId }
}

/**
 * 構築ツールのセッション（mini_app_sessions）が呼び出した本人のものか。
 * 通れば session 行（id・user_id・company_id・app_type）を返す。
 */
export async function requireOwnToolSession(
  request: Request | undefined,
  sessionId: string | null | undefined,
): Promise<
  | Failure
  | { error?: undefined; authId: string; session: { id: string; user_id: string; company_id: string | null; app_type: string } }
> {
  if (!sessionId) return { error: NextResponse.json({ error: 'sessionId が必要です' }, { status: 400 }) }
  const authId = await getCallerAuthId(request)
  if (!authId) return fail(401, '認証が必要です')
  const { data: session } = await getSupabaseAdmin()
    .from('mini_app_sessions')
    .select('id, user_id, company_id, app_type')
    .eq('id', sessionId)
    .maybeSingle()
  // 存在の有無を教えないため、他人のセッションも「見つからない」と同じ 404 にする
  if (!session || session.user_id !== authId) {
    return { error: NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 }) }
  }
  return { authId, session }
}

/**
 * 「その会社のデータに触ってよいか」。自社なら通す。superadmin は他社も通す。
 * 存在の有無を教えないため、権限不足と資源なしは区別せず 403 にする。
 */
export function assertSameCompany(caller: CallerContext, companyId: string | null | undefined): Failure | null {
  if (caller.isSuperadmin) return null
  if (!companyId || caller.companyId !== companyId) {
    return fail(403, 'この会社のデータにはアクセスできません')
  }
  return null
}
