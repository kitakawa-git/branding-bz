'use client'

// プラン変更の依頼ダイアログ（契約者側）
//
// 決済を自前で持たないので、その場でプランは変わらない。
// 「どのプランにしたいか」を受け取ってスーパー管理に積み、こちらで反映する。
// その前提が伝わらないと「押したのに変わらない」と受け取られるため、
// 画面には毎回「依頼を受けてこちらで手続きする」と書く。
import { useEffect, useState } from 'react'
import { Check, Loader2, Send } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { SELLABLE_PLANS, type Plan } from '@/lib/billing/entitlements'
import { PLAN_LABELS, PLAN_TONES } from '@/lib/billing/plan-display'

/**
 * 料金ページ（app/(site)/plan）と同じ並び・同じ言い回しに揃える。
 * ダイアログは幅が狭いので summary は料金ページの description を短縮した版だが、
 * 使う語（AI構築ツール／CIマニュアル 等）は必ず料金ページと同じにする。
 * 料金ページの description を直したらここも直す。
 */
const PLAN_CARDS: Record<string, { price: string; suffix: string | null; summary: string }> = {
  free: {
    price: '¥0',
    suffix: null,
    summary: 'AI構築ツールでブランドを言語化し、掲示として形にする。',
  },
  standard: {
    price: '¥19,800',
    suffix: '/月（税別）',
    summary: 'AI構築ツール無制限。CIマニュアルとスマート名刺で届ける。',
  },
  premium: {
    price: '¥59,800',
    suffix: '/月（税別）',
    summary: '構築から浸透まで全機能。社員が学び、体現できる仕組みに。',
  },
  enterprise: {
    price: '個別見積',
    suffix: null,
    summary: '300名超の組織や複数ブランドの統合管理を、伴走つきで。',
  },
}

type PendingRequest = {
  id: string
  requested_plan: string
  note: string | null
  created_at: string
}

export function PlanChangeRequestDialog({
  open,
  onOpenChange,
  currentPlan,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 実効プラン。同じプランは選べないようにする */
  currentPlan: Plan
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingRequest | null>(null)
  const [done, setDone] = useState(false)

  // 開くたびに現状を取り直す。前回の依頼が残っていれば、それを初期選択にする
  useEffect(() => {
    if (!open) return
    setError(null)
    setDone(false)
    fetch('/api/plan-change-requests')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const p: PendingRequest | null = data?.pending ?? null
        setPending(p)
        setSelected(p?.requested_plan ?? null)
        setNote(p?.note ?? '')
      })
      .catch(() => {})
  }, [open])

  const submit = async () => {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/plan-change-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestedPlan: selected, note: note.trim() || null }),
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
              <DialogTitle>依頼を受け付けました</DialogTitle>
              <DialogDescription>
                {PLAN_LABELS[selected ?? ''] ?? selected} への変更依頼を担当者に送りました。
                内容を確認したうえでこちらでプランを切り替えます。切り替わるまでは今のプランのままです。
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
              <DialogTitle>プラン変更をリクエスト</DialogTitle>
              <DialogDescription>
                この場でプランは変わりません。依頼を受けてこちらで手続きし、確認のうえ切り替えます。
              </DialogDescription>
            </DialogHeader>

            {pending && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {PLAN_LABELS[pending.requested_plan] ?? pending.requested_plan} への依頼を受付中です。
                内容を変えて送り直すと、この依頼を差し替えます。
              </p>
            )}

            <div className="space-y-2">
              {SELLABLE_PLANS.map((plan) => {
                const card = PLAN_CARDS[plan]
                const isCurrent = plan === currentPlan
                const isSelected = plan === selected
                return (
                  <button
                    key={plan}
                    type="button"
                    disabled={isCurrent}
                    onClick={() => setSelected(plan)}
                    aria-pressed={isSelected}
                    className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                      isCurrent
                        ? 'cursor-not-allowed border-border bg-muted/50 opacity-60'
                        : isSelected
                          ? 'border-foreground bg-muted/40'
                          : 'border-border hover:bg-muted/30'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${
                        isSelected ? 'border-foreground bg-foreground text-background' : 'border-border'
                      }`}
                    >
                      {isSelected && <Check size={13} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${PLAN_TONES[plan]}`}
                        >
                          {PLAN_LABELS[plan]}
                        </span>
                        <span className="text-base font-bold text-foreground">{card.price}</span>
                        {card.suffix && (
                          <span className="text-xs text-muted-foreground">{card.suffix}</span>
                        )}
                        {isCurrent && (
                          <span className="text-xs font-medium text-muted-foreground">
                            現在のプラン
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {card.summary}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>

            <div>
              <label htmlFor="plan-request-note" className="mb-1 block text-sm font-medium">
                担当者への伝達事項（任意）
              </label>
              <Textarea
                id="plan-request-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="利用人数、開始したい時期、相談したいことなど"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <DialogFooter>
              <button
                type="button"
                onClick={submit}
                disabled={!selected || saving}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-foreground px-6 text-sm font-bold text-background disabled:opacity-40"
              >
                {saving ? (
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Send size={15} aria-hidden="true" />
                )}
                {pending ? 'この内容で依頼し直す' : 'この内容で依頼する'}
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
