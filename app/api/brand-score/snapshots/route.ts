// スナップショット API
// GET  /api/brand-score/snapshots?company_id=xxx → スナップショット一覧（時系列グラフ用）
// POST /api/brand-score/snapshots → スコア集計して INSERT
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { calculateSnapshot, snapshotToRow } from '@/lib/brand-score/calculate-snapshot'

// GET: スナップショット一覧を返す（snapshot_date昇順）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')

    if (!companyId) {
      return NextResponse.json({ error: 'company_id は必須です' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('brand_score_snapshots')
      .select('snapshot_date, total_score, inner_score, outer_score, rank')
      .eq('company_id', companyId)
      .order('snapshot_date', { ascending: true })

    if (error) {
      console.error('[Snapshot GET] エラー:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ snapshots: data || [] })
  } catch (err) {
    console.error('[Snapshot GET] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { company_id, period_days } = body as {
      company_id?: string
      period_days?: number
    }

    if (!company_id) {
      return NextResponse.json({ error: 'company_id は必須です' }, { status: 400 })
    }

    const period = period_days && period_days > 0 && period_days <= 365 ? period_days : 30

    const supabase = getSupabaseAdmin()

    // 1. 企業の存在確認
    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .select('id')
      .eq('id', company_id)
      .single()

    if (companyErr || !company) {
      return NextResponse.json({ error: '企業が見つかりません' }, { status: 404 })
    }

    // 2. 同日重複チェック（手動保存の連打防止）
    const today = new Date().toISOString().split('T')[0]
    const { data: existing } = await supabase
      .from('brand_score_snapshots')
      .select('id')
      .eq('company_id', company_id)
      .eq('snapshot_date', today)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: '本日のスコアは既に記録済みです' },
        { status: 409 }
      )
    }

    // 3. スナップショット集計
    const snapshot = await calculateSnapshot(supabase, company_id, period)

    // 3. brand_score_snapshots に INSERT
    const { data: inserted, error: insertErr } = await supabase
      .from('brand_score_snapshots')
      // 列リストは snapshotToRow が持つ（cron と同じものを使う）
      .insert(snapshotToRow(snapshot))
      .select()
      .single()

    if (insertErr) {
      console.error('[Snapshot POST] INSERT エラー:', insertErr.message)
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    return NextResponse.json({
      message: 'スナップショットを保存しました',
      snapshot: inserted,
    })
  } catch (err) {
    console.error('[Snapshot POST] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
