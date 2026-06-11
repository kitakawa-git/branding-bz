'use client'

// 理解度テスト 受験状況ページ（リマインド用途）
// ★スコアは一切表示しない。results（集計）とは別エンドポイント・別画面。
//   「誰が受けたか」だけを扱い、個人×スコアのマッピングは作らない。
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, CheckCircle2, Circle, Info } from 'lucide-react'
import { QuizTabs } from '../QuizTabs'

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: '下書き', className: 'bg-gray-100 text-gray-700' },
  active: { label: '実施中', className: 'bg-green-100 text-green-700' },
  closed: { label: '終了', className: 'bg-blue-100 text-ds-app-accent-hover' },
  archived: { label: 'アーカイブ', className: 'bg-gray-100 text-gray-500' },
}

type Person = { profile_id: string; name: string | null; department: string | null }
type QuizMeta = { id: string; title: string; status: string }

export default function QuizParticipantsPage() {
  const params = useParams()
  const router = useRouter()
  const quizId = params.id as string

  const [meta, setMeta] = useState<QuizMeta | null>(null)
  const [responded, setResponded] = useState<Person[]>([])
  const [notResponded, setNotResponded] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (!quizId) return
    try {
      const [quizRes, partRes] = await Promise.all([
        fetch(`/api/brand-score/quizzes/${quizId}`),
        fetch(`/api/brand-score/quizzes/${quizId}/participants`),
      ])
      if (quizRes.ok) {
        const q = await quizRes.json()
        setMeta({ id: q.quiz.id, title: q.quiz.title, status: q.quiz.status })
      }
      if (partRes.ok) {
        const data = await partRes.json()
        setResponded(data.responded || [])
        setNotResponded(data.not_responded || [])
      }
    } catch (err) {
      console.error('[QuizParticipants] 取得エラー:', err)
    } finally {
      setLoading(false)
    }
  }, [quizId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-64 mb-6" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const statusConfig = meta ? STATUS_CONFIG[meta.status] || STATUS_CONFIG.draft : null
  const total = responded.length + notResponded.length

  const renderList = (people: Person[], emptyText: string) =>
    people.length > 0 ? (
      <div className="divide-y">
        {people.map((p) => (
          <div key={p.profile_id} className="flex items-center justify-between py-2.5">
            <span className="text-sm text-foreground">{p.name ?? '（氏名未設定）'}</span>
            <span className="text-xs text-muted-foreground">{p.department ?? '—'}</span>
          </div>
        ))}
      </div>
    ) : (
      <p className="text-xs text-muted-foreground py-2">{emptyText}</p>
    )

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => router.push('/admin/brand-score/quizzes')}>
          <ArrowLeft size={18} />
        </Button>
        <h1 className="text-lg font-bold text-foreground flex-1 truncate">{meta?.title ?? '受験状況'}</h1>
        {statusConfig && (
          <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${statusConfig.className}`}>
            {statusConfig.label}
          </Badge>
        )}
      </div>

      <QuizTabs quizId={quizId} />

      {/* スコア非表示の明示注記 */}
      <div className="flex items-start gap-2 mb-4 text-xs text-muted-foreground bg-muted/40 rounded-md p-3">
        <Info size={14} className="shrink-0 mt-0.5" />
        <span>
          受験の有無のみを表示します（リマインド用途）。個人のスコアはここには表示されません。点数は集計（部署平均）として「結果」タブでのみ確認できます。
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 text-green-700">
              <CheckCircle2 size={16} /> 受験済み（{responded.length}/{total}）
            </h2>
            {renderList(responded, 'まだ受験者はいません')}
          </CardContent>
        </Card>

        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 text-muted-foreground">
              <Circle size={16} /> 未受験（{notResponded.length}/{total}）
            </h2>
            {renderList(notResponded, '全員が受験済みです')}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
