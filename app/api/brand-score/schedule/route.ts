// スナップショットスケジュール API
// GET  /api/brand-score/schedule?company_id=xxx → 現在の設定を返す（なければデフォルト）
// PUT  /api/brand-score/schedule → 設定を更新（upsert）
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  type Frequency,
  VALID_FREQUENCIES,
  calcNextSnapshotDate,
} from '@/lib/brand-score/schedule-utils'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase設定が不足しています')
  return createClient(url, key)
}

// GET: 現在のスケジュール設定を取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')

    if (!companyId) {
      return NextResponse.json({ error: 'company_id は必須です' }, { status: 400 })
    }

    const supabase = getSupabase()

    const { data, error } = await supabase
      .from('brand_score_schedules')
      .select('*')
      .eq('company_id', companyId)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = 行が見つからない（正常）
      console.error('[Schedule GET] エラー:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // レコードがない場合はデフォルト値を返す
    if (!data) {
      return NextResponse.json({
        company_id: companyId,
        frequency: 'monthly' as Frequency,
        anchor_date: new Date().toISOString().split('T')[0],
        next_snapshot_date: new Date().toISOString().split('T')[0],
        enabled: true,
        exists: false,
      })
    }

    return NextResponse.json({
      ...data,
      exists: true,
    })
  } catch (err) {
    console.error('[Schedule GET] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PUT: スケジュール設定を更新（upsert）
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { company_id, frequency, anchor_date, enabled } = body as {
      company_id?: string
      frequency?: string
      anchor_date?: string
      enabled?: boolean
    }

    if (!company_id) {
      return NextResponse.json({ error: 'company_id は必須です' }, { status: 400 })
    }

    // バリデーション
    const freq = (frequency || 'monthly') as Frequency
    if (!VALID_FREQUENCIES.includes(freq)) {
      return NextResponse.json(
        { error: `frequency は ${VALID_FREQUENCIES.join(', ')} のいずれかを指定してください` },
        { status: 400 }
      )
    }

    const anchor = anchor_date || new Date().toISOString().split('T')[0]
    // anchor_date の形式チェック（YYYY-MM-DD）
    if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor)) {
      return NextResponse.json(
        { error: 'anchor_date は YYYY-MM-DD 形式で指定してください' },
        { status: 400 }
      )
    }

    const nextDate = calcNextSnapshotDate(anchor, freq)
    const isEnabled = enabled !== undefined ? enabled : true

    const supabase = getSupabase()

    const { data, error } = await supabase
      .from('brand_score_schedules')
      .upsert(
        {
          company_id,
          frequency: freq,
          anchor_date: anchor,
          next_snapshot_date: nextDate,
          enabled: isEnabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id' }
      )
      .select()
      .single()

    if (error) {
      console.error('[Schedule PUT] エラー:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[Schedule PUT] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
