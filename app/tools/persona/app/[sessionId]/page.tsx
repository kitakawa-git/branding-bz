'use client'

// ペルソナビルダー — ステップ管理ページ
// current_step に基づいて Step1〜5 のコンポーネントを動的レンダリング
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { StepProgressBar } from '@/components/shared/StepProgressBar'
import { Step1BasicInfo } from './components/Step1BasicInfo'
import { Step2Demographics } from './components/Step2Demographics'
import { Step3Goals } from './components/Step3Goals'
import { Step4Journey } from './components/Step4Journey'
import { Step5Result } from './components/Step5Result'

// ペルソナセッションデータの型
/* eslint-disable @typescript-eslint/no-explicit-any */
interface PersonaSessionData {
  current_step: number
  basic_info: any
  target_info: any
  demographics: any
  candidates: any
  selected_candidate_ids: any
  personas: any
  goals: any
  journey_map: any
  completed: boolean
}
/* eslint-enable @typescript-eslint/no-explicit-any */

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
  { label: '基本情報' },
  { label: 'ペルソナ構築' },
  { label: 'ゴール・課題' },
  { label: 'ジャーニーマップ' },
  { label: '確認・出力' },
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
          onNext={(data) => saveAndAdvance(2, { basic_info: data })}
          onSaveField={(data) => saveField({ basic_info: data })}
        />
      )}
      {currentStep === 2 && (
        <Step2Demographics
          step2Data={{
            candidates: sd.candidates || [],
            selected_candidate_ids: sd.selected_candidate_ids || [],
            personas: sd.personas || [],
          }}
          basicInfo={sd.basic_info || {}}
          onNext={(data) => saveAndAdvance(3, {
            candidates: data.candidates,
            selected_candidate_ids: data.selected_candidate_ids,
            personas: data.personas,
          })}
          onBack={() => saveAndAdvance(1)}
          onSaveField={(data) => saveField({
            candidates: data.candidates,
            selected_candidate_ids: data.selected_candidate_ids,
            personas: data.personas,
          })}
        />
      )}
      {currentStep === 3 && (
        <Step3Goals
          goals={sd.goals || {}}
          personas={sd.personas || []}
          basicInfo={sd.basic_info || {}}
          onNext={(data) => saveAndAdvance(4, { goals: data })}
          onBack={() => saveAndAdvance(2)}
          onSaveField={(data) => saveField({ goals: data })}
        />
      )}
      {currentStep === 4 && (
        <Step4Journey
          journey={sd.journey_map || {}}
          basicInfo={sd.basic_info || {}}
          personas={sd.personas || []}
          goals={sd.goals || {}}
          onNext={(data) => saveAndAdvance(5, { journey_map: data })}
          onBack={() => saveAndAdvance(3)}
          onSaveField={(data) => saveField({ journey_map: data })}
        />
      )}
      {currentStep === 5 && (
        <Step5Result
          sessionId={sessionId}
          basicInfo={sd.basic_info || {}}
          personas={sd.personas || []}
          goals={sd.goals || {}}
          journey={sd.journey_map || {}}
          companyId={session.company_id}
          onBack={() => saveAndAdvance(4)}
        />
      )}
    </div>
  )
}
