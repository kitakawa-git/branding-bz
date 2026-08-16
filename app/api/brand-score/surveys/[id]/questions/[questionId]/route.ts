// 設問個別更新・削除API
// PATCH  /api/brand-score/surveys/[id]/questions/[questionId]
// DELETE /api/brand-score/surveys/[id]/questions/[questionId]
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireResourceCompany } from '@/lib/billing/guard'

type RouteContext = { params: Promise<{ id: string; questionId: string }> }

// PATCH: 設問更新
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id, questionId } = await context.params
    // URL のリソース ID から会社を引き、呼び出し元の所属を照合する
    // （generate-questions で確立した形。これが無いと他社の ID で中身が返る）
    const scope = await requireResourceCompany('brand_surveys', id)
    if (scope.error) return scope.error
    const body = await request.json()

    if (!questionId) {
      return NextResponse.json({ error: 'questionId is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // 更新フィールド組み立て（指定フィールドのみ）
    const updateData: Record<string, unknown> = {}

    if (body.question_text !== undefined) updateData.question_text = body.question_text
    if (body.is_active !== undefined) updateData.is_active = body.is_active
    if (body.sort_order !== undefined) updateData.sort_order = body.sort_order
    if (body.category !== undefined) {
      const validCategories = ['why', 'how', 'what']
      if (!validCategories.includes(body.category)) {
        return NextResponse.json({ error: 'category must be why, how, or what' }, { status: 400 })
      }
      updateData.category = body.category
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data: updated, error: updateError } = await supabase
      .from('brand_survey_questions')
      .update(updateData)
      .eq('id', questionId)
      .eq('survey_id', id)
      .select()
      .single()

    if (updateError) {
      console.error('[Question PATCH] UPDATE エラー:', updateError.message)
      const status = updateError.code === 'PGRST116' ? 404 : 500
      return NextResponse.json({ error: updateError.message }, { status })
    }

    return NextResponse.json({ question: updated })
  } catch (err) {
    console.error('[Question PATCH] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE: 設問削除（draft時のみ）
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id, questionId } = await context.params
    // URL のリソース ID から会社を引き、呼び出し元の所属を照合する
    // （generate-questions で確立した形。これが無いと他社の ID で中身が返る）
    const scope = await requireResourceCompany('brand_surveys', id)
    if (scope.error) return scope.error

    if (!questionId) {
      return NextResponse.json({ error: 'questionId is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // サーベイのステータス確認
    const { data: survey, error: surveyError } = await supabase
      .from('brand_surveys')
      .select('status')
      .eq('id', id)
      .single()

    if (surveyError) {
      console.error('[Question DELETE] サーベイ取得エラー:', surveyError.message)
      const status = surveyError.code === 'PGRST116' ? 404 : 500
      return NextResponse.json({ error: surveyError.message }, { status })
    }

    if (survey.status !== 'draft') {
      return NextResponse.json(
        { error: '配信済みのサーベイの設問は削除できません' },
        { status: 400 }
      )
    }

    const { error: deleteError } = await supabase
      .from('brand_survey_questions')
      .delete()
      .eq('id', questionId)
      .eq('survey_id', id)

    if (deleteError) {
      console.error('[Question DELETE] DELETE エラー:', deleteError.message)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ deleted: true })
  } catch (err) {
    console.error('[Question DELETE] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
