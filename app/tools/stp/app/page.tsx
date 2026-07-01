'use client'

// STP分析ツール — セッション履歴一覧（認証後の入口）
// 過去セッション（進行中・完了）から選んで再開、または新規作成。
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, ArrowRight, Clock, CheckCircle2 } from 'lucide-react'

interface SessionSummary {
  id: string
  status: 'in_progress' | 'completed' | string
  current_step: number
  company_name: string
  main_target: string
  created_at: string
  updated_at: string
}

const STEP_LABELS = ['', '基本情報', 'セグメンテーション', 'ターゲティング', 'ポジショニング', '確認・出力']

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export default function STPAppPage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.replace('/portal/auth?from=stp')
          return
        }
        setUserId(user.id)
        const res = await fetch(`/api/tools/stp/sessions?userId=${user.id}`)
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          setError(d.error || 'セッション一覧の取得に失敗しました')
          return
        }
        const { sessions } = await res.json()
        setSessions(sessions || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'エラーが発生しました')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router])

  const createNew = useCallback(async () => {
    if (!userId || creating) return
    setCreating(true)
    setError('')
    try {
      const res = await fetch('/api/tools/stp/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, forceNew: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '新規セッションの作成に失敗しました')
        setCreating(false)
        return
      }
      router.push(`/tools/stp/app/${data.sessionId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
      setCreating(false)
    }
  }, [userId, creating, router])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <span className="text-sm font-bold">branding.bz <span className="font-normal text-muted-foreground">STP分析ツール</span></span>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">分析セッション</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">続きから再開するか、新しい分析を始めましょう。</p>
          </div>
          <Button onClick={createNew} disabled={creating} className="gap-1.5">
            <Plus className="h-4 w-4" />
            {creating ? '作成中…' : '新規作成'}
          </Button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-white p-4">
                <Skeleton className="mb-2 h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-[hsl(0_0%_97%)] p-8 text-center">
            <p className="text-sm text-muted-foreground">まだ分析セッションがありません。</p>
            <Button onClick={createNew} disabled={creating} className="mt-4 gap-1.5">
              <Plus className="h-4 w-4" />
              最初の分析を始める
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => {
              const isCompleted = s.status === 'completed'
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => router.push(`/tools/stp/app/${s.id}`)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-border bg-white p-4 text-left transition-colors hover:border-ds-app-accent hover:bg-blue-50/30"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold text-gray-900">
                        {s.company_name || '（無題の分析）'}
                      </span>
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {isCompleted ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {isCompleted ? '完了' : '作成中'}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {s.main_target ? `ターゲット: ${s.main_target}` : `${STEP_LABELS[s.current_step] || `Step ${s.current_step}`} まで入力`}
                      {' ・ '}更新 {formatDate(s.updated_at)}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-gray-400 transition-colors group-hover:text-ds-app-accent" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
