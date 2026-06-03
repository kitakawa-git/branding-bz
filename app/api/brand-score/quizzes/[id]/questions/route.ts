// ブランド理解度テスト 設問一覧取得・手動追加API
// GET  /api/brand-score/quizzes/[id]/questions
// POST /api/brand-score/quizzes/[id]/questions   （手動追加 source='custom'）
// ※ クイズはテンプレート設問を持たない（汎用テンプレは固定正解を作れないため）。
//   設問は AI生成（generate-questions）と手動custom の2系統のみ。
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { validateQuizQuestion } from '@/lib/brand-score/quiz-validation'

type RouteContext = { params: Promise<{ id: string }> }

// GET: 設問一覧（sort_order ASC）
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    const supabase = getSupabaseAdmin()

    const { data: questions, error } = await supabase
      .from('brand_quiz_questions')
      .select('*')
      .eq('quiz_id', id)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('[Quiz Questions GET] クエリエラー:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ questions: questions ?? [] })
  } catch (err) {
    console.error('[Quiz Questions GET] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST: 設問1件を手動追加（source='custom'）
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json()

    const supabase = getSupabaseAdmin()

    // サーバ側検証（correct_option_id が options[].id に存在するか 等）
    const validated = validateQuizQuestion(body, {
      allowedCategories: ['why', 'how', 'what'],
      enforceTypeShape: false,
    })
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 })
    }

    // sort_order: 明示指定が無ければ末尾に追加
    const sortOrder =
      typeof body.sort_order === 'number'
        ? body.sort_order
        : (await getMaxSortOrder(supabase, id)) + 1

    const { data: inserted, error: insertError } = await supabase
      .from('brand_quiz_questions')
      .insert({
        quiz_id: id,
        category: validated.category,
        question_text: validated.question_text,
        question_type: validated.question_type,
        options: validated.options,
        correct_option_id: validated.correct_option_id,
        explanation: body.explanation ?? null,
        source: 'custom',
        sort_order: sortOrder,
        is_active: true,
        reference_data: body.reference_data ?? null,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[Quiz Questions POST] INSERT エラー:', insertError.message)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ question: inserted }, { status: 201 })
  } catch (err) {
    console.error('[Quiz Questions POST] 予期しないエラー:', err)
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
  quizId: string
): Promise<number> {
  const { data } = await supabase
    .from('brand_quiz_questions')
    .select('sort_order')
    .eq('quiz_id', quizId)
    .order('sort_order', { ascending: false })
    .limit(1)

  return data && data.length > 0 ? (data[0].sort_order as number) : 0
}
