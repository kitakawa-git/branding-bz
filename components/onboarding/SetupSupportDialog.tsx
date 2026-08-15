'use client'

// 入力サポート（オンライン相談）の申し込みダイアログ。
//
// 以前は外部の問い合わせフォームに飛ばしていたが、サービスサイトに出てしまい
// 「アプリの中で助けてもらえる」感じが切れていた。ログインしたまま完結させる。
//
// 日時はカレンダーで候補日を積み上げる方式にする。自由記述だと
// 「いつ空いているか」を文章にする手間が先に来て、そこで止まってしまう。
//
// カレンダー連携はしないので、その場で日程は確定しない。
// ただし「確定しません」と否定形で先に言うと不安が残るため、
// 肯定形（このあと担当者から連絡して確定する）でフッターに置く。
//
// ⚠️ API・DB は自由記述時代のまま（preferred_slots は text）。
//    候補日は送る直前に1行の文字列へ整形する。受け取り側（スーパー管理）は
//    その文字列をそのまま表示するだけなので、増やすときも表示側は触らなくてよい。
import { useEffect, useState } from 'react'
import { addMonths, format, parseISO, startOfToday } from 'date-fns'
import { ja } from 'date-fns/locale'
import { CalendarCheck, Check, Loader2, Plus, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Textarea } from '@/components/ui/textarea'

type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'anytime'

type Candidate = {
  /** yyyy-MM-dd。Date ではなく文字列で持つ（比較・重複判定・整形が楽） */
  date: string
  slot: TimeSlot
}

const SLOT_LABELS: Record<TimeSlot, string> = {
  morning: '午前（9:00〜12:00）',
  afternoon: '午後（13:00〜18:00）',
  evening: '夕方以降（18:00〜）',
  anytime: '終日OK',
}

/** チップと候補行に出す短いほう */
const SLOT_SHORT: Record<TimeSlot, string> = {
  morning: '午前',
  afternoon: '午後',
  evening: '夕方以降',
  anytime: '終日OK',
}

const SLOT_ORDER: TimeSlot[] = ['morning', 'afternoon', 'evening', 'anytime']

const MAX_CANDIDATES = 3

type PendingRequest = {
  id: string
  preferred_slots: string | null
  note: string | null
  created_at: string
}

/** 送信直前に1行へ組み立てる。preferred_slots は text のままなので整形はここだけ */
function buildPreferredSlots(candidates: Candidate[], anytime: boolean): string {
  if (anytime) return 'お任せします'
  return candidates
    .map((c, i) => {
      const d = format(parseISO(c.date), 'M月d日(E)', { locale: ja })
      return `第${i + 1}希望: ${d} ${SLOT_SHORT[c.slot]}`
    })
    .join(' / ')
}

/**
 * 前回の依頼を開き直したときの復元。
 * 自由記述時代の依頼が残っている可能性があるので、厳密なパースはしない。
 * 新形式にマッチしたものだけ候補として戻し、それ以外はそのまま見せて選び直してもらう。
 *
 * 年は現在の年で補う。またぐとずれるが、pending は数日〜数週で処理される前提。
 * ずれても選び直せば直る。
 */
function parsePreferredSlots(raw: string | null): {
  candidates: Candidate[]
  anytime: boolean
  legacyText: string | null
} {
  if (!raw) return { candidates: [], anytime: false, legacyText: null }
  if (raw.trim() === 'お任せします') {
    return { candidates: [], anytime: true, legacyText: null }
  }

  const matched = [...raw.matchAll(/第\d希望:\s*(\d+)月(\d+)日\([^)]+\)\s*(\S+)/g)]
  if (matched.length === 0) {
    return { candidates: [], anytime: false, legacyText: raw }
  }

  const year = new Date().getFullYear()
  const slotOf = (s: string): TimeSlot =>
    s.startsWith('午前')
      ? 'morning'
      : s.startsWith('午後')
        ? 'afternoon'
        : s.startsWith('夕方')
          ? 'evening'
          : 'anytime'

  return {
    candidates: matched.map((m) => ({
      date: `${year}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`,
      slot: slotOf(m[3]),
    })),
    anytime: false,
    legacyText: null,
  }
}

export function SetupSupportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [anytime, setAnytime] = useState(false)
  const [legacyText, setLegacyText] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingRequest | null>(null)
  const [done, setDone] = useState(false)

  // Popover の中の下書き。追加するまで候補には入れない
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [draftDate, setDraftDate] = useState<Date | undefined>()
  const [draftSlot, setDraftSlot] = useState<TimeSlot>('afternoon')

  // 開くたびに現状を取り直す。前回の依頼が残っていれば、それを初期値にする
  useEffect(() => {
    if (!open) return
    setError(null)
    setDone(false)
    fetch('/api/setup-support-requests')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const p: PendingRequest | null = data?.pending ?? null
        setPending(p)
        const parsed = parsePreferredSlots(p?.preferred_slots ?? null)
        setCandidates(parsed.candidates)
        setAnytime(parsed.anytime)
        setLegacyText(parsed.legacyText)
        setNote(p?.note ?? '')
      })
      .catch(() => {})
  }, [open])

  const isFull = candidates.length >= MAX_CANDIDATES
  // 同じ日・同じ時間帯は積めない。トーストを出さず、追加ボタンを押せなくして示す
  const isDuplicate =
    !!draftDate &&
    candidates.some(
      (c) => c.date === format(draftDate, 'yyyy-MM-dd') && c.slot === draftSlot,
    )

  const addCandidate = () => {
    if (!draftDate || isDuplicate || isFull) return
    setCandidates((prev) => [...prev, { date: format(draftDate, 'yyyy-MM-dd'), slot: draftSlot }])
    setDraftDate(undefined)
    setDraftSlot('afternoon')
    setPopoverOpen(false)
  }

  const removeCandidate = (i: number) =>
    setCandidates((prev) => prev.filter((_, idx) => idx !== i))

  const canSubmit = (anytime || candidates.length > 0) && !saving

  const submit = async () => {
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/setup-support-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferredSlots: buildPreferredSlots(candidates, anytime),
          note: note.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || '送信できませんでした。時間をおいて試してください。')
        return
      }
      setDone(true)
    } catch {
      setError('送信できませんでした。通信状況を確認してください。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {done ? (
          <>
            <DialogHeader>
              <DialogTitle>お申し込みを受け付けました</DialogTitle>
              <DialogDescription>
                いただいた候補日をもとに、担当者からご連絡して日程を確定します。
                オンラインで画面を見ながら一緒に入力しますので、準備は不要です。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-6 text-sm font-bold text-background"
              >
                閉じる
              </button>
            </DialogFooter>
          </>
        ) : (
          <>
            {/* DialogHeader の既定は sm 以上で左寄せ。ここは中央に揃える */}
            <DialogHeader className="sm:text-center">
              <DialogTitle>入力サポートを申し込む</DialogTitle>
              <DialogDescription>
                オンラインで画面を見ながら、担当者が入力をサポートします。
              </DialogDescription>
            </DialogHeader>

            {pending && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                お申し込みを受付中です。内容を変えて送り直すと、この依頼を差し替えます。
              </p>
            )}

            <div>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">ご希望の候補日</span>
                <span className="text-xs text-muted-foreground">
                  {candidates.length} / {MAX_CANDIDATES}
                </span>
              </div>

              {/* 旧形式の自由記述が残っていたとき。候補には戻せないので、控えめに見せて選び直してもらう */}
              {legacyText && (
                <p className="mb-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                  前回のご希望：{legacyText}
                </p>
              )}

              {candidates.length > 0 && (
                <ul className={`m-0 mb-2 list-none space-y-1.5 p-0 ${anytime ? 'opacity-40' : ''}`}>
                  {candidates.map((c, i) => (
                    <li
                      key={`${c.date}-${c.slot}`}
                      className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5"
                    >
                      <span
                        aria-hidden="true"
                        className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-blue-50 text-[10.5px] font-extrabold text-blue-600"
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">
                        {format(parseISO(c.date), 'M月d日(E)', { locale: ja })}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {SLOT_SHORT[c.slot]}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeCandidate(i)}
                        disabled={anytime}
                        aria-label={`${format(parseISO(c.date), 'M月d日', { locale: ja })}の候補を削除`}
                        className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-muted-foreground/40 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed"
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={anytime || isFull}
                    className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-dashed border-border bg-transparent py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-blue-600 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                  >
                    {isFull ? (
                      '候補日の上限に達しました'
                    ) : (
                      <>
                        <Plus size={14} aria-hidden="true" />
                        候補日を追加（あと{MAX_CANDIDATES - candidates.length}件）
                      </>
                    )}
                  </button>
                </PopoverTrigger>
                {/* 幅は中身（カレンダー）に合わせる。モバイルではみ出さないよう左揃え */}
                <PopoverContent align="start" className="w-auto p-3">
                  <Calendar
                    mode="single"
                    selected={draftDate}
                    onSelect={setDraftDate}
                    // ⚠️ { before, after } を1つのオブジェクトで渡すと react-day-picker では
                    //    「その2日の“あいだ”」を指す区間マッチャになり、狙いと逆になる。
                    //    過去と3ヶ月より先をそれぞれ落としたいので、2つに分けて配列で渡す
                    disabled={[
                      { before: startOfToday() },
                      { after: addMonths(startOfToday(), 3) },
                    ]}
                    // すでに積んだ日には印を出して、同じ日を選び直してしまうのを防ぐ
                    modifiers={{ picked: candidates.map((c) => parseISO(c.date)) }}
                    modifiersClassNames={{
                      picked:
                        'after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:size-1 after:rounded-full after:bg-emerald-500',
                    }}
                    autoFocus
                    className="p-0"
                  />

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {SLOT_ORDER.map((slot) => {
                      const selected = slot === draftSlot
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setDraftSlot(slot)}
                          aria-pressed={selected}
                          title={SLOT_LABELS[slot]}
                          className={`cursor-pointer rounded-full border-[1.5px] px-3 py-1.5 text-xs font-semibold transition-colors ${
                            selected
                              ? 'border-ds-app-accent bg-ds-app-accent text-white'
                              : 'border-border bg-transparent text-muted-foreground hover:border-blue-600 hover:text-blue-600'
                          }`}
                        >
                          {SLOT_SHORT[slot]}
                        </button>
                      )
                    })}
                  </div>

                  <div className="mt-3 flex justify-end gap-2 border-t border-border pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setDraftDate(undefined)
                        setPopoverOpen(false)
                      }}
                      className="cursor-pointer rounded-lg border-0 bg-transparent px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      onClick={addCandidate}
                      disabled={!draftDate || isDuplicate}
                      className="cursor-pointer rounded-lg border-0 bg-foreground px-4 py-2 text-xs font-bold text-background disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      この日を追加
                    </button>
                  </div>
                </PopoverContent>
              </Popover>

              {/* 候補を挙げられない人をここで止めない。挙げた候補は消さずに残す（外せば戻る） */}
              <button
                type="button"
                role="checkbox"
                aria-checked={anytime}
                onClick={() => setAnytime((v) => !v)}
                className={`mt-2 flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-[1.5px] px-3 py-2.5 text-left transition-colors ${
                  anytime
                    ? 'border-ds-app-accent bg-blue-50'
                    : 'border-border bg-transparent hover:bg-muted/40'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex size-[18px] shrink-0 items-center justify-center rounded border-[1.5px] ${
                    anytime
                      ? 'border-ds-app-accent bg-ds-app-accent text-white'
                      : 'border-border'
                  }`}
                >
                  {anytime && <Check size={12} strokeWidth={3} />}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  日程はお任せします
                </span>
              </button>
            </div>

            <div>
              <label htmlFor="support-note" className="mb-1 block text-sm font-medium">
                相談したいこと（任意）
              </label>
              <Textarea
                id="support-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="つまずいている箇所、決めきれていないことなど"
              />
              <p className="m-0 mt-2 text-center text-xs text-muted-foreground">
                日程はこの後、担当者からのご連絡で確定します。
              </p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            {/* 既定は右寄せ。見出しに合わせて中央に置く */}
            <DialogFooter className="sm:justify-center">
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-foreground px-6 text-sm font-bold text-background disabled:opacity-40"
              >
                {saving ? (
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                ) : (
                  <CalendarCheck size={15} aria-hidden="true" />
                )}
                {pending ? 'この内容で申し込み直す' : 'この内容で申し込む'}
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
