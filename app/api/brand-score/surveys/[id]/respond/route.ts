// 匿名回答送信API
// POST /api/brand-score/surveys/[id]/respond
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

type RouteContext = { params: Promise<{ id: string }> }

type AnswerItem = {
  questionId: string
  score: number
}

type RequestBody = {
  answers: AnswerItem[]
  department: string
  roleCategory: 'executive' | 'manager' | 'staff'
  profileId: string
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: surveyId } = await context.params
    const body: RequestBody = await request.json()
    const { answers, department, roleCategory, profileId } = body

    // バリデーション: 必須フィールド
    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json({ error: 'answers array is required' }, { status: 400 })
    }
    if (!department || typeof department !== 'string') {
      return NextResponse.json({ error: 'department is required' }, { status: 400 })
    }
    const validRoles = ['executive', 'manager', 'staff']
    if (!roleCategory || !validRoles.includes(roleCategory)) {
      return NextResponse.json({ error: 'roleCategory must be executive, manager, or staff' }, { status: 400 })
    }
    if (!profileId || typeof profileId !== 'string') {
      return NextResponse.json({ error: 'profileId is required' }, { status: 400 })
    }

    // バリデーション: score が 1-5 の範囲
    for (const a of answers) {
      if (!a.questionId || typeof a.questionId !== 'string') {
        return NextResponse.json({ error: 'Each answer must have a valid questionId' }, { status: 400 })
      }
      if (typeof a.score !== 'number' || a.score < 1 || a.score > 5 || !Number.isInteger(a.score)) {
        return NextResponse.json({ error: 'score must be an integer between 1 and 5' }, { status: 400 })
      }
    }

    const supabase = getSupabaseAdmin()

    // 1. サーベイ取得・ステータス確認・期限切れチェック
    //    service_role 化により RLS バイパスのため、認可は本ルート内で完結する
    const { data: survey, error: surveyError } = await supabase
      .from('brand_surveys')
      .select('id, status, ends_at')
      .eq('id', surveyId)
      .single()

    if (surveyError) {
      console.error('[Respond POST] サーベイ取得エラー:', surveyError.message)
      const status = surveyError.code === 'PGRST116' ? 404 : 500
      return NextResponse.json(
        { error: status === 404 ? 'サーベイが見つかりません' : surveyError.message },
        { status }
      )
    }

    if (survey.status !== 'active') {
      return NextResponse.json(
        { error: 'このサーベイは現在回答を受け付けていません' },
        { status: 400 }
      )
    }

    // ends_at が過去ならば期限切れとして拒否
    if (survey.ends_at && new Date(survey.ends_at).getTime() < Date.now()) {
      return NextResponse.json(
        { error: 'このサーベイの回答期限を過ぎています' },
        { status: 400 }
      )
    }

    // 2. survey_participants で回答済みチェック
    const { data: participant, error: participantError } = await supabase
      .from('survey_participants')
      .select('id, responded_at')
      .eq('survey_id', surveyId)
      .eq('profile_id', profileId)
      .single()

    if (participantError) {
      console.error('[Respond POST] 参加者取得エラー:', participantError.message)
      const status = participantError.code === 'PGRST116' ? 404 : 500
      return NextResponse.json(
        { error: status === 404 ? '回答対象者として登録されていません' : participantError.message },
        { status }
      )
    }

    if (participant.responded_at) {
      return NextResponse.json(
        { error: 'すでに回答済みです' },
        { status: 400 }
      )
    }

    // 3. 全questionIdがこのサーベイに属するか確認
    const questionIds = answers.map(a => a.questionId)
    const { data: validQuestions, error: qError } = await supabase
      .from('brand_survey_questions')
      .select('id')
      .eq('survey_id', surveyId)
      .in('id', questionIds)

    if (qError) {
      console.error('[Respond POST] 設問取得エラー:', qError.message)
      return NextResponse.json({ error: qError.message }, { status: 500 })
    }

    const validIds = new Set((validQuestions || []).map(q => q.id))
    const invalidIds = questionIds.filter(id => !validIds.has(id))
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `無効な設問IDが含まれています: ${invalidIds.join(', ')}` },
        { status: 400 }
      )
    }

    // 4. brand_survey_responses に一括INSERT（profile_idは含めない）
    const now = new Date().toISOString()
    const rows = answers.map(a => ({
      survey_id: surveyId,
      question_id: a.questionId,
      score: a.score,
      department,
      role_category: roleCategory,
      submitted_at: now,
    }))

    const { error: insertError } = await supabase
      .from('brand_survey_responses')
      .insert(rows)

    if (insertError) {
      console.error('[Respond POST] 回答INSERT エラー:', insertError.message)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // 5. survey_participants の responded_at を更新
    const { error: updateError } = await supabase
      .from('survey_participants')
      .update({ responded_at: now })
      .eq('id', participant.id)

    if (updateError) {
      console.error('[Respond POST] 参加者更新エラー:', updateError.message)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Respond POST] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
