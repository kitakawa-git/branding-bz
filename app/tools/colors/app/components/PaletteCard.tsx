'use client'

import { useState } from 'react'
import type { PaletteProposal } from '@/lib/types/color-tool'
import { AccessibilityBadge } from './AccessibilityBadge'
import { PalettePreview } from './PalettePreview'
import { Button } from '@/components/ui/button'

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
    { label: '明背景', color: proposal.neutrals.light },
    { label: '暗/文字', color: proposal.neutrals.dark },
  ]

  return (
    <div
      className={`rounded-xl border-2 bg-white transition-all ${
        selected
          ? 'border-blue-500 shadow-lg shadow-blue-100'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
      }`}
    >
      {/* カラースウォッチ帯 */}
      <div className="flex h-16 overflow-hidden rounded-t-[10px]">
        <div className="flex-[3]" style={{ backgroundColor: proposal.primary.hex }} />
        {proposal.secondary.map((s, i) => (
          <div key={i} className="flex-[2]" style={{ backgroundColor: s.hex }} />
        ))}
        <div className="flex-[1.5]" style={{ backgroundColor: proposal.accent.hex }} />
        <div className="flex-1" style={{ backgroundColor: proposal.neutrals.light.hex }} />
        <div className="flex-1" style={{ backgroundColor: proposal.neutrals.dark.hex }} />
      </div>

      <div className="space-y-4 p-5">
        {/* ヘッダー */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-gray-900">{proposal.name}</h3>
            <p className="mt-0.5 text-sm text-gray-500">{proposal.concept}</p>
          </div>
          <AccessibilityBadge score={proposal.accessibilityScore} />
        </div>

        {/* カラーチップ一覧 */}
        <div className="grid grid-cols-3 gap-2">
          {allColors.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div
                className="h-7 w-7 flex-shrink-0 rounded-md border border-gray-200"
                style={{ backgroundColor: item.color.hex }}
              />
              <div className="min-w-0">
                <p className="truncate text-[10px] text-gray-400">{item.label}</p>
                <p className="truncate text-xs font-medium text-gray-700">{item.color.name}</p>
                <p className="font-mono text-[10px] text-gray-400">{item.color.hex}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 提案理由（折りたたみ） */}
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

        {/* プレビュー（折りたたみ） */}
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

        {/* 選択ボタン */}
        <Button
          onClick={() => onSelect(proposal.id)}
          variant={selected ? 'default' : 'outline'}
          className="w-full"
        >
          {selected ? '選択中' : 'この案を選ぶ'}
        </Button>
      </div>
    </div>
  )
}
