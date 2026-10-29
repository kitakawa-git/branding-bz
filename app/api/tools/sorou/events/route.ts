// 日程調整ツール（sorou）— 作成と一覧（ログイン必須）
// GET  /api/tools/sorou/events   自分が作成した日程調整（回答数つき）
// POST /api/tools/sorou/events   { title, memo, cands }  新しく作る。構築ツールの月次枠を1回使う
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireCaller } from '@/lib/auth/caller'
import { can } from '@/lib/billing/entitlements'
import { fetchCompanyPlan, usageLimitResponse } from '@/lib/billing/guard'
import { MONTHLY_FREE_LIMIT, MONTHLY_LIMIT_REACHED_MESSAGE, countCompletedThisMonth } from '@/lib/tools/free-limits'
import { SOROU_LIMITS, normalizeCands } from '@/lib/tools/sorou/core'
import { EVENT_COLUMNS, badRequest, cleanText, newEventId } from '@/lib/tools/sorou/server'

export async function GET(request: NextRequest) {
  try {
    const caller = await requireCaller(request)
    if (caller.error) return caller.error
    const admin = getSupabaseAdmin()

    const { data: events, error } = await admin
      .from('sorou_events')
      .select(EVENT_COLUMNS)
      .eq('owner_user_id', caller.authId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const ids = (events ?? []).map(e => e.id as string)
    const counts = new Map<string, number>()
    if (ids.length > 0) {
      const { data: parts } = await admin.from('sorou_participants').select('event_id').in('event_id', ids)
      for (const p of parts ?? []) counts.set(p.event_id as string, (counts.get(p.event_id as string) ?? 0) + 1)
    }

    return NextResponse.json({
      events: (events ?? []).map(e => ({
        id: e.id,
        title: e.title,
        memo: e.memo,
        cands: e.cands,
        created_at: e.created_at,
        updated_at: e.updated_at,
        participant_count: counts.get(e.id as string) ?? 0,
      })),
    })
  } catch (err) {
    console.error('[SorouEvents] GET error:', err)
    return NextResponse.json({ error: '日程調整の一覧を取得できませんでした' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = await requireCaller(request)
    if (caller.error) return caller.error
    const { authId, companyId } = caller

    const body = await request.json().catch(() => null)
    const title = cleanText(body?.title, SOROU_LIMITS.title)
    if (!title) return badRequest('イベント名を入力してください')
    const memo = cleanText(body?.memo, SOROU_LIMITS.memo)
    const cands = normalizeCands(body?.cands)
    if (!cands) return badRequest('候補日程を1件以上（200件まで）選んでください')

    const admin = getSupabaseAdmin()

    // 構築ツールの月次枠（無料プランは月3回）。作成した日程調整の数で数える
    const unlimited = can(await fetchCompanyPlan(companyId), 'buildToolsUnlimited')
    if (!unlimited) {
      const used = await countCompletedThisMonth(admin, 'sorou', { companyId, authId })
      if (used >= MONTHLY_FREE_LIMIT) return usageLimitResponse(MONTHLY_LIMIT_REACHED_MESSAGE)
    }

    // 回数は mini_app_sessions の完了行で数える（他の構築ツールと同じ数え方）
    const now = new Date().toISOString()
    const { data: session, error: sessionErr } = await admin
      .from('mini_app_sessions')
      .insert({
        user_id: authId,
        company_id: companyId,
        app_type: 'sorou',
        status: 'completed',
        current_step: 1,
        completed_at: now,
        session_data: { title },
      })
      .select('id')
      .single()
    if (sessionErr || !session) {
      console.error('[SorouEvents] session insert error:', sessionErr?.message)
      return NextResponse.json({ error: '日程調整を作成できませんでした' }, { status: 500 })
    }

    // ID の衝突は実質起きないが、起きたら作り直す
    for (let attempt = 0; attempt < 3; attempt++) {
      const id = newEventId()
      const { error } = await admin.from('sorou_events').insert({
        id,
        owner_user_id: authId,
        company_id: companyId,
        session_id: session.id,
        title,
        memo,
        cands,
      })
      if (!error) {
        await admin.from('mini_app_sessions').update({ session_data: { title, event_id: id } }).eq('id', session.id)
        return NextResponse.json({ id })
      }
      if (error.code !== '23505') {
        console.error('[SorouEvents] event insert error:', error.message)
        break
      }
    }
    // 作れなかったので枠を返す
    await admin.from('mini_app_sessions').delete().eq('id', session.id)
    return NextResponse.json({ error: '日程調整を作成できませんでした' }, { status: 500 })
  } catch (err) {
    console.error('[SorouEvents] POST error:', err)
    return NextResponse.json({ error: '日程調整を作成できませんでした' }, { status: 500 })
  }
}
