'use client'

// ムードボードペア選択コンポーネント
// テキスト + グラデーション背景のカード（画像不使用）
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ArrowRight, Check } from 'lucide-react'
import { MOODBOARD_PAIRS, type MoodboardChoice } from '@/lib/types/color-tool'

interface MoodboardPairSelectorProps {
  value: MoodboardChoice[]
  onChange: (choices: MoodboardChoice[]) => void
  onComplete: () => void
}

export function MoodboardPairSelector({
  value,
  onChange,
  onComplete,
}: MoodboardPairSelectorProps) {
  const [currentIndex, setCurrentIndex] = useState(() => {
    // 既に回答がある場合は最後の回答の次から
    if (value.length === 0) return 0
    const lastAnsweredIdx = MOODBOARD_PAIRS.findIndex(
      p => p.id === value[value.length - 1].pairId
    )
    return Math.min(lastAnsweredIdx + 1, MOODBOARD_PAIRS.length - 1)
  })

  const pair = MOODBOARD_PAIRS[currentIndex]
  const currentChoice = value.find(c => c.pairId === pair.id)?.choice
  const allAnswered = value.length === MOODBOARD_PAIRS.length

  const selectChoice = (choice: 'A' | 'B') => {
    const existing = value.filter(c => c.pairId !== pair.id)
    const updated = [...existing, { pairId: pair.id, choice }]
    onChange(updated)

    // 自動で次のペアへ（少し遅延してアニメーション感を出す）
    if (currentIndex < MOODBOARD_PAIRS.length - 1) {
      setTimeout(() => setCurrentIndex(currentIndex + 1), 300)
    }
  }

  const goNext = () => {
    if (currentIndex < MOODBOARD_PAIRS.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  return (
    <div className="space-y-6">
      {/* 進捗バー */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{currentIndex + 1} / {MOODBOARD_PAIRS.length}</span>
        <span>{value.length}問回答済み</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-blue-600 transition-all"
          style={{ width: `${(value.length / MOODBOARD_PAIRS.length) * 100}%` }}
        />
      </div>

      {/* ペアカード */}
      <div className="grid gap-4 md:grid-cols-2">
        <MoodboardCard
          label={pair.optionA.label}
          description={pair.optionA.description}
          colors={pair.optionA.colors}
          isSelected={currentChoice === 'A'}
          onClick={() => selectChoice('A')}
        />
        <MoodboardCard
          label={pair.optionB.label}
          description={pair.optionB.description}
          colors={pair.optionB.colors}
          isSelected={currentChoice === 'B'}
          onClick={() => selectChoice('B')}
        />
      </div>

      {/* ナビゲーション */}
      <div className="flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30"
        >
          前の質問
        </button>

        {allAnswered ? (
          <Button onClick={onComplete} className="font-bold">
            完了
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <button
            onClick={goNext}
            disabled={currentIndex >= MOODBOARD_PAIRS.length - 1}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-30"
          >
            次の質問
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* 回答一覧（小さいドット表示） */}
      <div className="flex items-center justify-center gap-1.5">
        {MOODBOARD_PAIRS.map((p, i) => {
          const answered = value.some(c => c.pairId === p.id)
          return (
            <button
              key={p.id}
              onClick={() => setCurrentIndex(i)}
              className={cn(
                'h-2.5 w-2.5 rounded-full transition-all',
                i === currentIndex
                  ? 'scale-125 bg-blue-600'
                  : answered
                    ? 'bg-blue-300'
                    : 'bg-gray-200'
              )}
            />
          )
        })}
      </div>
    </div>
  )
}

function MoodboardCard({
  label,
  description,
  colors,
  isSelected,
  onClick,
}: {
  label: string
  description: string
  colors: [string, string]
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative overflow-hidden rounded-xl border-2 p-6 text-left transition-all',
        isSelected
          ? 'border-blue-500 shadow-lg ring-2 ring-blue-200'
          : 'border-transparent hover:border-gray-300 hover:shadow-md'
      )}
    >
      {/* グラデーション背景 */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
        }}
      />

      {/* カラーバー */}
      <div className="relative mb-4 flex gap-2">
        <div
          className="h-12 w-12 rounded-lg shadow-sm"
          style={{ backgroundColor: colors[0] }}
        />
        <div
          className="h-12 w-12 rounded-lg shadow-sm"
          style={{ backgroundColor: colors[1] }}
        />
      </div>

      {/* テキスト */}
      <div className="relative">
        <h3 className="mb-1 text-lg font-bold text-gray-900">{label}</h3>
        <p className="text-sm text-gray-600">{description}</p>
      </div>

      {/* 選択マーク */}
      {isSelected && (
        <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white">
          <Check className="h-4 w-4" />
        </div>
      )}
    </button>
  )
}
