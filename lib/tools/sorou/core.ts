// 日程調整ツール（sorou）の型と純関数。画面と API の両方で使う（I/O なし）
//
// もとは include.bz の tools.include.bz/sorou（単体 HTML）。branding.bz の構築ツールとして作り直した。
//   - 作成・編集はログイン必須（構築ツールの月次枠を使う）。回答は共有リンクからログイン不要
//   - 回答の修正・削除は、回答した端末に渡した合言葉か、作成者だけができる（include.bz 版の不具合を解消）

/** 候補日程。k = 日付（YYYY-MM-DD）、t = 時刻（"HH:MM"・任意の文字列・空なら時刻未定） */
export type SorouCand = { k: string; t: string }

/** 回答。ok = 可、mb = 未定、no = 不可 */
export type SorouAnswer = 'ok' | 'mb' | 'no'

export type SorouParticipant = {
  id: string
  name: string
  answers: (SorouAnswer | null)[]
  comment: string
  created_at: string
  updated_at: string
}

export type SorouEvent = {
  id: string
  title: string
  memo: string
  cands: SorouCand[]
  created_at: string
  updated_at: string
}

export const SOROU_LIMITS = {
  cands: 200,
  participants: 200,
  title: 200,
  memo: 500,
  time: 40,
  name: 60,
  comment: 300,
} as const

export const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const EVENT_ID_RE = /^[A-Za-z0-9]{10}$/

export function isEventId(id: unknown): id is string {
  return typeof id === 'string' && EVENT_ID_RE.test(id)
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function dateKey(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`
}

export function parseDateKey(k: string): { y: number; m: number; d: number } {
  const [y, m, d] = k.split('-').map(Number)
  return { y, m, d }
}

/** その日付の曜日（0=日） */
export function weekdayOf(k: string): number {
  const { y, m, d } = parseDateKey(k)
  return new Date(y, m - 1, d).getDay()
}

/** 「10/29(木) 19:00」 */
export function candLabel(c: SorouCand): string {
  const { m, d } = parseDateKey(c.k)
  return `${pad2(m)}/${pad2(d)}(${WEEKDAYS[weekdayOf(c.k)]})${c.t ? ` ${c.t}` : ''}`
}

/** 実在する日付か（2026-02-30 などを弾く） */
function isRealDate(k: string): boolean {
  if (!DATE_RE.test(k)) return false
  const { y, m, d } = parseDateKey(k)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/** API で受け取った候補を検証して整える。不正なら null */
export function normalizeCands(raw: unknown): SorouCand[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > SOROU_LIMITS.cands) return null
  const out: SorouCand[] = []
  for (const item of raw) {
    const c = item as { k?: unknown; t?: unknown }
    if (typeof c?.k !== 'string' || !isRealDate(c.k)) return null
    const t = typeof c.t === 'string' ? c.t.trim().slice(0, SOROU_LIMITS.time) : ''
    out.push({ k: c.k, t })
  }
  // 日付→時刻の順に並べる（時刻未定は同じ日の先頭）
  return out.sort((a, b) => a.k.localeCompare(b.k) || a.t.localeCompare(b.t))
}

/** API で受け取った回答を検証する。候補数と同じ長さで、すべて ok/mb/no のときだけ通す */
export function normalizeAnswers(raw: unknown, candCount: number): SorouAnswer[] | null {
  if (!Array.isArray(raw) || raw.length !== candCount) return null
  const out: SorouAnswer[] = []
  for (const v of raw) {
    if (v !== 'ok' && v !== 'mb' && v !== 'no') return null
    out.push(v)
  }
  return out
}

/**
 * 候補を編集したときの回答の引き継ぎ。
 * 新しい候補 j が、前の候補のどれと「日付×時刻」が同じかを引き、同じなら前の回答を、無ければ未回答（null）にする
 */
export function remapAnswers(
  oldCands: SorouCand[],
  newCands: SorouCand[],
  oldAnswers: (SorouAnswer | null)[],
): (SorouAnswer | null)[] {
  const index = new Map<string, number>()
  oldCands.forEach((c, i) => {
    const key = `${c.k}|${c.t}`
    if (!index.has(key)) index.set(key, i)
  })
  return newCands.map(c => {
    const i = index.get(`${c.k}|${c.t}`)
    return i === undefined ? null : (oldAnswers[i] ?? null)
  })
}

export type SorouTallyRow = { index: number; cand: SorouCand; ok: number; mb: number; no: number; score: number }

/** 候補ごとの集計。score = 可×2＋未定（最有力の判定に使う） */
export function tally(cands: SorouCand[], participants: Pick<SorouParticipant, 'answers'>[]): SorouTallyRow[] {
  return cands.map((cand, index) => {
    let ok = 0, mb = 0, no = 0
    for (const p of participants) {
      const v = p.answers[index]
      if (v === 'ok') ok++
      else if (v === 'mb') mb++
      else if (v === 'no') no++
    }
    return { index, cand, ok, mb, no, score: ok * 2 + mb }
  })
}

/** 最有力の score（回答が無い・全員不可なら null） */
export function bestScore(rows: SorouTallyRow[]): number | null {
  const best = Math.max(0, ...rows.map(r => r.score))
  return best > 0 ? best : null
}

/** 時刻の選択肢（07:00〜22:00 を30分刻み） */
export const TIME_OPTIONS: string[] = (() => {
  const out: string[] = []
  for (let h = 7; h <= 22; h++) for (const m of [0, 30]) if (!(h === 22 && m > 0)) out.push(`${pad2(h)}:${pad2(m)}`)
  return out
})()

/** よく使う時刻（候補の時刻を選ぶチップ） */
export const CHIP_TIMES = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00']
