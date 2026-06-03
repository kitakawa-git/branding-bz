// ブランド理解度テスト 詳細取得・更新・削除API
// GET    /api/brand-score/quizzes/[id]
// PATCH  /api/brand-score/quizzes/[id]
// DELETE /api/brand-score/quizzes/[id]
// ※ 既存 surveys/[id]/route.ts に準拠。total_members 算出も同一ロジック。
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

type RouteContext = { params: Promise<{ id: string }> }

// GET: クイズ詳細（設問一覧付き）
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    if (!id) {
      return NextResponse.json({ error: 'Quiz ID is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // クイズ取得
    const { data: quiz, error: quizError } = await supabase
      .from('brand_quizzes')
      .select('*')
      .eq('id', id)
      .single()

    if (quizError) {
      console.error('[Quiz GET] クエリエラー:', quizError.message)
      const status = quizError.code === 'PGRST116' ? 404 : 500
      return NextResponse.json({ error: quizError.message }, { status })
    }

    // 設問取得（sort_order ASC）
    const { data: questions, error: questionsError } = await supabase
      .from('brand_quiz_questions')
      .select('*')
      .eq('quiz_id', id)
      .order('sort_order', { ascending: true })

    if (questionsError) {
      console.error('[Quiz GET] questions クエリエラー:', questionsError.message)
      return NextResponse.json({ error: questionsError.message }, { status: 500 })
    }

    return NextResponse.json({ quiz, questions: questions ?? [] })
  } catch (err) {
    console.error('[Quiz GET] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PATCH: クイズ更新・ステータス遷移（draft → active → closed → archived）
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Quiz ID is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // 現在のクイズを取得（company_id / status が必要）
    const { data: currentQuiz, error: fetchError } = await supabase
      .from('brand_quizzes')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error('[Quiz PATCH] 取得エラー:', fetchError.message)
      const status = fetchError.code === 'PGRST116' ? 404 : 500
      return NextResponse.json({ error: fetchError.message }, { status })
    }

    // 更新フィールド組み立て
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.status !== undefined) updateData.status = body.status
    if (body.starts_at !== undefined) updateData.starts_at = body.starts_at
    if (body.ends_at !== undefined) updateData.ends_at = body.ends_at
    if (body.pass_threshold !== undefined) updateData.pass_threshold = body.pass_threshold
    if (body.randomize_questions !== undefined) updateData.randomize_questions = body.randomize_questions

    // status → 'active' への変更時の処理
    if (body.status === 'active' && currentQuiz.status !== 'active') {
      // 有効な設問が0件なら active 化を弾く
      const { count: activeQuestionCount, error: qCountError } = await supabase
        .from('brand_quiz_questions')
        .select('id', { count: 'exact', head: true })
        .eq('quiz_id', id)
        .eq('is_active', true)

      if (qCountError) {
        console.error('[Quiz PATCH] 設問数カウントエラー:', qCountError.message)
        return NextResponse.json({ error: qCountError.message }, { status: 500 })
      }

      if ((activeQuestionCount ?? 0) === 0) {
        return NextResponse.json(
          { error: '有効な設問が0件のため公開できません。設問を追加してください。' },
          { status: 400 }
        )
      }

      // starts_at 自動セット（未指定かつ未設定のとき）
      if (!body.starts_at && !currentQuiz.starts_at) {
        updateData.starts_at = new Date().toISOString()
      }

      // total_members スナップショット（既存サーベイ配信時と同一: 該当companyのprofiles件数）
      const { count: memberCount, error: memberError } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', currentQuiz.company_id)

      if (memberError) {
        console.error('[Quiz PATCH] profiles count エラー:', memberError.message)
        return NextResponse.json({ error: memberError.message }, { status: 500 })
      }
      updateData.total_members = memberCount ?? 0
    }

    // status → 'closed' への変更時の処理
    if (body.status === 'closed' && currentQuiz.status !== 'closed') {
      if (!body.ends_at && !currentQuiz.ends_at) {
        updateData.ends_at = new Date().toISOString()
      }
    }

    // クイズ更新
    const { data: updated, error: updateError } = await supabase
      .from('brand_quizzes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('[Quiz PATCH] UPDATE エラー:', updateError.message)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ quiz: updated })
  } catch (err) {
    console.error('[Quiz PATCH] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE: クイズ削除（draftのみ。既存サーベイと同様の安全弁）
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    if (!id) {
      return NextResponse.json({ error: 'Quiz ID is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { data: quiz, error: fetchError } = await supabase
      .from('brand_quizzes')
      .select('id, status')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error('[Quiz DELETE] 取得エラー:', fetchError.message)
      const status = fetchError.code === 'PGRST116' ? 404 : 500
      return NextResponse.json({ error: fetchError.message }, { status })
    }

    if (quiz.status !== 'draft') {
      return NextResponse.json(
        { error: '配信済みのテストは削除できません' },
        { status: 400 }
      )
    }

    // 削除（brand_quiz_questions / attempts / answers は ON DELETE CASCADE）
    const { error: deleteError } = await supabase
      .from('brand_quizzes')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[Quiz DELETE] DELETE エラー:', deleteError.message)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ deleted: true })
  } catch (err) {
    console.error('[Quiz DELETE] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
