'use client'

// ステップ2〜5のプレースホルダーコンポーネント
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight } from 'lucide-react'

interface StepPlaceholderProps {
  stepNumber: number
  title: string
  description: string
  onNext?: () => void
  onBack?: () => void
  isLast?: boolean
}

export function StepPlaceholder({
  stepNumber,
  title,
  description,
  onNext,
  onBack,
  isLast = false,
}: StepPlaceholderProps) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          Step {stepNumber}: {title}
        </h2>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>

      <div className="flex min-h-[300px] items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-400">準備中</p>
          <p className="mt-1 text-sm text-gray-400">
            このステップは現在開発中です
          </p>
        </div>
      </div>

      {/* フッターナビゲーション */}
      <div className="flex items-center justify-between border-t pt-6">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={!onBack}
          className="gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          戻る
        </Button>

        {!isLast && onNext && (
          <Button onClick={onNext} className="gap-1">
            次へ
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
