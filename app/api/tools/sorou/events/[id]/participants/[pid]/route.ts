// 日程調整ツール（sorou）— 回答の修正・削除
// PATCH  /api/tools/sorou/events/[id]/participants/[pid]  { name, comment, answers }
// DELETE /api/tools/sorou/events/[id]/participants/[pid]
// できるのは、回答した端末（ヘッダー x-sorou-token の合言葉）か、日程調整の作成者だけ
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getCallerAuthId } from '@/lib/auth/caller'
import { SOROU_LIMITS, isEventId, normalizeAnswers } from '@/lib/tools/sorou/core'
import { PARTICIPANT_COLUMNS, badRequest, cleanText, loadEventRow, notFound, tokenMatches } from '@/lib/tools/sorou/server'

type RouteContext = { params: Promise<{ id: string; pid: string }> }

const UUID_RE = /^[0-9a-f-]{36}$/i

/** 対象の回答と、それを直してよいかを確かめる */
async function authorize(request: NextRequest, id: string, pid: string) {
  if (!isEventId(id) || !UUID_RE.test(pid)) return { error: notFound() }
  const event = await loadEventRow(id)
  if (!event) return { error: notFound() }
  const { data: participant } = await getSupabaseAdmin()
    .from('sorou_participants')
    .select('id, edit_token_hash')
    .eq('id', pid)
    .eq('event_id', id)
    .maybeSingle()
  if (!participant) return { error: notFound() }

  const token = request.headers.get('x-sorou-token')
  if (tokenMatches(token, participant.edit_token_hash as string)) return { event }
  const authId = await getCallerAuthId(request)
  if (authId && authId === event.owner_user_id) return { event }
  return {
    error: NextResponse.json(
      { error: 'この回答は、回答した端末か日程調整を作った人だけが変更できます' },
      { status: 403 },
    ),
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id, pid } = await context.params
    const auth = await authorize(request, id, pid)
    if (auth.error) return auth.error

    const body = await request.json().catch(() => null)
    const name = cleanText(body?.name, SOROU_LIMITS.name)
    if (!name) return badRequest('名前を入力してください')
    const comment = cleanText(body?.comment, SOROU_LIMITS.comment)
    const answers = normalizeAnswers(body?.answers, auth.event.cands.length)
    if (!answers) return badRequest('すべての候補に回答してください')

    const { data, error } = await getSupabaseAdmin()
      .from('sorou_participants')
      .update({ name, comment, answers, updated_at: new Date().toISOString() })
      .eq('id', pid)
      .eq('event_id', id)
      .select(PARTICIPANT_COLUMNS)
      .single()
    if (error || !data) return NextResponse.json({ error: '回答を更新できませんでした' }, { status: 500 })
    return NextResponse.json({ participant: data })
  } catch (err) {
    console.error('[SorouParticipant] PATCH error:', err)
    return NextResponse.json({ error: '回答を更新できませんでした' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id, pid } = await context.params
    const auth = await authorize(request, id, pid)
    if (auth.error) return auth.error
    const { data, error } = await getSupabaseAdmin()
      .from('sorou_participants')
      .delete()
      .eq('id', pid)
      .eq('event_id', id)
      .select('id')
    if (error) return NextResponse.json({ error: '削除できませんでした' }, { status: 500 })
    if (!data?.length) return notFound()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[SorouParticipant] DELETE error:', err)
    return NextResponse.json({ error: '削除できませんでした' }, { status: 500 })
  }
}
