'use client'

// 未受験のブランド理解度テストのバナー通知（サーベイバナーをミラー）
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePortalAuth } from './PortalDataProvider'
import { Button } from '@/components/ui/button'
import { ClipboardCheck } from 'lucide-react'

type PendingQuiz = {
  id: string
  title: string
}

export function QuizBanner() {
  const router = useRouter()
  const { user, companyId } = usePortalAuth()
  const [quiz, setQuiz] = useState<PendingQuiz | null>(null)

  useEffect(() => {
    if (!user?.id || !companyId) return

    const fetchPending = async () => {
      try {
        const res = await fetch('/api/brand-score/quizzes/pending')
        if (!res.ok) return
        const data = await res.json()
        if (data.quizzes?.length > 0) {
          setQuiz({ id: data.quizzes[0].id, title: data.quizzes[0].title })
        }
      } catch {
        // バナーなのでエラーは無視
      }
    }

    fetchPending()
  }, [user?.id, companyId])

  if (!quiz) return null

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-4">
      <div className="shrink-0 text-ds-app-accent">
        <ClipboardCheck size={24} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-base font-semibold text-foreground m-0">
          ブランド理解度テストにご回答ください
        </p>
        <p className="text-sm text-muted-foreground m-0 mt-0.5 truncate">{quiz.title}</p>
      </div>
      <Button onClick={() => router.push(`/portal/quiz/${quiz.id}`)} className="shrink-0 h-11 px-5 rounded-full">
        受験する
      </Button>
    </div>
  )
}
