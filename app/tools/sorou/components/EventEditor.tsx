'use client'

// 日程調整の作成・編集フォーム（概要 + 候補日程）。新規作成と「日程・時間を編集」で共用
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CandidatePicker, countSelection, selectionToCands, type CandSelection } from './CandidatePicker'
import { SOROU_LIMITS } from '@/lib/tools/sorou/core'

export type EventDraft = { title: string; memo: string; sel: CandSelection }

type Props = {
  initial: EventDraft
  /** 編集時、回答がすでにある */
  hasAnswers?: boolean
  submitLabel: string
  submitting: boolean
  error: string
  onSubmit: (draft: { title: string; memo: string; cands: ReturnType<typeof selectionToCands> }) => void
  onCancel?: () => void
}

export function EventEditor({ initial, hasAnswers, submitLabel, submitting, error, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState(initial.title)
  const [memo, setMemo] = useState(initial.memo)
  const [sel, setSel] = useState<CandSelection>(initial.sel)
  const [touched, setTouched] = useState(false)

  const total = countSelection(sel)
  const titleMissing = touched && !title.trim()
  const candsMissing = touched && total === 0

  const submit = () => {
    setTouched(true)
    if (!title.trim() || total === 0) return
    onSubmit({ title: title.trim(), memo: memo.trim(), cands: selectionToCands(sel) })
  }

  return (
    <>
      <Card className="mb-5 bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">
          <div className="mb-5">
            <h2 className="mb-3 text-sm font-bold">
              イベント名 <span className="text-xs font-normal text-red-500">*</span>
            </h2>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={SOROU_LIMITS.title}
              placeholder="例：ブランド定例ミーティング"
              className="h-10 bg-white"
              aria-invalid={titleMissing}
            />
            {titleMissing && <p className="mt-1.5 text-xs text-red-500">イベント名を入力してください。</p>}
          </div>
          <div>
            <h2 className="mb-3 text-sm font-bold">
              メモ <span className="text-xs font-normal text-gray-400">（任意）</span>
            </h2>
            <Input
              value={memo}
              onChange={e => setMemo(e.target.value)}
              maxLength={SOROU_LIMITS.memo}
              placeholder="会場、所要時間、持ち物など"
              className="h-10 bg-white"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-bold">
            候補日程 <span className="text-xs font-normal text-red-500">*</span>
          </h2>
          <CandidatePicker value={sel} onChange={setSel} />
          {candsMissing && <p className="mt-3 text-xs text-red-500">候補日程を1件以上選んでください。</p>}
        </CardContent>
      </Card>

      {hasAnswers && (
        <p className="mt-4 text-[13px] text-muted-foreground">
          回答が入っている候補の日付・時刻を変えたり消したりすると、その候補の回答は消えます。変えていない候補の回答はそのまま残ります。
        </p>
      )}

      <div className="sticky bottom-0 -mx-5 mt-6 flex items-center justify-between gap-3 border-t border-border bg-background/80 px-5 py-3 backdrop-blur">
        <span className="text-sm text-muted-foreground">
          {total ? `${Object.keys(sel).length}日 ／ 候補 ${total}件` : '候補を選んでください'}
        </span>
        <div className="flex items-center gap-2">
          {error && <span className="hidden text-xs text-red-500 sm:inline">{error}</span>}
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>やめる</Button>
          )}
          <Button type="button" onClick={submit} disabled={submitting}>
            {submitting ? '保存中…' : submitLabel}
          </Button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-500 sm:hidden">{error}</p>}
    </>
  )
}
