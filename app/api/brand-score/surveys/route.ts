// サーベイ一覧取得・新規作成API
// GET  /api/brand-score/surveys?company_id=xxx
// POST /api/brand-score/surveys
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { guardCompanyFeature } from '@/lib/billing/guard'

// GET: サーベイ一覧（回答率付き）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')

    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 })
    }

    const denied = await guardCompanyFeature(companyId, 'innerSurvey')
    if (denied) return denied

    const supabase = getSupabaseAdmin()

    // サーベイ一覧取得
    const { data: surveys, error: surveysError } = await supabase
      .from('brand_surveys')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (surveysError) {
      console.error('[Surveys GET] クエリエラー:', surveysError.message)
      return NextResponse.json({ error: surveysError.message }, { status: 500 })
    }

    if (!surveys || surveys.length === 0) {
      return NextResponse.json({ surveys: [] })
    }

    // 各サーベイの回答率を計算
    const surveyIds = surveys.map(s => s.id)
    const { data: participants, error: partError } = await supabase
      .from('survey_participants')
      .select('survey_id, responded_at')
      .in('survey_id', surveyIds)

    if (partError) {
      console.error('[Surveys GET] participants クエリエラー:', partError.message)
      return NextResponse.json({ error: partError.message }, { status: 500 })
    }

    // survey_id ごとに回答済みカウント
    const respondedCountMap = new Map<string, number>()
    for (const p of participants ?? []) {
      if (p.responded_at) {
        respondedCountMap.set(p.survey_id, (respondedCountMap.get(p.survey_id) || 0) + 1)
      }
    }

    // 外部調査の取り込み（source='imported'）は survey_participants を持たないため、
    // 取り込み時に記録した respondent_count を分子として使う。
    const surveysWithRate = surveys.map(s => {
      const respondedCount = s.respondent_count ?? (respondedCountMap.get(s.id) || 0)
      return {
        ...s,
        response_rate: s.total_members > 0
          ? Math.round(respondedCount / s.total_members * 100)
          : 0,
        responded_count: respondedCount,
      }
    })

    return NextResponse.json({ surveys: surveysWithRate })
  } catch (err) {
    console.error('[Surveys GET] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST: サーベイ新規作成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, title, createdBy } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const denied = await guardCompanyFeature(companyId, 'innerSurvey')
    if (denied) return denied

    const supabase = getSupabaseAdmin()

    // タイトル自動生成: 既存タイトルから最大回数を抽出して +1
    let surveyTitle = title
    if (!surveyTitle) {
      const { data: existing, error: fetchError } = await supabase
        .from('brand_surveys')
        .select('title')
        .eq('company_id', companyId)

      if (fetchError) {
        console.error('[Surveys POST] タイトル取得エラー:', fetchError.message)
        return NextResponse.json({ error: fetchError.message }, { status: 500 })
      }

      let maxNth = 0
      const pattern = /第(\d+)回/
      for (const s of existing ?? []) {
        const match = s.title?.match(pattern)
        if (match) {
          const n = parseInt(match[1], 10)
          if (n > maxNth) maxNth = n
        }
      }

      const nth = maxNth + 1
      surveyTitle = `第${nth}回 ブランド浸透度調査`
    }

    // total_members: 社員数スナップショット
    const { count: memberCount, error: memberError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)

    if (memberError) {
      console.error('[Surveys POST] profiles count エラー:', memberError.message)
      return NextResponse.json({ error: memberError.message }, { status: 500 })
    }

    // サーベイ作成
    const { data: survey, error: insertError } = await supabase
      .from('brand_surveys')
      .insert({
        company_id: companyId,
        title: surveyTitle,
        status: 'draft',
        total_members: memberCount ?? 0,
        created_by: createdBy || null,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[Surveys POST] INSERT エラー:', insertError.message)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ survey }, { status: 201 })
  } catch (err) {
    console.error('[Surveys POST] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
