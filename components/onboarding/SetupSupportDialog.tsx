'use client'

// 入力サポート（オンライン相談）の申し込みダイアログ。
//
// 以前は外部の問い合わせフォームに飛ばしていたが、サービスサイトに出てしまい
// 「アプリの中で助けてもらえる」感じが切れていた。ログインしたまま完結させる。
//
// カレンダー連携はしないので、その場で日程は確定しない。
// その前提が伝わらないと「予約したのに何も起きない」と受け取られるため、
// 画面には毎回「担当者から連絡して日程を決める」と書く。
import { useEffect, useState } from 'react'
import { CalendarCheck, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

type PendingRequest = {
  id: string
  preferred_slots: string | null
  note: string | null
  created_at: string
}

export function SetupSupportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [preferredSlots, setPreferredSlots] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingRequest | null>(null)
  const [done, setDone] = useState(false)

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
        setPreferredSlots(p?.preferred_slots ?? '')
        setNote(p?.note ?? '')
      })
      .catch(() => {})
  }, [open])

  const submit = async () => {
    if (!preferredSlots.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/setup-support-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferredSlots: preferredSlots.trim(),
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
                担当者からご連絡して、日程を確定します。
                オンラインで画面を見ながら一緒に入力しますので、準備は不要です。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-foreground px-6 text-sm font-bold text-background"
              >
                閉じる
              </button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>入力サポートを申し込む</DialogTitle>
              <DialogDescription>
                オンラインで画面を見ながら、担当者が入力をサポートします。完全無料です。
                この場で日程は確定しません。ご希望をもとに担当者からご連絡します。
              </DialogDescription>
            </DialogHeader>

            {pending && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                お申し込みを受付中です。内容を変えて送り直すと、この依頼を差し替えます。
              </p>
            )}

            <div>
              <label htmlFor="support-slots" className="mb-1 block text-sm font-medium">
                ご希望の日時
              </label>
              <Textarea
                id="support-slots"
                value={preferredSlots}
                onChange={(e) => setPreferredSlots(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="例: 平日の午後なら / 来週の火曜・水曜の10時以降 / お任せします"
              />
              <p className="m-0 mt-1 text-xs text-muted-foreground">
                おおまかで構いません。「お任せします」でも大丈夫です。
              </p>
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
              <p className="m-0 mt-1 text-xs text-muted-foreground">
                「何から書けばいいか分からない」の段階からご相談ください。
                現在のセットアップの進み具合は自動で担当者に共有されます。
              </p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <DialogFooter>
              <button
                type="button"
                onClick={submit}
                disabled={!preferredSlots.trim() || saving}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-foreground px-6 text-sm font-bold text-background disabled:opacity-40"
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
