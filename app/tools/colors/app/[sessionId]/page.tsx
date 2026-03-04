'use client'

// ステップ管理ページ（動的ルート）
// current_step に基づいて Step1〜5 のコンポーネントを動的レンダリング
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { ProgressBar } from '../components/ProgressBar'
import { Step1BasicInfo } from './components/Step1BasicInfo'
import { Step2ImageInput } from './components/Step2ImageInput'
import { Step3Proposals } from './components/Step3Proposals'
import { Step4Refinement } from './components/Step4Refinement'
import { Step5Export } from './components/Step5Export'
import type { MiniAppSession, BrandColorProject } from '@/lib/types/color-tool'

export default function SessionPage() {
  const params = useParams()
  const sessionId = params.sessionId as string

  const [session, setSession] = useState<MiniAppSession | null>(null)
  const [project, setProject] = useState<BrandColorProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // セッション・プロジェクトデータ取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/tools/colors/sessions/${sessionId}`)
        if (!res.ok) {
          const data = await res.json()
          setError(data.error || 'データの取得に失敗しました')
          return
        }

        const { session: s, project: p } = await res.json()
        setSession(s)
        setProject(p)
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
    data?: Record<string, unknown>
  ) => {
    try {
      const res = await fetch(`/api/tools/colors/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: nextStep, data }),
      })

      if (!res.ok) {
        const resData = await res.json()
        toast.error(resData.error || '保存に失敗しました')
        return false
      }

      setSession(prev => prev ? { ...prev, current_step: nextStep } : prev)
      if (data) {
        setProject(prev => prev ? { ...prev, ...data } as BrandColorProject : prev)
      }
      return true
    } catch {
      toast.error('保存中にエラーが発生しました')
      return false
    }
  }, [sessionId])

  // 部分保存（onBlur用、ステップ変更なし）
  const saveField = useCallback(async (data: Record<string, unknown>) => {
    try {
      await fetch(`/api/tools/colors/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      })
      setProject(prev => prev ? { ...prev, ...data } as BrandColorProject : prev)
    } catch {
      console.error('[AutoSave] 保存エラー')
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

  if (error || !session || !project) {
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
          project={project}
          onNext={(data) => saveAndAdvance(2, data)}
          onSaveField={saveField}
        />
      )}
      {currentStep === 2 && (
        <Step2ImageInput
          project={project}
          onNext={(data) => saveAndAdvance(3, data)}
          onBack={() => saveAndAdvance(1)}
          onSaveField={saveField}
        />
      )}
      {currentStep === 3 && (
        <Step3Proposals
          project={project}
          sessionId={sessionId}
          onNext={(data) => saveAndAdvance(4, data)}
          onBack={() => saveAndAdvance(2)}
          onUpdateProject={(data) => setProject(prev => prev ? { ...prev, ...data } as BrandColorProject : prev)}
        />
      )}
      {currentStep === 4 && (
        <Step4Refinement
          project={project}
          sessionId={sessionId}
          onNext={(data) => saveAndAdvance(5, data)}
          onBack={() => saveAndAdvance(3)}
          onSaveField={saveField}
        />
      )}
      {currentStep === 5 && (
        <Step5Export
          project={project}
          sessionId={sessionId}
          onBack={() => saveAndAdvance(4)}
          onSaveField={saveField}
        />
      )}
    </div>
  )
}
