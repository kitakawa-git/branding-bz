// Vercel Cron Job: ブランドスコア スナップショット自動取得
// 毎日 AM 3:00 (JST) に実行
// brand_score_schedules.next_snapshot_date <= today かつ enabled=true の企業を対象に
// スナップショットを集計・保存し、next_snapshot_date を次回日付に更新する
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { calculateSnapshot } from '@/lib/brand-score/calculate-snapshot'
import { calcNextSnapshotDate, type Frequency } from '@/lib/brand-score/schedule-utils'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5分（Proプラン対応）

export async function GET(request: NextRequest) {
  try {
    // CRON_SECRET による認証チェック
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // 今日の日付（UTC）
    const today = new Date().toISOString().split('T')[0]

    // 対象スケジュールを取得: next_snapshot_date <= today かつ enabled = true
    const { data: schedules, error: scheduleErr } = await supabase
      .from('brand_score_schedules')
      .select('company_id, frequency, anchor_date, next_snapshot_date')
      .eq('enabled', true)
      .lte('next_snapshot_date', today)

    if (scheduleErr) {
      console.error('[Cron] スケジュール取得エラー:', scheduleErr.message)
      return NextResponse.json({ error: scheduleErr.message }, { status: 500 })
    }

    if (!schedules || schedules.length === 0) {
      return NextResponse.json({
        message: '対象企業なし',
        processed: 0,
        date: today,
      })
    }


    const results: { company_id: string; success: boolean; error?: string }[] = []

    // 各企業を順次処理（並列だとDB負荷が高いため）
    for (const schedule of schedules) {
      try {
        // 1. スナップショット集計
        const snapshot = await calculateSnapshot(supabase, schedule.company_id, 30)

        // 2. brand_score_snapshots に INSERT
        const { error: insertErr } = await supabase
          .from('brand_score_snapshots')
          .insert({
            company_id: snapshot.company_id,
            snapshot_date: snapshot.snapshot_date,
            period_days: snapshot.period_days,
            inner_score: snapshot.inner_score,
            inner_why: snapshot.inner_why,
            inner_how: snapshot.inner_how,
            inner_what: snapshot.inner_what,
          inner_stages: snapshot.inner_stages,
            inner_survey_id: snapshot.inner_survey_id,
            inner_response_rate: snapshot.inner_response_rate,
            outer_score: snapshot.outer_score,
            outer_reach: snapshot.outer_reach,
            outer_interest: snapshot.outer_interest,
            outer_transition: snapshot.outer_transition,
            outer_engagement: snapshot.outer_engagement,
            outer_impression: snapshot.outer_impression,
            total_score: snapshot.total_score,
            rank: snapshot.rank,
            metadata: snapshot.metadata,
          })

        if (insertErr) {
          console.error(`[Cron] ${schedule.company_id} INSERT エラー:`, insertErr.message)
          results.push({ company_id: schedule.company_id, success: false, error: insertErr.message })
          continue
        }

        // 3. next_snapshot_date を次回日付に更新
        const nextDate = calcNextSnapshotDate(
          schedule.anchor_date,
          schedule.frequency as Frequency,
        )

        const { error: updateErr } = await supabase
          .from('brand_score_schedules')
          .update({
            next_snapshot_date: nextDate,
            updated_at: new Date().toISOString(),
          })
          .eq('company_id', schedule.company_id)

        if (updateErr) {
          console.error(`[Cron] ${schedule.company_id} スケジュール更新エラー:`, updateErr.message)
        }

        results.push({ company_id: schedule.company_id, success: true })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        console.error(`[Cron] ${schedule.company_id} 処理エラー:`, msg)
        results.push({ company_id: schedule.company_id, success: false, error: msg })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length


    return NextResponse.json({
      message: `${successCount}社のスナップショットを保存しました`,
      processed: schedules.length,
      success: successCount,
      failed: failCount,
      date: today,
      results,
    })
  } catch (err) {
    console.error('[Cron] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
