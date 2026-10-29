// 日程調整ツール（sorou）の API 共通処理（サーバー専用）
import 'server-only'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { SorouEvent, SorouParticipant } from './core'

const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/** 共有リンクに出るイベント ID（10文字の英数字。62^10 ≒ 8×10^17 通り） */
export function newEventId(): string {
  const bytes = randomBytes(10)
  return Array.from(bytes, b => ID_CHARS[b % ID_CHARS.length]).join('')
}

/** 回答を直すための合言葉（回答した端末にだけ渡す） */
export function newEditToken(): string {
  return randomBytes(24).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** 合言葉が一致するか（長さの違いや時間差で漏れないよう固定時間で比べる） */
export function tokenMatches(token: string | null, hash: string): boolean {
  if (!token) return false
  const a = Buffer.from(hashToken(token), 'hex')
  const b = Buffer.from(hash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

export const EVENT_COLUMNS = 'id, owner_user_id, title, memo, cands, created_at, updated_at'
export const PARTICIPANT_COLUMNS = 'id, name, answers, comment, created_at, updated_at'

export type SorouEventRow = SorouEvent & { owner_user_id: string }

export async function loadEventRow(id: string): Promise<SorouEventRow | null> {
  const { data } = await getSupabaseAdmin().from('sorou_events').select(EVENT_COLUMNS).eq('id', id).maybeSingle()
  return (data as SorouEventRow | null) ?? null
}

export async function loadParticipants(eventId: string): Promise<SorouParticipant[]> {
  const { data } = await getSupabaseAdmin()
    .from('sorou_participants')
    .select(PARTICIPANT_COLUMNS)
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
  return (data as SorouParticipant[] | null) ?? []
}

/** 画面に返す形（作成者の ID は返さない） */
export function publicEvent(row: SorouEventRow): SorouEvent {
  return { id: row.id, title: row.title, memo: row.memo, cands: row.cands, created_at: row.created_at, updated_at: row.updated_at }
}

export function notFound(): NextResponse {
  return NextResponse.json({ error: 'この日程調整は見つかりませんでした' }, { status: 404 })
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 })
}

/** 文字列の入力を整える（前後の空白を取り、長さを切る） */
export function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}
