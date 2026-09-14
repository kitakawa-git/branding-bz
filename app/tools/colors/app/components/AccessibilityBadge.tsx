'use client'

import type { AccessibilityScore } from '@/lib/types/color-tool'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface AccessibilityBadgeProps {
  score: AccessibilityScore
}

export function AccessibilityBadge({ score }: AccessibilityBadgeProps) {
  const passes = score.passes

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* 合否は lib/color-utils.ts の passes（メイン色／明背景 と アクセント色／明背景 の2組が 4.5:1 以上）。
              暗背景の比率はツールチップに出すだけで合否には含めないので、ラベルも「明背景」と明記する */}
          <span
            className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${
              passes
                ? 'bg-green-50 text-green-700'
                : 'bg-amber-50 text-amber-700'
            }`}
          >
            {passes ? (
              <>
                <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                AA基準（明背景）
              </>
            ) : (
              <>
                <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M6 4v2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="6" cy="8.5" r="0.5" fill="currentColor" />
                </svg>
                要改善
              </>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          <div className="space-y-1">
            <p className="font-medium">WCAG 2.1 AA コントラスト比</p>
            <div className="space-y-0.5 text-gray-500">
              <p>メイン色 / 明背景: {score.primaryOnLight.toFixed(1)}:1 {score.primaryOnLight >= 4.5 ? '✓' : '✗'}</p>
              <p>メイン色 / 暗背景: {score.primaryOnDark.toFixed(1)}:1 {score.primaryOnDark >= 4.5 ? '✓' : '✗'}</p>
              <p>アクセント / 明背景: {score.accentOnLight.toFixed(1)}:1 {score.accentOnLight >= 4.5 ? '✓' : '✗'}</p>
            </div>
            <p className="text-gray-400">基準: 4.5:1 以上（合否は明背景の2組で判定）</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
