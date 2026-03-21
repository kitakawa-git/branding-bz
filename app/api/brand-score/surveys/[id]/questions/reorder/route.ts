// 設問並び順一括更新API
// PATCH /api/brand-score/surveys/[id]/questions/reorder
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return null
  return createClient(supabaseUrl, supabaseAnonKey)
}

type RouteContext = { params: Promise<{ id: string }> }

// PATCH: sort_order一括更新
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const { orders } = body as { orders: { id: string; sort_order: number }[] }

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json({ error: 'orders array is required' }, { status: 400 })
    }

    const supabase = getSupabase()
    if (!supabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // サーベイのステータス確認
    const { data: survey, error: surveyError } = await supabase
      .from('brand_surveys')
      .select('status')
      .eq('id', id)
      .single()

    if (surveyError) {
      console.error('[Reorder PATCH] サーベイ取得エラー:', surveyError.message)
      const status = surveyError.code === 'PGRST116' ? 404 : 500
      return NextResponse.json({ error: surveyError.message }, { status })
    }

    if (survey.status !== 'draft') {
      return NextResponse.json(
        { error: '配信済みのサーベイの設問は並び替えできません' },
        { status: 400 }
      )
    }

    // 各設問のsort_orderを個別に更新
    for (const item of orders) {
      const { error: updateError } = await supabase
        .from('brand_survey_questions')
        .update({ sort_order: item.sort_order })
        .eq('id', item.id)
        .eq('survey_id', id)

      if (updateError) {
        console.error('[Reorder PATCH] UPDATE エラー:', updateError.message)
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ updated: orders.length })
  } catch (err) {
    console.error('[Reorder PATCH] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
