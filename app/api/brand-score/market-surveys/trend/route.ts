// 市場浸透の年次推移
// GET /api/brand-score/market-surveys/trend?company_id=xxx
//
// スナップショット（brand_score_snapshots）には転記しない。
// あちらは「総合＝インナー×50%＋アウター×50%」の合成値で、日付は記録した日。
// 市場調査だけを過去日に差し込むと総合スコアの意味が壊れる。
// 調査ごとに実施日と段階スコアを持っているので、ここから直接組み立てる。
// 割り当てを直せば推移も自動で追随する（二重保存にしない）。
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  MARKET_STAGES,
  type MarketStage,
  type MarketStageStatus,
} from '@/lib/brand-score/market-stages'
import { computeMarketScore } from '@/lib/brand-score/market-stage-score'
import { guardCompanyFeature } from '@/lib/billing/guard'

export async function GET(request: NextRequest) {
  try {
    const companyId = request.nextUrl.searchParams.get('company_id')
    if (!companyId) {
      return NextResponse.json({ error: 'company_id は必須です' }, { status: 400 })
    }

    const denied = await guardCompanyFeature(companyId, 'brandScoreIntegrated')
    if (denied) return denied

    const supabase = getSupabaseAdmin()

    // スコアが出せない調査（3段階未満）は下の computeMarketScore が null を返すので
    // ここでは status で絞らない。手で「過年度」にしたものだけ外す
    const { data: surveys, error } = await supabase
      .from('market_surveys')
      .select('id, title, status, fielded_from, fielded_to, sample_size, imported_at')
      .eq('company_id', companyId)
      .neq('status', 'archived')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!surveys || surveys.length === 0) return NextResponse.json({ points: [] })

    const { data: scores } = await supabase
      .from('market_survey_stage_scores')
      .select('survey_id, stage, score, status')
      .in(
        'survey_id',
        surveys.map((s) => s.id as string)
      )

    const points = surveys
      .map((s) => {
        const own = (scores ?? []).filter((x) => x.survey_id === s.id)
        const stages = {} as Record<MarketStage, number | null>
        for (const stage of MARKET_STAGES) {
          const hit = own.find((x) => x.stage === stage)
          stages[stage] =
            hit && hit.status === 'scored' && hit.score !== null ? Number(hit.score) : null
        }

        return {
          survey_id: s.id as string,
          title: s.title as string,
          status: s.status as string,
          // 実施日を優先し、未入力なら取り込み日に落とす。
          // 「いつ測ったか」が推移の横軸なので、記録した日ではなく調査した日を使う
          date: (s.fielded_to ?? s.fielded_from ?? s.imported_at) as string,
          /** 実施日が入っていない（取り込み日で代用している）調査 */
          date_is_fallback: !s.fielded_to && !s.fielded_from,
          sample_size: s.sample_size as number | null,
          market_score: computeMarketScore(
            own.map((x) => ({
              status: x.status as MarketStageStatus,
              score: x.score === null ? null : Number(x.score),
            }))
          ),
          stages,
        }
      })
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({ points })
  } catch (err) {
    console.error('[MarketSurveyTrend] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
