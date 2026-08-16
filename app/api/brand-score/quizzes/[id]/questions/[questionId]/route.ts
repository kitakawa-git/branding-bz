// ブランド理解度テスト 設問の個別編集・削除API
// PATCH  /api/brand-score/quizzes/[id]/questions/[questionId]
// DELETE /api/brand-score/quizzes/[id]/questions/[questionId]
// ※ 既存 surveys/[id]/questions/[questionId]/route.ts に準拠。
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireResourceCompany } from '@/lib/billing/guard'
import { validateQuizQuestion } from '@/lib/brand-score/quiz-validation'

type RouteContext = { params: Promise<{ id: string; questionId: string }> }

// PATCH: 設問更新（correct_option_id × options の整合を再検証）
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id, questionId } = await context.params
    // URL のリソース ID から会社を引き、呼び出し元の所属を照合する
    // （generate-questions で確立した形。これが無いと他社の ID で中身が返る）
    const scope = await requireResourceCompany('brand_quizzes', id)
    if (scope.error) return scope.error
    const body = await request.json()

    if (!questionId) {
      return NextResponse.json({ error: 'questionId is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // 既存設問を取得（部分更新でも正誤整合を検証するため現在値が必要）
    const { data: current, error: fetchError } = await supabase
      .from('brand_quiz_questions')
      .select('*')
      .eq('id', questionId)
      .eq('quiz_id', id)
      .single()

    if (fetchError) {
      console.error('[Quiz Question PATCH] 取得エラー:', fetchError.message)
      const status = fetchError.code === 'PGRST116' ? 404 : 500
      return NextResponse.json({ error: fetchError.message }, { status })
    }

    // 更新対象キーが1つも無ければ弾く
    const editableKeys = [
      'category',
      'question_text',
      'question_type',
      'options',
      'correct_option_id',
      'explanation',
      'sort_order',
      'is_active',
      'reference_data',
    ]
    if (!editableKeys.some((k) => body[k] !== undefined)) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // 現在値とマージしてから検証（options だけ・correct だけの変更でも整合を担保）
    const merged = {
      category: body.category ?? current.category,
      question_text: body.question_text ?? current.question_text,
      question_type: body.question_type ?? current.question_type,
      options: body.options ?? current.options,
      correct_option_id: body.correct_option_id ?? current.correct_option_id,
    }
    const validated = validateQuizQuestion(merged, {
      allowedCategories: ['why', 'how', 'what'],
      enforceTypeShape: false,
    })
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 })
    }

    // 送信されたフィールドのみ更新（検証済みの正規化値を採用）
    const updateData: Record<string, unknown> = {}
    if (body.category !== undefined) updateData.category = validated.category
    if (body.question_text !== undefined) updateData.question_text = validated.question_text
    if (body.question_type !== undefined) updateData.question_type = validated.question_type
    if (body.options !== undefined) updateData.options = validated.options
    if (body.correct_option_id !== undefined) updateData.correct_option_id = validated.correct_option_id
    if (body.explanation !== undefined) updateData.explanation = body.explanation
    if (body.sort_order !== undefined) updateData.sort_order = body.sort_order
    if (body.is_active !== undefined) updateData.is_active = body.is_active
    if (body.reference_data !== undefined) updateData.reference_data = body.reference_data

    const { data: updated, error: updateError } = await supabase
      .from('brand_quiz_questions')
      .update(updateData)
      .eq('id', questionId)
      .eq('quiz_id', id)
      .select()
      .single()

    if (updateError) {
      console.error('[Quiz Question PATCH] UPDATE エラー:', updateError.message)
      const status = updateError.code === 'PGRST116' ? 404 : 500
      return NextResponse.json({ error: updateError.message }, { status })
    }

    return NextResponse.json({ question: updated })
  } catch (err) {
    console.error('[Quiz Question PATCH] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE: 設問削除（draft時のみ。既存サーベイと同様）
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id, questionId } = await context.params
    // URL のリソース ID から会社を引き、呼び出し元の所属を照合する
    // （generate-questions で確立した形。これが無いと他社の ID で中身が返る）
    const scope = await requireResourceCompany('brand_quizzes', id)
    if (scope.error) return scope.error

    if (!questionId) {
      return NextResponse.json({ error: 'questionId is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // クイズのステータス確認
    const { data: quiz, error: quizError } = await supabase
      .from('brand_quizzes')
      .select('status')
      .eq('id', id)
      .single()

    if (quizError) {
      console.error('[Quiz Question DELETE] クイズ取得エラー:', quizError.message)
      const status = quizError.code === 'PGRST116' ? 404 : 500
      return NextResponse.json({ error: quizError.message }, { status })
    }

    if (quiz.status !== 'draft') {
      return NextResponse.json(
        { error: '配信済みのテストの設問は削除できません' },
        { status: 400 }
      )
    }

    const { error: deleteError } = await supabase
      .from('brand_quiz_questions')
      .delete()
      .eq('id', questionId)
      .eq('quiz_id', id)

    if (deleteError) {
      console.error('[Quiz Question DELETE] DELETE エラー:', deleteError.message)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ deleted: true })
  } catch (err) {
    console.error('[Quiz Question DELETE] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
