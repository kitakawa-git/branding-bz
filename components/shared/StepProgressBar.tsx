'use client'

import { Fragment } from 'react'
import { cn } from '@/lib/utils'

interface StepProgressBarProps {
  steps: Array<{ label: string }>
  currentStep: number
  className?: string
}

export function StepProgressBar({ steps, currentStep, className }: StepProgressBarProps) {
  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-start">
        {steps.map(({ label }, index) => {
          const step = index + 1
          const isCompleted = step < currentStep
          const isCurrent = step === currentStep

          return (
            <Fragment key={index}>
              {/* ステップ丸 + ラベル */}
              <div className="flex shrink-0 flex-col items-center">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors',
                    isCompleted || isCurrent
                      ? 'bg-blue-600 text-white'
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

              {/* コネクティングライン（丸の中心 = 16px に配置） */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'mt-[15px] mx-1 h-0.5 flex-1 transition-colors',
                    isCompleted ? 'bg-blue-600' : 'bg-gray-200'
                  )}
                />
              )}
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
