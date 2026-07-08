'use client'

// ブランドパーソナリティ診断 — ステップ管理ページ
// current_step に基づいて Step1〜5 のコンポーネントを動的レンダリング
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { StepProgressBar } from '@/components/shared/StepProgressBar'
import { Step1BasicInfo } from './components/Step1BasicInfo'
import { Step2Questions } from './components/Step2Questions'
import { Step3Questions } from './components/Step3Questions'
import { Step4Diagnosis } from './components/Step4Diagnosis'
import { Step5Result } from './components/Step5Result'
import type { DiagnosisAnswers, FrameworkKey } from '../../lib/questions'

/* eslint-disable @typescript-eslint/no-explicit-any */
interface PersonalitySessionData {
  current_step: number
  basic_info: any
  framework: FrameworkKey | ''
  answers: DiagnosisAnswers
  diagnosis: any
  completed: boolean
}
/* eslint-enable @typescript-eslint/no-explicit-any */

interface PersonalitySession {
  id: string
  user_id: string
  app_type: string
  status: string
  current_step: number
  session_data: PersonalitySessionData
  company_id: string | null
  created_at: string
}

const STEP_DEFINITIONS = [
  { label: '基本情報' },
  { label: '診断質問 1/2' },
  { label: '診断質問 2/2' },
  { label: 'AI診断' },
  { label: '結果' },
]

export default function PersonalitySessionPage() {
  const params = useParams()
  const sessionId = params.sessionId as string

  const [session, setSession] = useState<PersonalitySession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // セッションデータ取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/tools/personality/sessions/${sessionId}`)
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
      const res = await fetch(`/api/tools/personality/sessions/${sessionId}`, {
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
            ? { ...prev.session_data, ...sessionData } as PersonalitySessionData
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
      await fetch(`/api/tools/personality/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionData }),
      })
      setSession(prev => {
        if (!prev) return prev
        return {
          ...prev,
          session_data: { ...prev.session_data, ...sessionData } as PersonalitySessionData,
        }
      })
    } catch {
      console.error('[Personality AutoSave] 保存エラー')
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
  const sd = session.session_data

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      {/* プログレスバー */}
      <StepProgressBar
        steps={STEP_DEFINITIONS}
        currentStep={currentStep}
        className="mb-8"
      />

      {/* ステップコンテンツ */}
      {currentStep === 1 && (
        <Step1BasicInfo
          basicInfo={sd.basic_info || {}}
          framework={sd.framework || ''}
          onNext={(data, framework) => saveAndAdvance(2, { basic_info: data, framework })}
          onSaveField={(data, framework) => saveField({ basic_info: data, framework })}
        />
      )}
      {currentStep === 2 && (
        <Step2Questions
          answers={sd.answers || {}}
          onNext={(answers) => saveAndAdvance(3, { answers })}
          onBack={() => saveAndAdvance(1)}
          onSaveField={(answers) => saveField({ answers })}
        />
      )}
      {currentStep === 3 && (
        <Step3Questions
          answers={sd.answers || {}}
          onNext={(answers) => saveAndAdvance(4, { answers })}
          onBack={() => saveAndAdvance(2)}
          onSaveField={(answers) => saveField({ answers })}
        />
      )}
      {currentStep === 4 && (
        <Step4Diagnosis
          sessionId={sessionId}
          hasDiagnosis={!!sd.diagnosis && Object.keys(sd.diagnosis).length > 0}
          onComplete={(diagnosis) =>
            saveAndAdvance(5, Object.keys(diagnosis).length > 0 ? { diagnosis } : undefined)
          }
          onBack={() => saveAndAdvance(3)}
        />
      )}
      {currentStep === 5 && (
        <Step5Result
          sessionId={sessionId}
          framework={sd.framework || ''}
          diagnosis={sd.diagnosis && Object.keys(sd.diagnosis).length > 0 ? sd.diagnosis : null}
          companyName={sd.basic_info?.company_name || ''}
          onSaveField={(data) => saveField(data)}
          onBack={() => saveAndAdvance(4)}
        />
      )}
    </div>
  )
}
