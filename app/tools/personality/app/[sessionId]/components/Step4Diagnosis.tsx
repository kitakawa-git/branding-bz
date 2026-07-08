'use client'

// Step 4: AI診断実行
// 診断はサーバー（/api/tools/personality/diagnose）がセッションの回答を正として実行する。
import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Sparkles, Loader2 } from 'lucide-react'
import { AIButton } from '@/components/shared/AIButton'

interface Step4Props {
  sessionId: string
  /** 診断済み（再入時）なら true */
  hasDiagnosis: boolean
  /** 保存済みの診断結果。診断済みのとき Step4 上で要約を見返せるように表示する */
  diagnosis?: Record<string, unknown> | null
  onComplete: (diagnosis: Record<string, unknown>) => Promise<boolean>
  onBack: () => void
}

const LOADING_MESSAGES = [
  '回答を分析しています...',
  'Aaker 5次元のスコアを算出中...',
  'アーキタイプを判定中...',
  'トーンオブボイスを生成中...',
  '期待印象タグを選定中...',
  '結果をまとめています...',
]

export function Step4Diagnosis({ sessionId, hasDiagnosis, diagnosis, onComplete, onBack }: Step4Props) {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const d = (diagnosis || {}) as Record<string, any>
  const summaryText = typeof d.personality_summary === 'string' ? d.personality_summary : ''
  const toneText = typeof d.tone_of_voice === 'string' ? d.tone_of_voice : ''
  const summaryTags = Array.isArray(d.expected_tags) ? d.expected_tags.filter((t: any) => typeof t === 'string') : []
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [messageIndex, setMessageIndex] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ローディング演出: メッセージを順送り
  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => {
        setMessageIndex(prev => Math.min(prev + 1, LOADING_MESSAGES.length - 1))
      }, 4000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [running])

  const runDiagnosis = async () => {
    setError('')
    setMessageIndex(0)
    setRunning(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('ログイン状態を確認できませんでした。ページを再読み込みしてください。')
        return
      }

      const res = await fetch('/api/tools/personality/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, userId: user.id }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'AI診断に失敗しました')
        return
      }

      toast.success('診断が完了しました')
      await onComplete(data.diagnosis)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI診断中にエラーが発生しました')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Step 4: AI診断</h1>
      <p className="mb-5 text-[13px] text-muted-foreground">
        回答10問をもとに、AIがブランドの人格をスコア・タイプ・トーンまで一括で生成します
      </p>

      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-8 text-center">
          {running ? (
            <>
              <Loader2 className="mx-auto h-10 w-10 text-ds-app-accent animate-spin" strokeWidth={1.5} />
              <h2 className="mt-4 text-base font-bold text-foreground">
                {LOADING_MESSAGES[messageIndex]}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                30秒ほどかかる場合があります。このままお待ちください。
              </p>
            </>
          ) : hasDiagnosis ? (
            <div className="text-left">
              <div className="text-center">
                <Sparkles className="mx-auto h-10 w-10 text-ds-app-accent" strokeWidth={1.5} />
                <h2 className="mt-4 text-base font-bold text-foreground">診断済みのブランドの人格</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  結果は保存されています。詳細の確認・微調整・出力は「前回の結果を見る」から行えます。
                </p>
              </div>
              {summaryText && (
                <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{summaryText}</p>
                </div>
              )}
              {toneText && (
                <div className="mt-3">
                  <p className="text-[11px] text-gray-500 mb-1">トーンオブボイス</p>
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{toneText}</p>
                </div>
              )}
              {summaryTags.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] text-gray-500 mb-1">期待される印象タグ</p>
                  <div className="flex flex-wrap gap-2">
                    {summaryTags.map((t: string) => (
                      <span key={t} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[13px] font-medium text-ds-app-accent-hover">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {error && (
                <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 text-center">
                  {error}
                </div>
              )}
              <div className="mt-6 flex flex-col items-center gap-2">
                <AIButton onClick={runDiagnosis}>AIで再診断</AIButton>
                <p className="text-xs text-muted-foreground">再診断すると前回の結果は上書きされます</p>
              </div>
            </div>
          ) : (
            <>
              <Sparkles className="mx-auto h-10 w-10 text-ds-app-accent" strokeWidth={1.5} />
              <h2 className="mt-4 text-base font-bold text-foreground">
                回答をもとに、AIがブランドの人格を生成します
              </h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Aaker 5次元スコアと12アーキタイプを同時に算出し、<br className="hidden sm:block" />
                トーンオブボイス・期待印象タグまで一括で提案します。
              </p>
              {error && (
                <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}
              <div className="mt-6 flex flex-col items-center gap-3">
                <AIButton onClick={runDiagnosis}>AIで診断</AIButton>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* フッターナビゲーション */}
      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-3 flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={running} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          戻る
        </Button>
        {hasDiagnosis && !running && (
          <Button variant="outline" onClick={() => onComplete({})} className="gap-1">
            前回の結果を見る
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
