'use client'

import { cn } from '@/lib/utils'

const STEPS = [
  { step: 1, label: '基本情報' },
  { step: 2, label: 'セグメンテーション' },
  { step: 3, label: 'ターゲティング' },
  { step: 4, label: 'ポジショニング' },
  { step: 5, label: '確認・出力' },
]

interface ProgressBarProps {
  currentStep: number
  totalSteps?: number
}

export function ProgressBar({ currentStep, totalSteps = 5 }: ProgressBarProps) {
  return (
    <div className="w-full">
      {/* ステップインジケーター */}
      <div className="flex items-center justify-between">
        {STEPS.slice(0, totalSteps).map(({ step, label }, index) => (
          <div key={step} className="flex flex-1 items-center">
            {/* ステップ丸 */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors',
                  step < currentStep
                    ? 'bg-gray-900 text-white'
                    : step === currentStep
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                )}
              >
                {step < currentStep ? '✓' : step}
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

            {/* コネクティングライン */}
            {index < totalSteps - 1 && (
              <div
                className={cn(
                  'mx-1 h-0.5 flex-1 transition-colors',
                  step < currentStep ? 'bg-gray-900' : 'bg-gray-200'
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
