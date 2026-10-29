// 日程調整ツール（sorou）— 回答の登録（共有リンク・ログイン不要）
// POST /api/tools/sorou/events/[id]/participants  { name, comment, answers }
//   回答した端末にだけ合言葉（token）を返す。修正・削除はこの合言葉か作成者だけができる
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { SOROU_LIMITS, isEventId, normalizeAnswers } from '@/lib/tools/sorou/core'
import { PARTICIPANT_COLUMNS, badRequest, cleanText, hashToken, loadEventRow, newEditToken, notFound } from '@/lib/tools/sorou/server'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    if (!isEventId(id)) return notFound()
    const event = await loadEventRow(id)
    if (!event) return notFound()

    const body = await request.json().catch(() => null)
    const name = cleanText(body?.name, SOROU_LIMITS.name)
    if (!name) return badRequest('名前を入力してください')
    const comment = cleanText(body?.comment, SOROU_LIMITS.comment)
    const answers = normalizeAnswers(body?.answers, event.cands.length)
    if (!answers) return badRequest('すべての候補に回答してください')

    const admin = getSupabaseAdmin()
    const { count } = await admin.from('sorou_participants').select('id', { count: 'exact', head: true }).eq('event_id', id)
    if ((count ?? 0) >= SOROU_LIMITS.participants) {
      return badRequest(`回答は${SOROU_LIMITS.participants}人までです`)
    }

    const token = newEditToken()
    const { data, error } = await admin
      .from('sorou_participants')
      .insert({ event_id: id, name, comment, answers, edit_token_hash: hashToken(token) })
      .select(PARTICIPANT_COLUMNS)
      .single()
    if (error || !data) return NextResponse.json({ error: '回答を登録できませんでした' }, { status: 500 })
    return NextResponse.json({ participant: data, token })
  } catch (err) {
    console.error('[SorouParticipants] POST error:', err)
    return NextResponse.json({ error: '回答を登録できませんでした' }, { status: 500 })
  }
}
