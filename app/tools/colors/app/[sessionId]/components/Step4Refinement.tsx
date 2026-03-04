'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'
import { ColorPicker } from '../../components/ColorPicker'
import { AccessibilityBadge } from '../../components/AccessibilityBadge'
import { PalettePreview } from '../../components/PalettePreview'
import { ChatInterface } from '../../components/ChatInterface'
import { calculateAccessibilityScore } from '@/lib/color-utils'
import type { BrandColorProject, PaletteProposal, ColorValue } from '@/lib/types/color-tool'

interface Step4RefinementProps {
  project: BrandColorProject
  sessionId: string
  onNext: (data: Record<string, unknown>) => Promise<boolean>
  onBack: () => Promise<boolean>
  onSaveField: (data: Record<string, unknown>) => Promise<void>
}

type ActiveTab = 'palette' | 'chat'

export function Step4Refinement({
  project,
  sessionId,
  onNext,
  onBack,
  onSaveField,
}: Step4RefinementProps) {
  const isMobile = useIsMobile()
  const [activeTab, setActiveTab] = useState<ActiveTab>('palette')
  const [palette, setPalette] = useState<PaletteProposal>(
    project.current_palette || project.proposals[0]
  )
  const [adjustmentCount, setAdjustmentCount] = useState(project.adjustment_count)
  const [showPreview, setShowPreview] = useState(false)

  // パレットの色を更新
  const updateColor = useCallback(
    (path: string, hex: string) => {
      setPalette((prev) => {
        const updated = structuredClone(prev)
        const rgb = hexToRgbObj(hex)

        switch (path) {
          case 'primary':
            updated.primary = { ...updated.primary, hex, rgb }
            break
          case 'accent':
            updated.accent = { ...updated.accent, hex, rgb }
            break
          case 'neutrals.light':
            updated.neutrals.light = { ...updated.neutrals.light, hex, rgb }
            break
          case 'neutrals.dark':
            updated.neutrals.dark = { ...updated.neutrals.dark, hex, rgb }
            break
          default:
            if (path.startsWith('secondary.')) {
              const idx = parseInt(path.split('.')[1])
              if (updated.secondary[idx]) {
                updated.secondary[idx] = { ...updated.secondary[idx], hex, rgb }
              }
            }
        }

        // アクセシビリティスコア再計算
        updated.accessibilityScore = calculateAccessibilityScore(updated)

        // 自動保存
        onSaveField({ current_palette: updated })

        return updated
      })
    },
    [onSaveField]
  )

  // チャットからのパレット更新
  const handlePaletteUpdate = useCallback(
    (updatedPalette: PaletteProposal) => {
      setPalette(updatedPalette)
      onSaveField({ current_palette: updatedPalette })
      toast.success('パレットが更新されました')
      if (isMobile) setActiveTab('palette')
    },
    [onSaveField, isMobile]
  )

  const handleNext = async () => {
    const ok = await onNext({ current_palette: palette })
    if (!ok) toast.error('保存に失敗しました')
  }

  // モバイル: タブ切り替え
  if (isMobile) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Step 4: 調整・磨き込み</h2>

        {/* タブ */}
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setActiveTab('palette')}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              activeTab === 'palette'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500'
            }`}
          >
            パレット編集
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              activeTab === 'chat'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500'
            }`}
          >
            AIに相談
          </button>
        </div>

        {activeTab === 'palette' ? (
          <div className="space-y-6">
            <PaletteEditor
              palette={palette}
              onUpdateColor={updateColor}
              showPreview={showPreview}
              onTogglePreview={() => setShowPreview(!showPreview)}
            />
            <div className="flex gap-3">
              <Button variant="outline" onClick={onBack}>戻る</Button>
              <Button onClick={handleNext} className="flex-1">確定・出力へ進む</Button>
            </div>
          </div>
        ) : (
          <div className="h-[60vh] rounded-xl border border-gray-200 bg-white">
            <ChatInterface
              sessionId={sessionId}
              currentPalette={palette}
              adjustmentCount={adjustmentCount}
              onPaletteUpdate={handlePaletteUpdate}
              onAdjustmentCountChange={setAdjustmentCount}
            />
          </div>
        )}
      </div>
    )
  }

  // デスクトップ: 2ペインレイアウト
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Step 4: 調整・磨き込み</h2>
      <p className="text-sm text-gray-500">
        色をクリックして直接調整するか、AIに相談してパレットを磨き込みましょう
      </p>

      <div className="grid grid-cols-2 gap-6">
        {/* 左: パレット編集 */}
        <div className="space-y-6">
          <PaletteEditor
            palette={palette}
            onUpdateColor={updateColor}
            showPreview={showPreview}
            onTogglePreview={() => setShowPreview(!showPreview)}
          />
          <div className="flex gap-3">
            <Button variant="outline" onClick={onBack}>戻る</Button>
            <Button onClick={handleNext} className="flex-1">確定・出力へ進む</Button>
          </div>
        </div>

        {/* 右: AIチャット */}
        <div className="h-[600px] rounded-xl border border-gray-200 bg-white">
          <ChatInterface
            sessionId={sessionId}
            currentPalette={palette}
            adjustmentCount={adjustmentCount}
            onPaletteUpdate={handlePaletteUpdate}
            onAdjustmentCountChange={setAdjustmentCount}
          />
        </div>
      </div>
    </div>
  )
}

// パレット編集エリア
function PaletteEditor({
  palette,
  onUpdateColor,
  showPreview,
  onTogglePreview,
}: {
  palette: PaletteProposal
  onUpdateColor: (path: string, hex: string) => void
  showPreview: boolean
  onTogglePreview: () => void
}) {
  const colorRows: { label: string; path: string; color: ColorValue }[] = [
    { label: 'メインカラー', path: 'primary', color: palette.primary },
    ...palette.secondary.map((s, i) => ({
      label: `サブカラー${i + 1}`,
      path: `secondary.${i}`,
      color: s,
    })),
    { label: 'アクセントカラー', path: 'accent', color: palette.accent },
    { label: '明るい背景', path: 'neutrals.light', color: palette.neutrals.light },
    { label: '暗い背景/文字', path: 'neutrals.dark', color: palette.neutrals.dark },
  ]

  return (
    <div className="space-y-4">
      {/* パレット名・コンセプト */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-gray-900">{palette.name}</h3>
            <p className="mt-0.5 text-sm text-gray-500">{palette.concept}</p>
          </div>
          <AccessibilityBadge score={palette.accessibilityScore} />
        </div>
      </div>

      {/* カラー一覧 */}
      <div className="space-y-2">
        {colorRows.map((row) => (
          <div
            key={row.path}
            className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3"
          >
            <div className="w-24 text-xs font-medium text-gray-500">{row.label}</div>
            <ColorPicker
              value={row.color.hex}
              onChange={(hex) => onUpdateColor(row.path, hex)}
              showRgb
            />
            <span className="text-xs text-gray-400">{row.color.name}</span>
          </div>
        ))}
      </div>

      {/* プレビュートグル */}
      <button
        onClick={onTogglePreview}
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
      {showPreview && <PalettePreview proposal={palette} />}
    </div>
  )
}

// HEX → RGB オブジェクト変換
function hexToRgbObj(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '')
  return {
    r: parseInt(clean.slice(0, 2), 16) || 0,
    g: parseInt(clean.slice(2, 4), 16) || 0,
    b: parseInt(clean.slice(4, 6), 16) || 0,
  }
}
