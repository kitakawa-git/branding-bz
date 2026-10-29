'use client'

// 日程調整ツール — 自分が作った日程調整の一覧（ログイン後の入口）
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, ArrowRight, Users, CalendarDays } from 'lucide-react'
import { candLabel, type SorouCand } from '@/lib/tools/sorou/core'
import { useRequireLogin } from './useRequireLogin'

type EventSummary = {
  id: string
  title: string
  memo: string
  cands: SorouCand[]
  created_at: string
  participant_count: number
}

export default function SorouAppPage() {
  const { ready } = useRequireLogin()
  const router = useRouter()
  const [events, setEvents] = useState<EventSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/tools/sorou/events')
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) setError(data.error || '一覧を取得できませんでした')
        else setEvents(data.events ?? [])
      } catch {
        if (!cancelled) setError('一覧を取得できませんでした')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [ready])

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">日程調整</h1>
          <p className="m-0 text-[13px] text-muted-foreground">候補日を選んで共有リンクを送るだけ。回答する人はログイン不要です。</p>
        </div>
        <Button onClick={() => router.push('/tools/sorou/app/new')} className="shrink-0 gap-1.5">
          <Plus className="h-4 w-4" />
          新しく作る
        </Button>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {!ready || loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border bg-white p-4">
              <Skeleton className="mb-2 h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-[hsl(0_0%_97%)] p-8 text-center">
          <p className="m-0 text-sm text-muted-foreground">まだ日程調整がありません。</p>
          <Button onClick={() => router.push('/tools/sorou/app/new')} className="mt-4 gap-1.5">
            <Plus className="h-4 w-4" />
            最初の日程調整をつくる
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(e => {
            const first = e.cands[0]
            const last = e.cands[e.cands.length - 1]
            return (
              <Link
                key={e.id}
                href={`/tools/sorou/e/${e.id}`}
                className="group flex items-center gap-3 rounded-xl border bg-white p-4 no-underline transition-colors hover:border-ds-app-accent hover:bg-blue-50/30"
              >
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-sm font-bold text-gray-900">{e.title}</p>
                  <p className="m-0 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      候補 {e.cands.length}件{first ? `（${candLabel(first).split(' ')[0]}${last && last.k !== first.k ? `〜${candLabel(last).split(' ')[0]}` : ''}）` : ''}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      回答 {e.participant_count}人
                    </span>
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-gray-400 transition-colors group-hover:text-ds-app-accent" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
