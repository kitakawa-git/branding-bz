'use client'

import { cn } from '@/lib/utils'

interface StepProgressBarProps {
  steps: Array<{ label: string }>
  currentStep: number
  className?: string
}

export function StepProgressBar({ steps, currentStep, className }: StepProgressBarProps) {
  // 完了割合（0〜1）: 丸の中心から中心までの進捗
  const progress = steps.length > 1 ? (currentStep - 1) / (steps.length - 1) : 0

  return (
    // data-stepper: globals.css の「本文最低14px」底上げから除外するマーカー
    <div data-stepper className={cn('w-full', className)}>
      <div className="relative">
        {/* ベースライン（グレー一本線：最初の丸中心〜最後の丸中心） */}
        <div className="absolute top-[15px] left-4 right-4 h-0.5 bg-gray-200" />

        {/* 完了ライン（青：進捗分だけ上書き） */}
        {currentStep > 1 && (
          <div
            className="absolute top-[15px] left-4 h-0.5 bg-ds-app-accent transition-all"
            style={{ width: `calc((100% - 32px) * ${progress})` }}
          />
        )}

        {/* ステップ丸（justify-between で均等配置） */}
        <div className="relative flex justify-between">
          {steps.map(({ label }, index) => {
            const step = index + 1
            const isCompleted = step < currentStep
            const isCurrent = step === currentStep

            return (
              <div key={index} className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors',
                    isCompleted || isCurrent
                      ? 'bg-ds-app-accent text-white'
                      : 'bg-gray-200 text-gray-500'
                  )}
                >
                  {isCompleted ? '✓' : step}
                </div>
                <span
                  className={cn(
                    'mt-1.5 text-[10px] font-medium whitespace-nowrap',
                    step <= currentStep ? 'text-gray-900' : 'text-gray-400'
                  )}
                >
                  {label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
