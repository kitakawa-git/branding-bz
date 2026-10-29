// 日程調整ツール（sorou）— 1件の取得・編集・削除
// GET    /api/tools/sorou/events/[id]   共有リンクの画面用（ログイン不要）。回答一覧と、作成者本人かを返す
// PATCH  /api/tools/sorou/events/[id]   { title, memo, cands }  作成者のみ。同じ「日付×時刻」の回答は引き継ぐ
// DELETE /api/tools/sorou/events/[id]   作成者のみ（回答も消える）
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getCallerAuthId } from '@/lib/auth/caller'
import { SOROU_LIMITS, isEventId, normalizeCands, remapAnswers, type SorouAnswer } from '@/lib/tools/sorou/core'
import { badRequest, cleanText, loadEventRow, loadParticipants, notFound, publicEvent } from '@/lib/tools/sorou/server'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    if (!isEventId(id)) return notFound()
    const row = await loadEventRow(id)
    if (!row) return notFound()
    const [participants, authId] = await Promise.all([loadParticipants(id), getCallerAuthId(request)])
    return NextResponse.json(
      { event: publicEvent(row), participants, isOwner: !!authId && authId === row.owner_user_id },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    console.error('[SorouEvent] GET error:', err)
    return NextResponse.json({ error: '日程調整を取得できませんでした' }, { status: 500 })
  }
}

/** 作成者本人か。違えば 404（存在を教えない） */
async function requireOwner(request: NextRequest, id: string) {
  if (!isEventId(id)) return { error: notFound() }
  const authId = await getCallerAuthId(request)
  if (!authId) return { error: NextResponse.json({ error: 'ログインが必要です' }, { status: 401 }) }
  const row = await loadEventRow(id)
  if (!row || row.owner_user_id !== authId) return { error: notFound() }
  return { row }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const owner = await requireOwner(request, id)
    if (owner.error) return owner.error

    const body = await request.json().catch(() => null)
    const title = cleanText(body?.title, SOROU_LIMITS.title)
    if (!title) return badRequest('イベント名を入力してください')
    const memo = cleanText(body?.memo, SOROU_LIMITS.memo)
    const cands = normalizeCands(body?.cands)
    if (!cands) return badRequest('候補日程を1件以上（200件まで）選んでください')

    const admin = getSupabaseAdmin()
    const participants = await loadParticipants(id)
    const now = new Date().toISOString()
    for (const p of participants) {
      const answers = remapAnswers(owner.row.cands, cands, p.answers as (SorouAnswer | null)[])
      const { error } = await admin.from('sorou_participants').update({ answers, updated_at: now }).eq('id', p.id)
      if (error) return NextResponse.json({ error: '回答の引き継ぎに失敗しました' }, { status: 500 })
    }

    const { error } = await admin.from('sorou_events').update({ title, memo, cands, updated_at: now }).eq('id', id)
    if (error) return NextResponse.json({ error: '日程調整を更新できませんでした' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[SorouEvent] PATCH error:', err)
    return NextResponse.json({ error: '日程調整を更新できませんでした' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const owner = await requireOwner(request, id)
    if (owner.error) return owner.error
    // 使った回数（mini_app_sessions）は残す。消すと月の枠が戻ってしまう
    const { data, error } = await getSupabaseAdmin().from('sorou_events').delete().eq('id', id).select('id')
    if (error) return NextResponse.json({ error: '削除できませんでした' }, { status: 500 })
    if (!data?.length) return notFound()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[SorouEvent] DELETE error:', err)
    return NextResponse.json({ error: '削除できませんでした' }, { status: 500 })
  }
}
