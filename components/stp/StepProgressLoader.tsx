'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Step {
  label: string
}

interface StepProgressLoaderProps {
  steps: Step[]
  /** 各ステップに割り当てる平均時間（ms）。デフォルト2000ms */
  stepDuration?: number
  /** 完了状態（fetch完了時に true）。true になると全ステップが completed 表示 */
  done?: boolean
  className?: string
}

/**
 * 時間経過で順次ステップが進む進捗ローダー。
 * 実際の API 進捗とは独立して動作（多段 fetch の代替表現）。
 * done=true になると全ステップが completed 表示に切り替わる。
 */
export function StepProgressLoader({
  steps,
  stepDuration = 2000,
  done = false,
  className,
}: StepProgressLoaderProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (done) {
      setActiveIndex(steps.length)
      return
    }
    setActiveIndex(0)
    const intervals: ReturnType<typeof setTimeout>[] = []
    // 最後のステップは active のまま残す（done を待つ）
    for (let i = 1; i < steps.length; i++) {
      const t = setTimeout(() => {
        setActiveIndex(i)
      }, stepDuration * i)
      intervals.push(t)
    }
    return () => {
      for (const t of intervals) clearTimeout(t)
    }
  }, [steps.length, stepDuration, done])

  return (
    <div className={className}>
      <div className="grid gap-3">
        {steps.map((step, i) => {
          const completed = i < activeIndex || done
          const active = !done && i === activeIndex
          return (
            <div
              key={i}
              className={`flex items-center gap-3 text-sm transition-opacity ${
                completed ? 'opacity-100' : active ? 'opacity-100' : 'opacity-40'
              }`}
            >
              {completed ? (
                <Check className="h-[18px] w-[18px] shrink-0 text-emerald-600" />
              ) : active ? (
                <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin text-ds-app-accent" />
              ) : (
                <Circle className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
              )}
              <span
                className={
                  completed
                    ? 'text-foreground'
                    : active
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground'
                }
              >
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface StepProgressPanelProps extends StepProgressLoaderProps {
  /** パネルの最低高さ（px）。レイアウトジャンプ防止用。デフォルト300 */
  minHeight?: number
}

/**
 * StepProgressLoader を枠つきボックスで包んだ共通パネル。
 * 各Stepの「AI生成中」表示として使い回す（steps を差し替えるだけ）。
 * 外側余白（mt-3 など）は className で呼び出し側から渡す。
 */
export function StepProgressPanel({
  minHeight = 300,
  className,
  ...loaderProps
}: StepProgressPanelProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-lg border border-border bg-white px-6 py-8',
        className,
      )}
      style={{ minHeight }}
    >
      <StepProgressLoader {...loaderProps} />
    </div>
  )
}
