'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import { PalettePreview } from '../../components/PalettePreview'
import { AccessibilityBadge } from '../../components/AccessibilityBadge'
import type { BrandColorProject, PaletteProposal, ColorValue } from '@/lib/types/color-tool'
import { supabase } from '@/lib/supabase'

interface Step5ExportProps {
  project: BrandColorProject
  sessionId: string
  onBack: () => Promise<boolean>
  onSaveField: (data: Record<string, unknown>) => Promise<void>
}

export function Step5Export({
  project,
  sessionId,
  onBack,
  onSaveField,
}: Step5ExportProps) {
  const palette: PaletteProposal = project.final_palette || project.current_palette || project.proposals[0]
  const [exporting, setExporting] = useState<string | null>(null)
  const [linked, setLinked] = useState(project.linked_to_brandconnect) // DB列名はそのまま
  const [confirmed, setConfirmed] = useState(!!project.final_palette)

  const handleConfirm = async () => {
    await onSaveField({ final_palette: palette })

    // セッションstatusを完了に更新
    try {
      await fetch(`/api/tools/colors/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { final_palette: palette }, status: 'completed' }),
      })
    } catch {
      // ステータス更新失敗は無視
    }

    // 本体（companies）への書き戻し
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await fetch('/api/tools/shared-profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            company_name: project.brand_name,
            industry_category: project.industry_category,
            industry_subcategory: project.industry_subcategory,
            brand_stage: project.brand_stage,
            competitor_colors: project.competitor_colors,
          }),
        })
      }
    } catch {
      // 書き戻し失敗は無視
    }

    setConfirmed(true)
    toast.success('パレットを確定しました')
  }

  const handleExportPdf = async () => {
    setExporting('pdf')
    try {
      const res = await fetch('/api/tools/colors/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'PDF出力に失敗しました')
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project.brand_name || 'palette'}-colors.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDFをダウンロードしました')
    } catch {
      toast.error('PDF出力中にエラーが発生しました')
    } finally {
      setExporting(null)
    }
  }

  const handleExportCss = () => {
    const css = generateCssVariables(palette)
    navigator.clipboard.writeText(css)
    toast.success('CSS変数をコピーしました')
  }

  const handleLink = async () => {
    setExporting('link')
    try {
      const res = await fetch('/api/tools/colors/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.needsAccount) {
          toast.error('branding.bzアカウントとの連携が必要です')
        } else {
          toast.error(data.error || '連携に失敗しました')
        }
        return
      }

      setLinked(true)
      toast.success('branding.bz本体に連携しました')
    } catch {
      toast.error('連携中にエラーが発生しました')
    } finally {
      setExporting(null)
    }
  }

  const allColors: { label: string; color: ColorValue }[] = [
    { label: 'メインカラー', color: palette.primary },
    ...palette.secondary.map((c, i) => ({ label: `サブカラー${i + 1}`, color: c })),
    { label: 'アクセントカラー', color: palette.accent },
    { label: '明るい背景', color: palette.neutrals.light },
    { label: '暗い背景/文字', color: palette.neutrals.dark },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Step 5: 確定・出力</h1>

      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">
          <p className="mb-5 text-[13px] text-muted-foreground">
            パレットを確認して確定し、出力や連携を行いましょう
          </p>

          {/* パレット確認 */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{palette.name}</h3>
            <p className="text-sm text-gray-500">{palette.concept}</p>
          </div>
          <AccessibilityBadge score={palette.accessibilityScore} />
        </div>

        {/* カラー一覧 */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {allColors.map((item) => (
            <div key={item.label} className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
              <div
                className="h-10 w-10 flex-shrink-0 rounded-lg border border-gray-200"
                style={{ backgroundColor: item.color.hex }}
              />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400">{item.label}</p>
                <p className="truncate text-sm font-medium text-gray-900">{item.color.name}</p>
                <p className="font-mono text-xs text-gray-500">{item.color.hex.toUpperCase()}</p>
                <p className="text-[10px] text-gray-400">
                  RGB({item.color.rgb.r}, {item.color.rgb.g}, {item.color.rgb.b})
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* プレビュー */}
        <PalettePreview proposal={palette} />
      </div>

          {/* 確定ボタン */}
          {!confirmed && (
            <div className="mt-5 rounded-lg border-2 border-dashed border-blue-200 bg-blue-50 p-5 text-center">
          <p className="mb-3 text-sm text-blue-700">
            このパレットでよろしいですか？確定後も調整ステップに戻れます。
          </p>
          <Button onClick={handleConfirm} size="lg">
            このパレットで確定する
          </Button>
            </div>
          )}

          {/* 出力オプション */}
          {confirmed && (
            <div className="mt-5 space-y-3">
              <h2 className="text-sm font-bold mb-3">出力・連携</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {/* PDF */}
                <button
                  onClick={handleExportPdf}
                  disabled={exporting === 'pdf'}
                  className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-all hover:border-gray-300 hover:shadow-md disabled:opacity-50"
            >
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
                <svg className="h-5 w-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="M12 18v-6" />
                  <path d="M9 15l3 3 3-3" />
                </svg>
              </div>
              <p className="text-sm font-bold text-gray-900">PDFダウンロード</p>
              <p className="mt-0.5 text-xs text-gray-500">カラーガイドシートをPDFで保存</p>
            </button>

                {/* CSS */}
                <button
                  onClick={handleExportCss}
                  className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-all hover:border-gray-300 hover:shadow-md"
            >
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                <svg className="h-5 w-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
              </div>
              <p className="text-sm font-bold text-gray-900">CSS変数コピー</p>
              <p className="mt-0.5 text-xs text-gray-500">カスタムプロパティをクリップボードに</p>
            </button>

                {/* branding.bz連携 */}
                <button
                  onClick={handleLink}
                  disabled={linked || exporting === 'link'}
                  className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-all hover:border-gray-300 hover:shadow-md disabled:opacity-50"
            >
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
                <svg className="h-5 w-5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                </svg>
              </div>
              <p className="text-sm font-bold text-gray-900">
                {linked ? '連携済み' : 'branding.bzに連携'}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {linked ? 'ビジュアルアイデンティティに反映済み' : '管理画面のカラーパレットに反映'}
              </p>
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ナビゲーション（スティッキー） */}
      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-3 flex gap-3">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          調整に戻る
        </Button>
      </div>
    </div>
  )
}

function generateCssVariables(palette: PaletteProposal): string {
  const lines = [
    ':root {',
    `  --color-primary: ${palette.primary.hex};`,
    ...palette.secondary.map((s, i) => `  --color-secondary-${i + 1}: ${s.hex};`),
    `  --color-accent: ${palette.accent.hex};`,
    `  --color-bg-light: ${palette.neutrals.light.hex};`,
    `  --color-text-dark: ${palette.neutrals.dark.hex};`,
    '}',
  ]
  return lines.join('\n')
}
