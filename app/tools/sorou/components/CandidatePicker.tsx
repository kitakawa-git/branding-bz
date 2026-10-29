'use client'

// 候補日程の選び方: カレンダーで日付を選び、日付ごとに時刻を決める（1日に複数の時刻も可）
// 既定の時刻は「これから選ぶ日付」に入る。選択済みの候補は変わらない（全件を上書きするボタンは別）
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { CHIP_TIMES, TIME_OPTIONS, WEEKDAYS, dateKey, parseDateKey, pad2, weekdayOf, type SorouCand } from '@/lib/tools/sorou/core'

/** 日付 → その日の時刻の一覧 */
export type CandSelection = Record<string, string[]>

export function selectionToCands(sel: CandSelection): SorouCand[] {
  return Object.keys(sel)
    .sort()
    .flatMap(k => sel[k].map(t => ({ k, t })))
}

export function candsToSelection(cands: SorouCand[]): CandSelection {
  const sel: CandSelection = {}
  for (const c of cands) (sel[c.k] ??= []).push(c.t)
  return sel
}

export function countSelection(sel: CandSelection): number {
  return Object.values(sel).reduce((n, ts) => n + ts.length, 0)
}

const dayClass = (w: number) => (w === 0 ? 'text-rose-600' : w === 6 ? 'text-ds-app-accent' : '')

type Props = {
  value: CandSelection
  onChange: (next: CandSelection) => void
}

export function CandidatePicker({ value: sel, onChange }: Props) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // 初期表示は選択済みの最初の月（無ければ今月）
  const [view, setView] = useState(() => {
    const first = Object.keys(sel).sort()[0]
    if (first) {
      const { y, m } = parseDateKey(first)
      return { y, m }
    }
    return { y: today.getFullYear(), m: today.getMonth() + 1 }
  })
  const [defaultTime, setDefaultTime] = useState('19:00')
  const [expanded, setExpanded] = useState<string | null>(null) // 時刻を選んでいる枠 "日付|番号"
  const [armed, setArmed] = useState(false) // 全件上書きの確認中
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (armTimer.current) clearTimeout(armTimer.current) }, [])

  const total = countSelection(sel)
  const keys = Object.keys(sel).sort()

  const moveMonth = (delta: number) =>
    setView(v => {
      const d = new Date(v.y, v.m - 1 + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() + 1 }
    })

  const toggleDay = (k: string) => {
    const next = { ...sel }
    if (next[k]) {
      delete next[k]
      if (expanded?.startsWith(`${k}|`)) setExpanded(null)
    } else {
      next[k] = [defaultTime]
      setExpanded(`${k}|0`)
    }
    onChange(next)
  }

  const addWeekly = (dow: number) => {
    const next = { ...sel }
    const last = new Date(view.y, view.m, 0).getDate()
    for (let d = 1; d <= last; d++) {
      const dt = new Date(view.y, view.m - 1, d)
      const k = dateKey(view.y, view.m, d)
      if (dt.getDay() === dow && dt >= today && !next[k]) next[k] = [defaultTime]
    }
    onChange(next)
  }

  const setTime = (k: string, i: number, t: string) => {
    onChange({ ...sel, [k]: sel[k].map((v, j) => (j === i ? t : v)) })
  }
  const addTime = (k: string) => {
    onChange({ ...sel, [k]: [...sel[k], defaultTime] })
    setExpanded(`${k}|${sel[k].length}`)
  }
  const removeTime = (k: string, i: number) => {
    const times = sel[k].filter((_, j) => j !== i)
    const next = { ...sel }
    if (times.length) next[k] = times
    else delete next[k]
    setExpanded(null)
    onChange(next)
  }
  const removeDay = (k: string) => {
    const next = { ...sel }
    delete next[k]
    setExpanded(null)
    onChange(next)
  }

  const disarm = () => {
    setArmed(false)
    if (armTimer.current) clearTimeout(armTimer.current)
  }
  const applyDefaultToAll = () => {
    if (!armed) {
      setArmed(true)
      armTimer.current = setTimeout(() => setArmed(false), 4000)
      return
    }
    disarm()
    onChange(Object.fromEntries(keys.map(k => [k, sel[k].map(() => defaultTime)])))
  }

  // カレンダーのマス
  const firstDow = new Date(view.y, view.m - 1, 1).getDay()
  const lastDay = new Date(view.y, view.m, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: lastDay }, (_, i) => i + 1)]

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
      {/* カレンダー */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="m-0 text-base font-bold tabular-nums">{view.y}年{view.m}月</p>
          <div className="flex">
            <Button type="button" variant="ghost" size="icon" className="size-11" aria-label="前の月" onClick={() => moveMonth(-1)}>
              <ChevronLeft size={18} />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-11" aria-label="次の月" onClick={() => moveMonth(1)}>
              <ChevronRight size={18} />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 text-center text-xs text-muted-foreground mb-1">
          {WEEKDAYS.map((w, i) => (
            <span key={w} className={dayClass(i)}>{w}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1" role="group" aria-label="候補日を選ぶ">
          {cells.map((d, i) => {
            if (d === null) return <span key={`pad-${i}`} />
            const k = dateKey(view.y, view.m, d)
            const dt = new Date(view.y, view.m - 1, d)
            const past = dt < today
            const isToday = dt.getTime() === today.getTime()
            const n = sel[k]?.length ?? 0
            return (
              <button
                key={k}
                type="button"
                disabled={past}
                aria-pressed={n > 0}
                aria-label={`${view.m}月${d}日${n > 0 ? `、選択中 ${n}件` : ''}`}
                onClick={() => toggleDay(k)}
                className={`relative h-11 rounded-md text-sm tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                  n > 0
                    ? 'bg-foreground text-background font-bold'
                    : `bg-background hover:bg-muted ${dayClass(dt.getDay())} ${isToday ? 'ring-1 ring-foreground/40' : ''}`
                }`}
              >
                {d}
                {n > 1 && (
                  <span className="absolute right-1 top-0.5 text-[10px] font-bold leading-none">{n}</span>
                )}
              </button>
            )
          })}
        </div>

        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            既定の時刻
            <select
              value={defaultTime}
              onChange={e => { setDefaultTime(e.target.value); disarm() }}
              className="h-10 rounded-md border border-input bg-white px-2 text-sm text-foreground"
            >
              <option value="">時刻未定</option>
              {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <div>
            <span className="mb-1 block text-xs text-muted-foreground">毎週の曜日をまとめて追加（表示中の月）</span>
            <div className="flex gap-1">
              {WEEKDAYS.map((w, i) => (
                <Button key={w} type="button" variant="outline" size="sm" className={`h-9 w-9 p-0 ${dayClass(i)}`} onClick={() => addWeekly(i)} aria-label={`${view.m}月の毎週${w}曜日を追加`}>
                  {w}
                </Button>
              ))}
            </div>
          </div>
          <p className="m-0 text-xs text-muted-foreground">既定の時刻は、これから選ぶ日付に入ります。選択済みの候補は変わりません。</p>
        </div>
      </div>

      {/* 選択中の候補 */}
      <div className="min-w-0">
        <p className="mb-2 text-sm font-bold">選択中 <span className="font-normal text-muted-foreground">{total}件</span></p>
        {keys.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-background px-4 py-6 text-center text-[13px] text-muted-foreground">
            カレンダーの日付を選ぶと、ここに候補が並びます。1日に複数の時間帯を出すこともできます。
          </p>
        ) : (
          <div className="max-h-[440px] space-y-2 overflow-y-auto pr-1">
            {keys.map(k => {
              const { m, d } = parseDateKey(k)
              const w = weekdayOf(k)
              return (
                <div key={k} className="rounded-lg border bg-background px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold tabular-nums">{pad2(m)}/{pad2(d)}</span>
                    <span className={`text-xs ${dayClass(w)}`}>({WEEKDAYS[w]})</span>
                    <Button type="button" variant="ghost" size="sm" className="ml-auto h-9 gap-1 px-2 text-xs" onClick={() => addTime(k)}>
                      <Plus size={14} />時間
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="size-9" aria-label={`${m}月${d}日を解除`} onClick={() => removeDay(k)}>
                      <X size={16} />
                    </Button>
                  </div>
                  <div className="mt-1 space-y-1">
                    {sel[k].map((t, i) => (
                      <TimeSlot
                        key={i}
                        time={t}
                        open={expanded === `${k}|${i}`}
                        onToggle={() => setExpanded(expanded === `${k}|${i}` ? null : `${k}|${i}`)}
                        onPick={v => { setTime(k, i, v); setExpanded(null); disarm() }}
                        onRemove={sel[k].length > 1 ? () => removeTime(k, i) : undefined}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="button" variant={armed ? 'destructive' : 'outline'} size="sm" className="h-9" disabled={!keys.length} onClick={applyDefaultToAll}>
            {armed ? `${total}件を「${defaultTime || '時刻未定'}」に上書き` : '全件を既定の時刻に上書き'}
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-9" disabled={!keys.length} onClick={() => { setExpanded(null); disarm(); onChange({}) }}>
            すべて解除
          </Button>
        </div>
      </div>
    </div>
  )
}

/** 1つの時間枠。閉じているときは現在の時刻、開くとよく使う時刻から選べる */
function TimeSlot({ time, open, onToggle, onPick, onRemove }: {
  time: string
  open: boolean
  onToggle: () => void
  onPick: (t: string) => void
  onRemove?: () => void
}) {
  const [other, setOther] = useState(false)
  const label = time === '' ? '時刻未定' : time.replace(/^0/, '')
  const chip = (active: boolean) =>
    `h-9 rounded-md border px-2.5 text-[13px] tabular-nums transition-colors ${
      active ? 'border-foreground bg-foreground text-background font-bold' : 'border-border bg-background hover:bg-muted'
    }`
  const extra = time !== '' && !CHIP_TIMES.includes(time)
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex h-9 items-center gap-2 rounded-md px-2 text-sm hover:bg-muted"
      >
        <span className="font-bold tabular-nums">{label}</span>
        <span className="text-xs text-ds-app-accent">{open ? '閉じる' : '変更'}</span>
      </button>
      {open && (
        <div className="mt-1 flex flex-wrap gap-1 pb-1">
          {CHIP_TIMES.map(t => (
            <button key={t} type="button" aria-pressed={t === time} className={chip(t === time)} onClick={() => onPick(t)}>
              {t.replace(/^0/, '')}
            </button>
          ))}
          {extra && (
            <button type="button" aria-pressed className={chip(true)} onClick={() => onPick(time)}>{time}</button>
          )}
          <button type="button" aria-pressed={time === ''} className={chip(time === '')} onClick={() => onPick('')}>時刻未定</button>
          <button type="button" className={chip(false)} onClick={() => setOther(o => !o)}>＋その他</button>
          {onRemove && (
            <button type="button" className={`${chip(false)} text-rose-600`} onClick={onRemove}>× この時間を削除</button>
          )}
          {other && (
            <input
              type="time"
              aria-label="その他の時刻"
              className="h-9 rounded-md border border-input bg-white px-2 text-base"
              onChange={e => { if (e.target.value) { onPick(e.target.value); setOther(false) } }}
            />
          )}
        </div>
      )}
    </div>
  )
}
