// 設問一覧取得・追加API
// GET  /api/brand-score/surveys/[id]/questions
// POST /api/brand-score/surveys/[id]/questions
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireResourceCompany } from '@/lib/billing/guard'

type RouteContext = { params: Promise<{ id: string }> }

// テンプレート設問30問
const TEMPLATE_QUESTIONS: { category: string; question_text: string; sort_order: number }[] = [
  // WHY（理念浸透）1-10
  { category: 'why', sort_order: 1, question_text: '会社のミッションを自分の言葉で説明できる' },
  { category: 'why', sort_order: 2, question_text: '会社のビジョンに共感している' },
  { category: 'why', sort_order: 3, question_text: '自分の仕事がミッション実現につながっていると感じる' },
  { category: 'why', sort_order: 4, question_text: 'バリュー（行動指針）を日常業務で意識している' },
  { category: 'why', sort_order: 5, question_text: '会社の理念は現場の実態と一致していると感じる' },
  { category: 'why', sort_order: 6, question_text: '新しく入社したメンバーに理念を伝えられる' },
  { category: 'why', sort_order: 7, question_text: '理念に基づいた経営判断がなされていると感じる' },
  { category: 'why', sort_order: 8, question_text: '会社の理念に誇りを持っている' },
  { category: 'why', sort_order: 9, question_text: '理念を学べる機会が十分にある' },
  { category: 'why', sort_order: 10, question_text: '5年後もこの会社の理念のもとで働きたい' },
  // HOW（方針共感）11-20
  { category: 'how', sort_order: 11, question_text: '会社が大切にしているブランドの個性（パーソナリティ）を理解している' },
  { category: 'how', sort_order: 12, question_text: '顧客に伝えるべきブランドの強みを説明できる' },
  { category: 'how', sort_order: 13, question_text: '会社のターゲット顧客像を明確に理解している' },
  { category: 'how', sort_order: 14, question_text: '対外的なコミュニケーション（言葉・トーン）の基準が明確だ' },
  { category: 'how', sort_order: 15, question_text: 'ブランドビジュアル（ロゴ・カラー等）の使用ルールを知っている' },
  { category: 'how', sort_order: 16, question_text: '会社のブランド戦略の方向性に納得している' },
  { category: 'how', sort_order: 17, question_text: '会社のブランドは競合他社と明確に差別化されていると感じる' },
  { category: 'how', sort_order: 18, question_text: '経営層からブランド方針に関する情報が適切に共有されている' },
  { category: 'how', sort_order: 19, question_text: 'ブランド方針が現場の業務に落とし込まれている' },
  { category: 'how', sort_order: 20, question_text: '会社のブランドは社会に対して価値ある存在だと感じる' },
  // WHAT（行動体現）21-30
  { category: 'what', sort_order: 21, question_text: '顧客との接点でブランドの価値観を意識して行動している' },
  { category: 'what', sort_order: 22, question_text: '社外でも会社のブランドを誇りを持って伝えられる' },
  { category: 'what', sort_order: 23, question_text: 'SNSや日常会話で会社のことをポジティブに紹介できる' },
  { category: 'what', sort_order: 24, question_text: '名刺交換・自己紹介の際にブランドの強みを自然に伝えられる' },
  { category: 'what', sort_order: 25, question_text: 'ブランドに沿わない行動をした際に違和感を覚える' },
  { category: 'what', sort_order: 26, question_text: 'チームメンバーがブランドに沿った行動をしていると感じる' },
  { category: 'what', sort_order: 27, question_text: '業務改善の際にブランドの観点を取り入れている' },
  { category: 'what', sort_order: 28, question_text: '会社のブランドは採用活動にも良い影響を与えていると感じる' },
  { category: 'what', sort_order: 29, question_text: 'ブランドの体現が評価・称賛される文化がある' },
  { category: 'what', sort_order: 30, question_text: '1年前と比べてブランドが社内に浸透してきたと感じる' },
]

// GET: 設問一覧
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    // URL のリソース ID から会社を引き、呼び出し元の所属を照合する
    // （generate-questions で確立した形。これが無いと他社の ID で中身が返る）
    const scope = await requireResourceCompany('brand_surveys', id)
    if (scope.error) return scope.error

    const supabase = getSupabaseAdmin()

    const { data: questions, error } = await supabase
      .from('brand_survey_questions')
      .select('*')
      .eq('survey_id', id)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('[Questions GET] クエリエラー:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ questions: questions ?? [] })
  } catch (err) {
    console.error('[Questions GET] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST: 設問追加（action で分岐）
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    // URL のリソース ID から会社を引き、呼び出し元の所属を照合する
    // （generate-questions で確立した形。これが無いと他社の ID で中身が返る）
    const scope = await requireResourceCompany('brand_surveys', id)
    if (scope.error) return scope.error
    const body = await request.json()
    const { action } = body

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // ── insert_templates ──
    if (action === 'insert_templates') {
      // 既にtemplate設問が存在するかチェック
      const { count, error: countError } = await supabase
        .from('brand_survey_questions')
        .select('id', { count: 'exact', head: true })
        .eq('survey_id', id)
        .eq('source', 'template')

      if (countError) {
        console.error('[Questions POST] template count エラー:', countError.message)
        return NextResponse.json({ error: countError.message }, { status: 500 })
      }

      if ((count ?? 0) > 0) {
        return NextResponse.json({
          message: 'Template questions already exist',
          skipped: true,
        })
      }

      const rows = TEMPLATE_QUESTIONS.map(q => ({
        survey_id: id,
        category: q.category,
        question_text: q.question_text,
        source: 'template',
        sort_order: q.sort_order,
        is_active: true,
        reference_data: {},
      }))

      const { data: inserted, error: insertError } = await supabase
        .from('brand_survey_questions')
        .insert(rows)
        .select()

      if (insertError) {
        console.error('[Questions POST] template INSERT エラー:', insertError.message)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      return NextResponse.json({ questions: inserted, count: inserted?.length ?? 0 }, { status: 201 })
    }

    // ── add_custom ──
    if (action === 'add_custom') {
      const { category, question_text } = body

      if (!category || !question_text) {
        return NextResponse.json({ error: 'category and question_text are required' }, { status: 400 })
      }

      // 既存の最大sort_orderを取得
      const maxSortOrder = await getMaxSortOrder(supabase, id)

      const { data: inserted, error: insertError } = await supabase
        .from('brand_survey_questions')
        .insert({
          survey_id: id,
          category,
          question_text,
          source: 'custom',
          sort_order: maxSortOrder + 1,
          is_active: true,
          reference_data: {},
        })
        .select()
        .single()

      if (insertError) {
        console.error('[Questions POST] custom INSERT エラー:', insertError.message)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      return NextResponse.json({ question: inserted }, { status: 201 })
    }

    // ── add_ai_generated ──
    if (action === 'add_ai_generated') {
      const { questions } = body

      if (!Array.isArray(questions) || questions.length === 0) {
        return NextResponse.json({ error: 'questions array is required' }, { status: 400 })
      }

      const maxSortOrder = await getMaxSortOrder(supabase, id)

      const rows = questions.map((q: { category: string; question_text: string; reference_data?: Record<string, unknown> }, i: number) => ({
        survey_id: id,
        category: q.category,
        question_text: q.question_text,
        source: 'ai_generated',
        sort_order: maxSortOrder + 1 + i,
        is_active: true,
        reference_data: q.reference_data ?? {},
      }))

      const { data: inserted, error: insertError } = await supabase
        .from('brand_survey_questions')
        .insert(rows)
        .select()

      if (insertError) {
        console.error('[Questions POST] ai_generated INSERT エラー:', insertError.message)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      return NextResponse.json({ questions: inserted, count: inserted?.length ?? 0 }, { status: 201 })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err) {
    console.error('[Questions POST] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// 既存の最大sort_orderを取得するヘルパー
async function getMaxSortOrder(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  surveyId: string
): Promise<number> {
  const { data } = await supabase
    .from('brand_survey_questions')
    .select('sort_order')
    .eq('survey_id', surveyId)
    .order('sort_order', { ascending: false })
    .limit(1)

  return data && data.length > 0 ? (data[0].sort_order as number) : 0
}
