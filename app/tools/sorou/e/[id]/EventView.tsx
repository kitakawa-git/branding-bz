'use client'

// 共有リンクの画面の本体。回答は誰でも登録でき、修正・削除は回答した端末（合言葉）か作成者だけ
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Copy, Check, Pencil, Trash2, ArrowUpDown, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  SOROU_LIMITS,
  WEEKDAYS,
  bestScore,
  candLabel,
  pad2,
  parseDateKey,
  tally,
  weekdayOf,
  type SorouAnswer,
  type SorouEvent,
  type SorouParticipant,
} from '@/lib/tools/sorou/core'

// ── 回答した端末に渡された合言葉（回答の修正・削除に使う）──────────
const TOKEN_KEY = 'sorou:tokens:v1'
type TokenStore = Record<string, Record<string, string>> // eventId → participantId → token

function readTokens(eventId: string): Record<string, string> {
  try {
    const all = JSON.parse(localStorage.getItem(TOKEN_KEY) || '{}') as TokenStore
    return all[eventId] ?? {}
  } catch {
    return {}
  }
}
function writeToken(eventId: string, pid: string, token: string | null) {
  try {
    const all = JSON.parse(localStorage.getItem(TOKEN_KEY) || '{}') as TokenStore
    const mine = { ...(all[eventId] ?? {}) }
    if (token) mine[pid] = token
    else delete mine[pid]
    all[eventId] = mine
    localStorage.setItem(TOKEN_KEY, JSON.stringify(all))
  } catch {
    // 端末に保存できない（プライベートブラウズ等）。修正できないだけで回答はできる
  }
}

// ── 回答の印（○△×）──────────────────────
const MARK: Record<SorouAnswer, { sign: string; label: string; cls: string }> = {
  ok: { sign: '○', label: '可', cls: 'text-ds-app-accent' },
  mb: { sign: '△', label: '未定', cls: 'text-amber-600' },
  no: { sign: '×', label: '不可', cls: 'text-muted-foreground' },
}

function DateLabel({ k, t }: { k: string; t: string }) {
  const { m, d } = parseDateKey(k)
  const w = weekdayOf(k)
  return (
    <span className="inline-flex items-baseline gap-1 tabular-nums">
      <span className="font-bold">{pad2(m)}/{pad2(d)}</span>
      <span className={`text-xs ${w === 0 ? 'text-rose-600' : w === 6 ? 'text-ds-app-accent' : 'text-muted-foreground'}`}>({WEEKDAYS[w]})</span>
      <span className="text-[13px]">{t || '時刻未定'}</span>
    </span>
  )
}

type Data = { event: SorouEvent; participants: SorouParticipant[]; isOwner: boolean }

export function EventView({ id }: { id: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const justCreated = searchParams.get('created') === '1'

  const [data, setData] = useState<Data | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [tokens, setTokens] = useState<Record<string, string>>({})
  const [shareUrl, setShareUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [sortByScore, setSortByScore] = useState(false)

  // 回答フォーム
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [comment, setComment] = useState('')
  const [entry, setEntry] = useState<(SorouAnswer | null)[]>([])
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<SorouParticipant | null>(null)
  const [deleteEventOpen, setDeleteEventOpen] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/tools/sorou/events/${id}`, { cache: 'no-store' })
    if (res.status === 404) {
      setNotFound(true)
      return null
    }
    if (!res.ok) throw new Error('load failed')
    const next = (await res.json()) as Data
    setData(next)
    return next
  }, [id])

  useEffect(() => {
    setTokens(readTokens(id))
    setShareUrl(`${window.location.origin}/tools/sorou/e/${id}`)
    load()
      .then(d => { if (d) setEntry(new Array(d.event.cands.length).fill(null)) })
      .catch(() => toast.error('日程調整を読み込めませんでした'))
  }, [id, load])

  const rows = useMemo(() => (data ? tally(data.event.cands, data.participants) : []), [data])
  const best = bestScore(rows)
  const sortedRows = sortByScore ? [...rows].sort((a, b) => b.score - a.score || a.index - b.index) : rows

  const canEdit = (pid: string) => !!data?.isOwner || !!tokens[pid]

  const resetForm = (candCount: number) => {
    setEditingId(null)
    setName('')
    setComment('')
    setEntry(new Array(candCount).fill(null))
    setTouched(false)
    setFormError('')
  }

  const startEdit = (p: SorouParticipant) => {
    setEditingId(p.id)
    setName(p.name)
    setComment(p.comment)
    setEntry([...p.answers])
    setTouched(false)
    setFormError('')
    document.getElementById('sorou-answer')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('コピーできませんでした。リンクを選択してコピーしてください')
    }
  }

  const unanswered = entry.filter(v => v === null).length

  const submit = async () => {
    if (!data) return
    setTouched(true)
    if (!name.trim() || unanswered > 0) return
    setSubmitting(true)
    setFormError('')
    try {
      const body = JSON.stringify({ name: name.trim(), comment: comment.trim(), answers: entry })
      const res = editingId
        ? await fetch(`/api/tools/sorou/events/${id}/participants/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...(tokens[editingId] ? { 'x-sorou-token': tokens[editingId] } : {}) },
            body,
          })
        : await fetch(`/api/tools/sorou/events/${id}/participants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
          })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFormError(json.error || '登録できませんでした')
        return
      }
      if (!editingId && json.token && json.participant?.id) {
        writeToken(id, json.participant.id, json.token)
        setTokens(readTokens(id))
      }
      toast.success(editingId ? '回答を更新しました' : '回答を登録しました')
      const fresh = await load() // ほかの人の回答も反映する
      resetForm(fresh?.event.cands.length ?? data.event.cands.length)
    } catch {
      setFormError('登録できませんでした。通信環境を確認してもう一度お試しください。')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteParticipant = async (p: SorouParticipant) => {
    try {
      const res = await fetch(`/api/tools/sorou/events/${id}/participants/${p.id}`, {
        method: 'DELETE',
        headers: tokens[p.id] ? { 'x-sorou-token': tokens[p.id] } : {},
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error || '削除できませんでした')
        return
      }
      writeToken(id, p.id, null)
      setTokens(readTokens(id))
      if (editingId === p.id && data) resetForm(data.event.cands.length)
      toast.success('回答を削除しました')
      await load()
    } catch {
      toast.error('削除できませんでした')
    }
  }

  const deleteEvent = async () => {
    const res = await fetch(`/api/tools/sorou/events/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('削除できませんでした')
      return
    }
    toast.success('日程調整を削除しました')
    router.push('/tools/sorou/app')
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-16 text-center">
        <p className="m-0 text-base font-bold">この日程調整は見つかりませんでした</p>
        <p className="mt-2 text-[13px] text-muted-foreground">リンクが間違っているか、作成者が削除しました。</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-5 py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  const { event, participants, isOwner } = data
  const n = participants.length

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      {justCreated && isOwner && (
        <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          日程調整をつくりました。下の共有リンクを送って、回答を集めましょう。
        </div>
      )}

      <h1 className="mb-2 text-2xl font-bold text-foreground break-words">{event.title}</h1>
      {event.memo && <p className="mb-2 whitespace-pre-line text-[13px] text-muted-foreground">{event.memo}</p>}
      <p className="mb-5 text-[13px] text-muted-foreground">候補 {event.cands.length}件 ／ 回答 {n}人</p>

      {/* 共有リンク */}
      <Card className="mb-5 bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-bold">共有リンク</h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={shareUrl} onFocus={e => e.currentTarget.select()} className="h-10 bg-white" aria-label="共有リンク" />
            <Button type="button" onClick={copy} className="h-10 shrink-0 gap-1.5">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'コピーしました' : 'リンクをコピー'}
            </Button>
          </div>
          <p className="mb-0 mt-2 text-xs text-muted-foreground">回答は、このリンクを開いた全員に共有されます。回答する人はログイン不要です。</p>
          {isOwner && (
            <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
              <Button type="button" variant="outline" className="gap-1.5" onClick={() => router.push(`/tools/sorou/app/${id}/edit`)}>
                <Pencil className="h-4 w-4" />日程・時間を編集
              </Button>
              <Button type="button" variant="outline" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setDeleteEventOpen(true)}>
                <Trash2 className="h-4 w-4" />この日程調整を削除
              </Button>
              <Link href="/tools/sorou/app" className="ml-auto self-center text-xs text-muted-foreground no-underline hover:text-foreground">作成した日程調整の一覧</Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 集計 */}
      {n > 0 && (
        <Card className="mb-5 bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h2 className="m-0 text-sm font-bold">集計</h2>
              <span className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-ds-app-accent" />可</span>
                <span className="inline-flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400" />未定</span>
                <span className="inline-flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-border" />不可・未回答</span>
              </span>
              <Button type="button" variant="ghost" size="sm" className="ml-auto h-9 gap-1 text-xs" onClick={() => setSortByScore(s => !s)}>
                <ArrowUpDown className="h-3.5 w-3.5" />並び順：{sortByScore ? '参加できる人が多い順' : '候補順'}
              </Button>
            </div>
            <div className="space-y-1.5">
              {sortedRows.map(r => {
                const lead = best !== null && r.score === best
                return (
                  <div key={r.index} className={`grid grid-cols-1 items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2 sm:grid-cols-[200px_minmax(0,1fr)_auto] ${lead ? 'bg-white ring-1 ring-ds-app-accent/40' : 'bg-white/60'}`}>
                    <span className="flex items-center gap-2">
                      <DateLabel k={r.cand.k} t={r.cand.t} />
                      {lead && <span className="rounded bg-ds-app-accent px-1.5 py-0.5 text-[10px] font-bold text-white">最有力</span>}
                    </span>
                    <span className="relative h-2.5 overflow-hidden rounded-full bg-border" role="img" aria-label={`${n}人中 可${r.ok}人、未定${r.mb}人`}>
                      <span className="absolute inset-y-0 left-0 bg-ds-app-accent" style={{ width: `${(r.ok / n) * 100}%` }} />
                      <span className="absolute inset-y-0 bg-amber-400" style={{ left: `${(r.ok / n) * 100}%`, width: `${(r.mb / n) * 100}%` }} />
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      可 <b className="text-foreground">{r.ok}</b>　未定 {r.mb}　不可 {r.no}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 回答表 */}
      {n > 0 && (
        <Card className="mb-5 bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <h2 className="mb-3 text-sm font-bold">回答表</h2>
            <div className="overflow-x-auto rounded-lg border bg-white">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="sticky left-0 bg-white px-3 py-2 text-left text-xs font-medium text-muted-foreground">候補日</th>
                    {participants.map(p => (
                      <th key={p.id} className="min-w-[88px] px-2 py-2 text-center font-medium">
                        <span className="inline-flex items-center gap-0.5">
                          {canEdit(p.id) ? (
                            <button type="button" onClick={() => startEdit(p)} className="max-w-[120px] truncate text-ds-app-accent underline-offset-2 hover:underline" title="回答を修正">
                              {p.name}
                            </button>
                          ) : (
                            <span className="max-w-[120px] truncate">{p.name}</span>
                          )}
                          {canEdit(p.id) && (
                            <button type="button" onClick={() => setDeleteTarget(p)} className="inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-destructive" aria-label={`${p.name}の回答を削除`}>
                              <X size={14} />
                            </button>
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {event.cands.map((c, i) => (
                    <tr key={i} className="border-b last:border-b-0">
                      <th scope="row" className="sticky left-0 whitespace-nowrap bg-white px-3 py-2 text-left font-normal">
                        <DateLabel k={c.k} t={c.t} />
                      </th>
                      {participants.map(p => {
                        const v = p.answers[i]
                        return (
                          <td key={p.id} className="px-2 py-2 text-center">
                            {v ? (
                              <span className={`text-base font-bold ${MARK[v].cls}`} role="img" aria-label={MARK[v].label}>{MARK[v].sign}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground" aria-label="未回答">—</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t">
                    <th scope="row" className="sticky left-0 bg-white px-3 py-2 text-left text-xs font-medium text-muted-foreground">コメント</th>
                    {participants.map(p => (
                      <td key={p.id} className="px-2 py-2 text-center text-xs text-muted-foreground">{p.comment || '—'}</td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="mb-0 mt-2 text-xs text-muted-foreground">
              {isOwner ? '名前を押すと、その回答を修正できます。' : 'この端末で登録した回答は、名前を押すと修正できます。'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* 回答フォーム */}
      <Card id="sorou-answer" className="scroll-mt-20 bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">
          <h2 className="mb-4 text-sm font-bold">
            {editingId ? '回答を修正' : '回答する'}
          </h2>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold">名前 <span className="font-normal text-red-500">*</span></span>
              <Input value={name} onChange={e => setName(e.target.value)} maxLength={SOROU_LIMITS.name} placeholder="お名前" className="h-10 bg-white" aria-invalid={touched && !name.trim()} />
              {touched && !name.trim() && <span className="mt-1 block text-xs text-red-500">名前を入力してください。</span>}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold">コメント <span className="font-normal text-gray-400">（任意）</span></span>
              <Input value={comment} onChange={e => setComment(e.target.value)} maxLength={SOROU_LIMITS.comment} placeholder="例：19時以降なら参加できます" className="h-10 bg-white" />
            </label>
          </div>

          <div className="divide-y rounded-lg border bg-white">
            {event.cands.map((c, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <DateLabel k={c.k} t={c.t} />
                <div className="inline-flex overflow-hidden rounded-md border" role="radiogroup" aria-label={candLabel(c)}>
                  {(['ok', 'mb', 'no'] as const).map(v => {
                    const on = entry[i] === v
                    return (
                      <button
                        key={v}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setEntry(prev => prev.map((x, j) => (j === i ? v : x)))}
                        className={`flex h-11 min-w-[64px] items-center justify-center gap-1 border-l px-3 text-sm first:border-l-0 transition-colors ${
                          on ? 'bg-foreground text-background font-bold' : 'bg-white hover:bg-muted'
                        }`}
                      >
                        <span className={on ? '' : MARK[v].cls}>{MARK[v].sign}</span>{MARK[v].label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setEntry(entry.map(() => 'ok'))}>すべて可</Button>
            <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setEntry(entry.map(() => 'no'))}>すべて不可</Button>
            <span className="ml-auto text-xs text-muted-foreground">
              {unanswered ? <>未入力 <b className="text-foreground">{unanswered}</b> 件</> : '入力済み'}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t pt-4">
            {touched && unanswered > 0 && <span className="mr-auto text-xs text-red-500">{unanswered}件が未入力です。</span>}
            {formError && <span className="mr-auto text-xs text-red-500">{formError}</span>}
            {editingId && (
              <Button type="button" variant="outline" onClick={() => resetForm(event.cands.length)} disabled={submitting}>修正をやめる</Button>
            )}
            <Button type="button" onClick={submit} disabled={submitting}>
              {submitting ? '送信中…' : editingId ? '回答を更新する' : '回答を登録する'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {!isOwner && (
        <p className="mt-8 text-center text-xs text-muted-foreground">
          この日程調整は <Link href="/tools/sorou" className="text-ds-app-accent">branding.bz の日程調整ツール</Link> でつくられています。
        </p>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>「{deleteTarget?.name}」さんの回答を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>削除すると元に戻せません。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteTarget) deleteParticipant(deleteTarget); setDeleteTarget(null) }}
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteEventOpen} onOpenChange={setDeleteEventOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>この日程調整を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{event.title}」と、{n}人分の回答を削除します。共有リンクも開けなくなります。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={deleteEvent}>
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
