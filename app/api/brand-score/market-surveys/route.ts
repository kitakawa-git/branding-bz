// 市場調査の一覧
// GET /api/brand-score/market-surveys?company_id=xxx
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { MARKET_STAGES } from '@/lib/brand-score/market-stages'
import {guardCompanyFeature, requireCompanyMember } from '@/lib/billing/guard'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')

    if (!companyId) {
      return NextResponse.json({ error: 'company_id は必須です' }, { status: 400 })
    }

    // 呼び出し元がこの会社の人かを確かめる。company_id をクライアントから受けるので、
    // これが無いと他社の ID を渡すだけで中身が返る（プラン判定は所属の確認にならない）
    const forbidden = await requireCompanyMember(companyId)
    if (forbidden) return forbidden

    const denied = await guardCompanyFeature(companyId, 'brandScoreIntegrated')
    if (denied) return denied

    const supabase = getSupabaseAdmin()

    const { data: surveys, error } = await supabase
      .from('market_surveys')
      .select(
        'id, title, research_firm, fielded_from, fielded_to, sample_size, status, source_file_name, imported_at, created_at'
      )
      .eq('company_id', companyId)
      .order('fielded_to', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[MarketSurveys GET] エラー:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const ids = (surveys ?? []).map((s) => s.id as string)
    if (ids.length === 0) return NextResponse.json({ surveys: [] })

    // 設問数と、5段階のうち割り当て済みの数を添える
    const [{ data: blocks }, { data: scores }] = await Promise.all([
      supabase.from('market_survey_blocks').select('survey_id').in('survey_id', ids),
      supabase
        .from('market_survey_stage_scores')
        .select('survey_id, stage, status')
        .in('survey_id', ids),
    ])

    const blockCount = new Map<string, number>()
    for (const b of blocks ?? []) {
      const k = b.survey_id as string
      blockCount.set(k, (blockCount.get(k) ?? 0) + 1)
    }

    const resolved = new Map<string, number>()
    for (const s of scores ?? []) {
      if (s.status === 'unmapped') continue
      const k = s.survey_id as string
      resolved.set(k, (resolved.get(k) ?? 0) + 1)
    }

    return NextResponse.json({
      surveys: (surveys ?? []).map((s) => ({
        ...s,
        block_count: blockCount.get(s.id as string) ?? 0,
        resolved_stage_count: resolved.get(s.id as string) ?? 0,
        total_stage_count: MARKET_STAGES.length,
      })),
    })
  } catch (err) {
    console.error('[MarketSurveys GET] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
