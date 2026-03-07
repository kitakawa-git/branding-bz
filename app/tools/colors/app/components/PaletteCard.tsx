'use client'

import { useState } from 'react'
import type { PaletteProposal } from '@/lib/types/color-tool'
import { AccessibilityBadge } from './AccessibilityBadge'
import { PalettePreview } from './PalettePreview'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'

interface PaletteCardProps {
  proposal: PaletteProposal
  selected: boolean
  onSelect: (id: string) => void
}

export function PaletteCard({ proposal, selected, onSelect }: PaletteCardProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [showReasoning, setShowReasoning] = useState(false)

  const allColors = [
    { label: 'メイン', color: proposal.primary },
    ...proposal.secondary.map((c, i) => ({ label: `サブ${i + 1}`, color: c })),
    { label: 'アクセント', color: proposal.accent },
    { label: '明', color: proposal.neutrals.light },
    { label: '暗', color: proposal.neutrals.dark },
  ]

  return (
    <div
      className={`rounded-lg border-2 bg-white transition-all ${
        selected
          ? 'border-blue-500 shadow-lg shadow-blue-100'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
      }`}
    >
      {/* 上部: カラーバー（5色横並び） */}
      <div className="flex h-20 overflow-hidden rounded-t-[6px]">
        {allColors.map((item, i) => (
          <div
            key={i}
            className="flex-1"
            style={{ backgroundColor: item.color.hex }}
          />
        ))}
      </div>

      {/* 下部: テキスト情報 */}
      <div className="space-y-3 p-5">
        {/* 1行目: パレット名 + AA準拠バッジ */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-bold text-gray-900">{proposal.name}</h3>
          <AccessibilityBadge score={proposal.accessibilityScore} />
        </div>

        {/* 2行目: 説明文 */}
        <p className="text-sm text-gray-600">{proposal.concept}</p>

        {/* 3行目: カラー詳細（5色横並び） */}
        <div className="flex flex-wrap gap-3">
          {allColors.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div
                className="h-5 w-5 flex-shrink-0 rounded-full border border-gray-200"
                style={{ backgroundColor: item.color.hex }}
              />
              <span className="text-xs font-medium text-gray-700 whitespace-nowrap">
                {item.label}
              </span>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {item.color.name}
              </span>
              <span className="font-mono text-[10px] text-gray-400 whitespace-nowrap">
                {item.color.hex}
              </span>
            </div>
          ))}
        </div>

        {/* 4行目: 提案理由（アコーディオン） */}
        <div>
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <svg
              className={`h-3 w-3 transition-transform ${showReasoning ? 'rotate-90' : ''}`}
              viewBox="0 0 12 12"
              fill="none"
            >
              <path d="M4 3l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            提案理由
          </button>
          {showReasoning && (
            <p className="mt-2 text-xs leading-relaxed text-gray-600">
              {proposal.reasoning}
            </p>
          )}
        </div>

        {/* 5行目: プレビュー（アコーディオン） */}
        <div>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <svg
              className={`h-3 w-3 transition-transform ${showPreview ? 'rotate-90' : ''}`}
              viewBox="0 0 12 12"
              fill="none"
            >
              <path d="M4 3l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            プレビュー
          </button>
          {showPreview && (
            <div className="mt-2">
              <PalettePreview proposal={proposal} />
            </div>
          )}
        </div>

        {/* 6行目: 選択ボタン（w-full） */}
        <Button
          onClick={() => onSelect(proposal.id)}
          variant={selected ? 'default' : 'outline'}
          className="w-full"
        >
          {selected ? (
            <>
              <Check className="mr-1.5 h-4 w-4" />
              選択中
            </>
          ) : (
            'この案を選ぶ'
          )}
        </Button>
      </div>
    </div>
  )
}
