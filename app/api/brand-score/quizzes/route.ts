// ブランド理解度テスト 一覧取得・新規作成API
// GET  /api/brand-score/quizzes?companyId=xxx
// POST /api/brand-score/quizzes
// ※ すべて service_role（getSupabaseAdmin）経由。既存 surveys/route.ts に準拠。
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {guardCompanyFeature, requireCompanyMember } from '@/lib/billing/guard'

// GET: クイズ一覧（設問数・受験数付き）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    // 指示書は companyId クエリ。既存 surveys が company_id だったため両対応。
    const companyId = searchParams.get('companyId') || searchParams.get('company_id')

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    // 呼び出し元がこの会社の人かを確かめる。company_id をクライアントから受けるので、
    // これが無いと他社の ID を渡すだけで中身が返る（プラン判定は所属の確認にならない）
    const forbidden = await requireCompanyMember(companyId)
    if (forbidden) return forbidden

    const denied = await guardCompanyFeature(companyId, 'brandQuiz')
    if (denied) return denied

    const supabase = getSupabaseAdmin()

    // クイズ一覧取得（created_at desc）
    const { data: quizzes, error: quizzesError } = await supabase
      .from('brand_quizzes')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (quizzesError) {
      console.error('[Quizzes GET] クエリエラー:', quizzesError.message)
      return NextResponse.json({ error: quizzesError.message }, { status: 500 })
    }

    if (!quizzes || quizzes.length === 0) {
      return NextResponse.json({ quizzes: [] })
    }

    const quizIds = quizzes.map((q) => q.id)

    // 設問数（quiz_id ごと）
    const { data: questions, error: questionsError } = await supabase
      .from('brand_quiz_questions')
      .select('quiz_id')
      .in('quiz_id', quizIds)

    if (questionsError) {
      console.error('[Quizzes GET] questions クエリエラー:', questionsError.message)
      return NextResponse.json({ error: questionsError.message }, { status: 500 })
    }

    // 受験数（attempt行数。quiz_id ごと）
    const { data: attempts, error: attemptsError } = await supabase
      .from('brand_quiz_attempts')
      .select('quiz_id')
      .in('quiz_id', quizIds)

    if (attemptsError) {
      console.error('[Quizzes GET] attempts クエリエラー:', attemptsError.message)
      return NextResponse.json({ error: attemptsError.message }, { status: 500 })
    }

    const questionCountMap = new Map<string, number>()
    for (const q of questions ?? []) {
      questionCountMap.set(q.quiz_id, (questionCountMap.get(q.quiz_id) || 0) + 1)
    }
    const attemptCountMap = new Map<string, number>()
    for (const a of attempts ?? []) {
      attemptCountMap.set(a.quiz_id, (attemptCountMap.get(a.quiz_id) || 0) + 1)
    }

    const quizzesWithCounts = quizzes.map((q) => ({
      ...q,
      question_count: questionCountMap.get(q.id) || 0,
      attempt_count: attemptCountMap.get(q.id) || 0,
    }))

    return NextResponse.json({ quizzes: quizzesWithCounts })
  } catch (err) {
    console.error('[Quizzes GET] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST: クイズ新規作成（status=draft）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // 指示書は company_id（body）。念のため camelCase も許容。
    const companyId = body.company_id || body.companyId
    const { title } = body

    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 })
    }
    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    // 呼び出し元がこの会社の人かを確かめる。company_id をクライアントから受けるので、
    // これが無いと他社の ID を渡すだけで中身が返る（プラン判定は所属の確認にならない）
    const forbidden = await requireCompanyMember(companyId)
    if (forbidden) return forbidden

    const denied = await guardCompanyFeature(companyId, 'brandQuiz')
    if (denied) return denied

    const supabase = getSupabaseAdmin()

    const { data: quiz, error: insertError } = await supabase
      .from('brand_quizzes')
      .insert({
        company_id: companyId,
        title,
        description: body.description ?? null,
        status: 'draft',
        pass_threshold: body.pass_threshold ?? 80,
        randomize_questions: body.randomize_questions ?? true,
        created_by: body.created_by ?? null,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[Quizzes POST] INSERT エラー:', insertError.message)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ quiz }, { status: 201 })
  } catch (err) {
    console.error('[Quizzes POST] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
