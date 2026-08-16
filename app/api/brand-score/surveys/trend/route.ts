// インナースコアの推移（サーベイ単位）
// GET /api/brand-score/surveys/trend?company_id=xxx
//
// 市場調査の trend と同じ考え方。スナップショット（brand_score_snapshots）には
// 転記しない。あちらは「総合＝インナー×50%＋アウター×50%」の合成値で日付は
// 記録した日なので、インナーだけを実施日に差し込むと総合の意味が壊れる。
// サーベイの回答から直接組み立てるので、設問を直せば推移も追随する。
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { fetchAllRows } from '@/lib/brand-score/fetch-all-rows'
import { computeSurveyScores } from '@/lib/brand-score/calculate-snapshot'
import { guardCompanyFeature } from '@/lib/billing/guard'

export async function GET(request: NextRequest) {
  try {
    const companyId = request.nextUrl.searchParams.get('company_id')
    if (!companyId) {
      return NextResponse.json({ error: 'company_id は必須です' }, { status: 400 })
    }

    const denied = await guardCompanyFeature(companyId, 'brandScoreInner')
    if (denied) return denied

    const supabase = getSupabaseAdmin()

    // 下書きは配信していないので載せない
    const { data: surveys, error } = await supabase
      .from('brand_surveys')
      .select('id, title, status, starts_at, ends_at, created_at')
      .eq('company_id', companyId)
      .in('status', ['closed', 'active', 'archived'])

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!surveys || surveys.length === 0) return NextResponse.json({ points: [] })

    const points = []
    for (const s of surveys) {
      const surveyId = s.id as string

      // 回答は1サーベイで1000行を超える（実例 392人×32問=12,544）。
      // PostgREST の既定上限で黙って切られるためページングで全件取る
      const { data: responses } = await fetchAllRows<{
        question_id: string
        score: number
      }>(() =>
        supabase
          .from('brand_survey_responses')
          .select('question_id, score')
          .eq('survey_id', surveyId)
          .order('id')
      )

      if (!responses || responses.length === 0) continue

      const { data: questions } = await supabase
        .from('brand_survey_questions')
        .select('id, sort_order, reference_data')
        .eq('survey_id', surveyId)
        .eq('is_active', true)

      if (!questions || questions.length === 0) continue

      const { score, stages } = computeSurveyScores(
        responses,
        questions.map((q) => ({
          id: q.id as string,
          sort_order: q.sort_order as number,
          reference_data: q.reference_data as Record<string, unknown> | null,
        }))
      )
      if (score === null) continue

      points.push({
        survey_id: surveyId,
        title: s.title as string,
        status: s.status as string,
        // 「いつ測ったか」が横軸。終了日 → 開始日 → 作成日 の順に落とす
        date: (s.ends_at ?? s.starts_at ?? s.created_at) as string,
        /** 終了日も開始日も無く、作成日で代用している */
        date_is_fallback: !s.ends_at && !s.starts_at,
        inner_score: score,
        stages,
      })
    }

    points.sort((a, b) => a.date.localeCompare(b.date))
    return NextResponse.json({ points })
  } catch (err) {
    console.error('[SurveyTrend] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
