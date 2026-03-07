'use client'

// STP分析ツール — ステップ管理ページ
// current_step に基づいて Step1〜5 のコンポーネントを動的レンダリング
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { ProgressBar } from '../components/ProgressBar'
import { Step1BasicInfo } from './components/Step1BasicInfo'
import { Step2Segmentation } from './components/Step2Segmentation'
import { Step3Targeting } from './components/Step3Targeting'
import { Step4Positioning } from './components/Step4Positioning'
import { Step5Result } from './components/Step5Result'

// STPセッションデータの型
interface STPSessionData {
  current_step: number
  basic_info: {
    company_name: string
    industry_category: string
    industry_subcategory: string
    business_descriptions: Array<{ title: string; description: string }>
    target_segments: Array<{ name: string; description: string }>
    competitors: Array<{ name: string; url: string }>
    // 旧フィールド（後方互換）
    industry?: string
    industry_other?: string
    products?: string
    current_customers?: string
  }
  segmentation: {
    mode: 'ai' | 'manual'
    variables: Array<{
      name: string
      segments: Array<{
        name: string
        description: string
        size_hint: '大' | '中' | '小'
        selected: boolean
      }>
    }>
  }
  targeting: {
    evaluations: Array<{
      segment_name: string
      attractiveness: number
      competitiveness: number
      priority: '高' | '中' | '低'
    }>
    main_target: string
    sub_targets: string[]
    target_description: string
  }
  positioning: {
    x_axis: { left: string; right: string }
    y_axis: { bottom: string; top: string }
    items: Array<{
      name: string
      x: number
      y: number
      color: string
      is_self: boolean
    }>
  }
  completed: boolean
}

interface STPSession {
  id: string
  user_id: string
  app_type: string
  status: string
  current_step: number
  session_data: STPSessionData
  company_id: string | null
  created_at: string
}

export default function STPSessionPage() {
  const params = useParams()
  const sessionId = params.sessionId as string

  const [session, setSession] = useState<STPSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // セッションデータ取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/tools/stp/sessions/${sessionId}`)
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
      const res = await fetch(`/api/tools/stp/sessions/${sessionId}`, {
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
            ? { ...prev.session_data, ...sessionData } as STPSessionData
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
      await fetch(`/api/tools/stp/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionData }),
      })
      setSession(prev => {
        if (!prev) return prev
        return {
          ...prev,
          session_data: { ...prev.session_data, ...sessionData } as STPSessionData,
        }
      })
    } catch {
      console.error('[STP AutoSave] 保存エラー')
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
    <div className={`mx-auto px-4 py-8 ${currentStep === 4 ? 'max-w-5xl' : 'max-w-3xl'}`}>
      {/* プログレスバー */}
      <div className="mb-8">
        <ProgressBar currentStep={currentStep} />
      </div>

      {/* ステップコンテンツ */}
      {currentStep === 1 && (
        <Step1BasicInfo
          basicInfo={session.session_data.basic_info}
          onNext={(data) => saveAndAdvance(2, { basic_info: data })}
          onSaveField={(data) => saveField({ basic_info: data })}
        />
      )}
      {currentStep === 2 && (
        <Step2Segmentation
          segmentation={session.session_data.segmentation}
          basicInfo={session.session_data.basic_info}
          onNext={(data) => saveAndAdvance(3, { segmentation: data })}
          onBack={() => saveAndAdvance(1)}
          onSaveField={(data) => saveField({ segmentation: data })}
        />
      )}
      {currentStep === 3 && (
        <Step3Targeting
          segmentation={session.session_data.segmentation}
          targeting={session.session_data.targeting}
          onNext={(data) => saveAndAdvance(4, { targeting: data })}
          onBack={() => saveAndAdvance(2)}
          onSaveField={(data) => saveField({ targeting: data })}
        />
      )}
      {currentStep === 4 && (
        <Step4Positioning
          positioning={session.session_data.positioning}
          basicInfo={session.session_data.basic_info}
          targeting={session.session_data.targeting}
          onNext={(data) => saveAndAdvance(5, { positioning: data })}
          onBack={() => saveAndAdvance(3)}
          onSaveField={(data) => saveField({ positioning: data })}
        />
      )}
      {currentStep === 5 && (
        <Step5Result
          sessionId={sessionId}
          basicInfo={session.session_data.basic_info}
          segmentation={session.session_data.segmentation}
          targeting={session.session_data.targeting}
          positioning={session.session_data.positioning}
          companyId={session.company_id}
          onBack={() => saveAndAdvance(4)}
        />
      )}
    </div>
  )
}
