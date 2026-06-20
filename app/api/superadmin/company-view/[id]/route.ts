// スーパー管理: 企業「閲覧ビュー」用 読み取り専用API（superadmin限定）
// GET /api/superadmin/company-view/[id]
// - 認可は map-review route と同方針（Bearerトークン → auth.getUser → admin_users.is_superadmin）
// - 認可後は getSupabaseAdmin()（service_role）で対象企業のデータを並列取得して1つのJSONで返す
// - RLSはbypassされる。テーブル/カラムが無い等のエラーは握りつぶして空で返す（表示専用なので堅牢性優先）
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// クエリ結果を安全に取り出す（error時は fallback）
async function rows<T = Record<string, unknown>>(
  thunk: PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  try {
    const { data, error } = await thunk
    return error ? [] : data ?? []
  } catch {
    return []
  }
}

async function count(
  thunk: PromiseLike<{ count: number | null; error: unknown }>,
): Promise<number> {
  try {
    const { count: c, error } = await thunk
    return error ? 0 : c ?? 0
  } catch {
    return 0
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: companyId } = await params
    if (!companyId) {
      return NextResponse.json({ error: 'companyId は必須です' }, { status: 400 })
    }

    // --- superadmin 認証（map-review と同方針） ---
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

    // --- 企業本体（無ければ404） ---
    const { data: company } = await admin
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .maybeSingle()
    if (!company) {
      return NextResponse.json({ error: '企業が見つかりません' }, { status: 404 })
    }

    // 社員（profile_id 群を card_views 集計に使う）
    const profiles = await rows(
      admin
        .from('profiles')
        .select('id, name, position, department, email, slug, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false }),
    )
    const profileIds = profiles.map((p) => (p as { id: string }).id)

    // 管理者（auth.users のメールを service_role で付与）
    const adminRowsRaw = await rows(
      admin
        .from('admin_users')
        .select('id, role, is_superadmin, created_at, auth_id')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true }),
    )
    const admins = await Promise.all(
      adminRowsRaw.map(async (a) => {
        const row = a as {
          id: string
          role: string
          is_superadmin: boolean
          created_at: string
          auth_id: string | null
        }
        let auth_email: string | null = null
        if (row.auth_id) {
          try {
            const { data } = await admin.auth.admin.getUserById(row.auth_id)
            auth_email = data?.user?.email ?? null
          } catch {
            auth_email = null
          }
        }
        return {
          id: row.id,
          role: row.role,
          is_superadmin: row.is_superadmin,
          created_at: row.created_at,
          auth_email,
        }
      }),
    )

    // --- 残りを並列取得 ---
    const byCompany = (table: string, select = '*', order?: string) => {
      let q = admin.from(table).select(select).eq('company_id', companyId)
      if (order) q = q.order(order, { ascending: false })
      return q
    }

    const [
      members,
      inviteLinkCount,
      brandGuidelines,
      valuePropositions,
      brandPersonas,
      brandPersonalities,
      brandVisuals,
      brandTerms,
      scoreSnapshots,
      goalPeriods,
      goalKpis,
      personalGoalCount,
      surveys,
      microFeedbackCount,
      timelineRecent,
      timelineCount,
      announcementRecent,
      announcementCount,
      cardViews,
    ] = await Promise.all([
      rows(byCompany('members', 'id, role, display_name, profile_id, created_at', 'created_at')),
      count(admin.from('invite_links').select('id', { count: 'exact', head: true }).eq('company_id', companyId)),
      rows(byCompany('brand_guidelines')),
      rows(byCompany('value_propositions', '*', 'created_at')),
      rows(byCompany('brand_personas', '*', 'created_at')),
      rows(byCompany('brand_personalities')),
      rows(byCompany('brand_visuals')),
      rows(byCompany('brand_terms', '*', 'created_at')),
      rows(admin.from('brand_score_snapshots').select('*').eq('company_id', companyId).order('snapshot_date', { ascending: true })),
      rows(byCompany('goal_periods', '*', 'created_at')),
      rows(byCompany('goal_kpis', '*', 'created_at')),
      count(admin.from('personal_goals').select('id', { count: 'exact', head: true }).eq('company_id', companyId)),
      rows(byCompany('brand_surveys', '*', 'created_at')),
      count(admin.from('brand_micro_feedbacks').select('id', { count: 'exact', head: true }).eq('company_id', companyId)),
      rows(byCompany('timeline_posts', 'id, created_at', 'created_at').limit(5)),
      count(admin.from('timeline_posts').select('id', { count: 'exact', head: true }).eq('company_id', companyId)),
      rows(byCompany('announcements', 'id, title, created_at', 'created_at').limit(5)),
      count(admin.from('announcements').select('id', { count: 'exact', head: true }).eq('company_id', companyId)),
      rows(
        profileIds.length > 0
          ? admin.from('card_views').select('viewed_at').in('profile_id', profileIds)
          : admin.from('card_views').select('viewed_at').eq('profile_id', '__none__'),
      ),
    ])

    // アンケート回答数（survey_id 経由）
    const surveyIds = (surveys as unknown as { id: string }[]).map((s) => s.id)
    const surveyResponseCount =
      surveyIds.length > 0
        ? await count(
            admin
              .from('brand_survey_responses')
              .select('id', { count: 'exact', head: true })
              .in('survey_id', surveyIds),
          )
        : 0

    // card_views: 合計 / 今月 / 今週
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const dayOfWeek = now.getDay()
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff)
    weekStart.setHours(0, 0, 0, 0)
    const views = cardViews as { viewed_at: string }[]
    const cardViewStats = {
      total: views.length,
      month: views.filter((v) => v.viewed_at >= monthStart).length,
      week: views.filter((v) => new Date(v.viewed_at) >= weekStart).length,
    }

    return NextResponse.json({
      company,
      basics: {
        profiles,
        members,
        admins,
        inviteLinkCount,
      },
      brand: {
        guidelines: brandGuidelines,
        valuePropositions,
        personas: brandPersonas,
        personalities: brandPersonalities,
        visuals: brandVisuals,
        terms: brandTerms,
      },
      metrics: {
        scoreSnapshots,
        goalPeriods,
        goalKpis,
        personalGoalCount,
        surveys,
        surveyResponseCount,
        microFeedbackCount,
        timeline: { count: timelineCount, recent: timelineRecent },
        announcements: { count: announcementCount, recent: announcementRecent },
        cardViews: cardViewStats,
      },
    })
  } catch (err) {
    console.error('[company-view] エラー:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
