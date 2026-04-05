'use client'

// ミニアプリ共通: Step 5 出力アクションボタン（PDF出力 / branding.bz連携 / やり直し）
import { Button } from '@/components/ui/button'
import { Download, Link as LinkIcon, RotateCcw, Loader2 } from 'lucide-react'

interface ToolExportActionsProps {
  onExportPdf: () => void
  onConnect: () => void
  onReset: () => void
  isExporting?: boolean
  isConnecting?: boolean
  isConnected?: boolean
  pdfLabel?: string
  pdfLoadingLabel?: string
  connectLabel?: string
  connectLoadingLabel?: string
  connectVariant?: 'default' | 'outline'
  showConnect?: boolean
  resetLabel?: string
}

export function ToolExportActions({
  onExportPdf,
  onConnect,
  onReset,
  isExporting = false,
  isConnecting = false,
  isConnected = false,
  pdfLabel = 'PDF出力',
  pdfLoadingLabel = 'PDF生成中...',
  connectLabel = 'branding.bz に連携',
  connectLoadingLabel = '連携中...',
  connectVariant = 'default',
  showConnect = true,
  resetLabel = '最初からやり直す',
}: ToolExportActionsProps) {
  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        {/* PDF出力 */}
        <Button
          onClick={onExportPdf}
          disabled={isExporting}
          className="flex-1 gap-2"
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {isExporting ? pdfLoadingLabel : pdfLabel}
        </Button>

        {/* branding.bz 連携 */}
        {showConnect && (
          <Button
            onClick={onConnect}
            disabled={isConnecting || isConnected}
            variant={connectVariant}
            className="flex-1 gap-2"
          >
            {isConnecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LinkIcon className="h-4 w-4" />
            )}
            {isConnecting ? connectLoadingLabel : isConnected ? '連携済み' : connectLabel}
          </Button>
        )}
      </div>

      {/* 最初からやり直す */}
      <div className="text-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="text-xs text-gray-500"
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          {resetLabel}
        </Button>
      </div>
    </div>
  )
}
