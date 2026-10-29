'use client'

// 日程調整ツール — 日程・時間を編集（作成者のみ）
import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { EventEditor, type EventDraft } from '../../../components/EventEditor'
import { candsToSelection } from '../../../components/CandidatePicker'
import { useRequireLogin } from '../../useRequireLogin'

export default function SorouEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { ready } = useRequireLogin()
  const router = useRouter()
  const [initial, setInitial] = useState<EventDraft | null>(null)
  const [hasAnswers, setHasAnswers] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!ready) return
    ;(async () => {
      const res = await fetch(`/api/tools/sorou/events/${id}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.isOwner) {
        setLoadError('この日程調整は編集できません（作成した本人だけが編集できます）')
        return
      }
      setInitial({ title: data.event.title, memo: data.event.memo, sel: candsToSelection(data.event.cands) })
      setHasAnswers((data.participants ?? []).length > 0)
    })()
  }, [ready, id])

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <Link href={`/tools/sorou/e/${id}`} className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground no-underline hover:text-foreground">
        <ArrowLeft size={14} />日程調整へ戻る
      </Link>
      <h1 className="mb-2 text-2xl font-bold text-foreground">日程・時間を編集</h1>
      <p className="mb-5 text-[13px] text-muted-foreground">時刻の間違いなどを後から直せます。</p>
      {loadError ? (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{loadError}</div>
      ) : !initial ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      ) : (
        <EventEditor
          initial={initial}
          hasAnswers={hasAnswers}
          submitLabel="変更を保存"
          submitting={submitting}
          error={error}
          onCancel={() => router.push(`/tools/sorou/e/${id}`)}
          onSubmit={async draft => {
            setSubmitting(true)
            setError('')
            try {
              const res = await fetch(`/api/tools/sorou/events/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(draft),
              })
              const data = await res.json().catch(() => ({}))
              if (!res.ok) {
                setError(data.error || '保存できませんでした')
                setSubmitting(false)
                return
              }
              router.push(`/tools/sorou/e/${id}`)
            } catch {
              setError('保存できませんでした。通信環境を確認してもう一度お試しください。')
              setSubmitting(false)
            }
          }}
        />
      )}
    </div>
  )
}
