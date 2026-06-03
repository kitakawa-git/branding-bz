// ブランド理解度テスト 受験状況API（リマインド用）
// GET /api/brand-score/quizzes/[id]/participants
// ============================================================
// 管理者が「誰が受けて誰が未受験か」を把握するための一覧。
// ★スコアは一切含めない。 記名式なので「受験有無」は把握可（Bの約束は
//   "点数を追えない"であって"受験有無不明"ではない）。results（集計）と
//   participants（受験有無）は別エンドポイント・別レスポンスにし、
//   個人 → 個人スコア のマッピングを取り出せないようにする。
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getAdminContext } from '@/lib/learning/auth'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id: quizId } = await context.params

    // 管理者特定（セッション → admin_users）
    const admin = await getAdminContext()
    if (!admin) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const supabase = getSupabaseAdmin()

    // クイズ取得＋テナント境界
    const { data: quiz, error: quizError } = await supabase
      .from('brand_quizzes')
      .select('id, company_id')
      .eq('id', quizId)
      .single()

    if (quizError) {
      console.error('[Quiz Participants GET] クイズ取得エラー:', quizError.message)
      const status = quizError.code === 'PGRST116' ? 404 : 500
      return NextResponse.json(
        { error: status === 404 ? 'テストが見つかりません' : quizError.message },
        { status }
      )
    }
    if (quiz.company_id !== admin.companyId) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    // 対象母集団＝該当 company の profiles（total_members の母数と一致）
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name, department')
      .eq('company_id', quiz.company_id)

    if (profilesError) {
      console.error('[Quiz Participants GET] profiles取得エラー:', profilesError.message)
      return NextResponse.json({ error: profilesError.message }, { status: 500 })
    }

    // 受験済みの profile_id 集合（★スコアは取得しない。受験有無のみ）
    const { data: attempts, error: attemptsError } = await supabase
      .from('brand_quiz_attempts')
      .select('profile_id')
      .eq('quiz_id', quizId)

    if (attemptsError) {
      console.error('[Quiz Participants GET] attempts取得エラー:', attemptsError.message)
      return NextResponse.json({ error: attemptsError.message }, { status: 500 })
    }

    const respondedSet = new Set((attempts ?? []).map((a) => a.profile_id))

    const responded: { profile_id: string; name: string | null; department: string | null }[] = []
    const not_responded: { profile_id: string; name: string | null; department: string | null }[] = []
    for (const p of profiles ?? []) {
      const row = { profile_id: p.id, name: p.name ?? null, department: p.department ?? null }
      if (respondedSet.has(p.id)) responded.push(row)
      else not_responded.push(row)
    }

    return NextResponse.json({ responded, not_responded })
  } catch (err) {
    console.error('[Quiz Participants GET] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
