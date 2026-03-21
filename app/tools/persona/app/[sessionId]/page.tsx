'use client'

// ペルソナビルダー — ステップ管理ページ
// current_step に基づいて Step1〜5 のコンポーネントを動的レンダリング
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { StepProgressBar } from '@/components/shared/StepProgressBar'
import { StepPlaceholder } from './components/StepPlaceholder'

// ペルソナセッションデータの型
interface PersonaSessionData {
  current_step: number
  basic_info: Record<string, unknown>
  target_info: Record<string, unknown>
  demographics: Record<string, unknown>
  goals: Record<string, unknown>
  journey_map: Record<string, unknown>
  completed: boolean
}

interface PersonaSession {
  id: string
  user_id: string
  app_type: string
  status: string
  current_step: number
  session_data: PersonaSessionData
  company_id: string | null
  created_at: string
}

const STEP_DEFINITIONS = [
  { label: '基本情報', description: '企業情報とターゲットの選択' },
  { label: 'デモグラフィック', description: 'AIがペルソナの属性を提案' },
  { label: 'ゴール・課題', description: '目標や悩み、購買行動を深掘り' },
  { label: 'ジャーニーマップ', description: 'AIが5段階のカスタマージャーニーを生成' },
  { label: '確認・出力', description: 'ペルソナシートとジャーニーマップをPDF出力' },
]

export default function PersonaSessionPage() {
  const params = useParams()
  const sessionId = params.sessionId as string

  const [session, setSession] = useState<PersonaSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // セッションデータ取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/tools/persona/sessions/${sessionId}`)
        if (!res.ok) {
          const data = await res.json()
          setError(data.error || 'データの取得に失敗しました')
          return
        }

        const { session: s } = await res.json()
        setSession(s)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'エラーが発生しました')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [sessionId])

  // ステップ進行 + データ保存
  const saveAndAdvance = useCallback(async (
    nextStep: number,
    sessionData?: Record<string, unknown>
  ) => {
    try {
      const res = await fetch(`/api/tools/persona/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: nextStep, sessionData }),
      })

      if (!res.ok) {
        const resData = await res.json()
        toast.error(resData.error || '保存に失敗しました')
        return false
      }

      setSession(prev => {
        if (!prev) return prev
        return {
          ...prev,
          current_step: nextStep,
          session_data: sessionData
            ? { ...prev.session_data, ...sessionData } as PersonaSessionData
            : prev.session_data,
        }
      })
      return true
    } catch {
      toast.error('保存中にエラーが発生しました')
      return false
    }
  }, [sessionId])

  // 部分保存（オートセーブ用、ステップ変更なし）
  const saveField = useCallback(async (sessionData: Record<string, unknown>) => {
    try {
      await fetch(`/api/tools/persona/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionData }),
      })
      setSession(prev => {
        if (!prev) return prev
        return {
          ...prev,
          session_data: { ...prev.session_data, ...sessionData } as PersonaSessionData,
        }
      })
    } catch {
      console.error('[Persona AutoSave] 保存エラー')
    }
  }, [sessionId])

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Skeleton className="mb-8 h-10 w-full" />
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="mb-2 h-12 w-full" />
        <Skeleton className="mb-2 h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-lg bg-red-50 px-6 py-4 text-sm text-red-600">
          {error || 'セッションデータが見つかりません'}
        </div>
      </div>
    )
  }

  const currentStep = session.current_step

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      {/* プログレスバー */}
      <StepProgressBar
        steps={STEP_DEFINITIONS.map(s => ({ label: s.label }))}
        currentStep={currentStep}
        className="mb-8"
      />

      {/* ステップコンテンツ（全ステップPlaceholder） */}
      {currentStep >= 1 && currentStep <= 5 && (
        <StepPlaceholder
          stepNumber={currentStep}
          title={STEP_DEFINITIONS[currentStep - 1].label}
          description={STEP_DEFINITIONS[currentStep - 1].description}
          onNext={currentStep < 5 ? () => saveAndAdvance(currentStep + 1) : undefined}
          onBack={currentStep > 1 ? () => saveAndAdvance(currentStep - 1) : undefined}
          isLast={currentStep === 5}
        />
      )}
    </div>
  )
}
