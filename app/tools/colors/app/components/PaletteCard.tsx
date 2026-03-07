'use client'

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
  const allColors = [
    { label: 'メイン', color: proposal.primary },
    ...proposal.secondary.map((c, i) => ({ label: `サブ${i + 1}`, color: c })),
    { label: 'アクセント', color: proposal.accent },
    { label: '明', color: proposal.neutrals.light },
    { label: '暗', color: proposal.neutrals.dark },
  ]

  return (
    <div
      className={`rounded-xl border-2 bg-white transition-all ${
        selected
          ? 'border-blue-500 shadow-lg shadow-blue-100'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
      }`}
    >
      {/* 横長レイアウト: デスクトップ flex-row / モバイル flex-col */}
      <div className="flex flex-col md:flex-row">
        {/* 左側: カラーバー */}
        <div className="flex h-28 overflow-hidden rounded-t-[10px] md:h-auto md:w-[40%] md:min-h-[200px] md:rounded-l-[10px] md:rounded-tr-none">
          {allColors.map((item, i) => (
            <div
              key={i}
              className="flex-1"
              style={{ backgroundColor: item.color.hex }}
            />
          ))}
        </div>

        {/* 右側: テキスト情報 */}
        <div className="flex-1 space-y-3 p-5">
          {/* パレット名 + AA準拠バッジ */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-gray-900">{proposal.name}</h3>
              <p className="mt-0.5 text-sm text-gray-500">{proposal.concept}</p>
            </div>
            <AccessibilityBadge score={proposal.accessibilityScore} />
          </div>

          {/* カラー詳細（横並び・省略なし） */}
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {allColors.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <div
                  className="h-6 w-6 flex-shrink-0 rounded-full border border-gray-200"
                  style={{ backgroundColor: item.color.hex }}
                />
                <div className="flex items-baseline gap-1">
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
              </div>
            ))}
          </div>

          {/* 提案理由 */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1">提案理由</p>
            <p className="text-xs leading-relaxed text-gray-600">
              {proposal.reasoning}
            </p>
          </div>

          {/* プレビュー */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1">プレビュー</p>
            <PalettePreview proposal={proposal} />
          </div>

          {/* 選択ボタン */}
          <Button
            onClick={() => onSelect(proposal.id)}
            variant={selected ? 'default' : 'outline'}
            size="sm"
            className="w-full md:w-auto"
          >
            {selected ? '選択中' : 'この案を選ぶ'}
          </Button>
        </div>
      </div>
    </div>
  )
}
