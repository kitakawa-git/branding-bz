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
import { type Persona, normalizePersonas } from './components/persona-types'

// ペルソナセッションデータの型
/* eslint-disable @typescript-eslint/no-explicit-any */
interface PersonaSessionData {
  current_step: number
  basic_info: any
  target_info: any
  personas?: Persona[]   // マルチの正
  journey_map: any       // 単一のまま（スコープ外）
  // 後方互換: 旧 demographics/goals（単一）が残るセッションは読込時に personas へ正規化
  demographics?: any
  goals?: any
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
  { label: 'ペルソナ生成' },
  { label: '課題・購買行動' },
  { label: 'ジャーニー設計' },
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
  // 後方互換正規化: personas[] が正。旧単一 demographics/goals は1ペルソナへ。target_name はセグメントから補完。
  const personas = normalizePersonas(sd, sd.basic_info?.target_segments)

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
          personas={personas}
          basicInfo={sd.basic_info || {}}
          onNext={(data) => saveAndAdvance(3, { personas: data })}
          onBack={() => saveAndAdvance(1)}
          onSaveField={(data) => saveField({ personas: data })}
        />
      )}
      {currentStep === 3 && (
        <Step3Goals
          personas={personas}
          basicInfo={sd.basic_info || {}}
          onNext={(data) => saveAndAdvance(4, { personas: data })}
          onBack={() => saveAndAdvance(2)}
          onSaveField={(data) => saveField({ personas: data })}
        />
      )}
      {currentStep === 4 && (
        <Step4Journey
          personas={personas}
          basicInfo={sd.basic_info || {}}
          onNext={(data) => saveAndAdvance(5, { personas: data })}
          onBack={() => saveAndAdvance(3)}
          onSaveField={(data) => saveField({ personas: data })}
        />
      )}
      {currentStep === 5 && (
        <Step5Result
          sessionId={sessionId}
          personas={personas}
          basicInfo={sd.basic_info || {}}
          companyId={session.company_id}
          onBack={() => saveAndAdvance(4)}
          onSaveField={(data) => saveField({ personas: data })}
        />
      )}
    </div>
  )
}
