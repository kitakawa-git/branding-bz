'use client'

// ツール（STP・パーソナリティ等）の Step5 末尾共通アクション。
// - branding.bz への連携 Card（管理者のみ outline ボタン表示／未管理者は誘導文）
// - 任意で「最初からやり直す」ghost ボタン
//
// 「管理者判定中（checkingAdmin=true）」の間は Card 自体を描画しない（ボタンのチラつき防止）。
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Unplug, RotateCcw } from 'lucide-react'

export interface ToolConnectActionsProps {
  /** 管理者判定中。true の間は連携Cardを描画しない */
  checkingAdmin?: boolean
  /** admin_users に存在する管理者か */
  isAdminUser: boolean
  /** 管理者向け説明文（例: 「STP分析の結果をブランド管理プラットフォームに登録できます…」） */
  adminDescription: string
  /** 未管理者向け説明文（省略時は標準文を使用） */
  nonAdminDescription?: string
  /** 連携ボタンクリック */
  onConnectClick: () => void
  /** 連携ボタンのラベル（省略時は「連携する項目を選ぶ」） */
  connectLabel?: string
  /** 「最初からやり直す」ハンドラ。省略時は非表示 */
  onRestart?: () => void
}

const DEFAULT_NON_ADMIN_DESCRIPTION =
  '本体への連携には branding.bz の企業アカウント（管理者）が必要です。結果はPDFでダウンロードしてご活用ください。'

export function ToolConnectActions({
  checkingAdmin = false,
  isAdminUser,
  adminDescription,
  nonAdminDescription = DEFAULT_NON_ADMIN_DESCRIPTION,
  onConnectClick,
  connectLabel = '連携する項目を選ぶ',
  onRestart,
}: ToolConnectActionsProps) {
  return (
    <>
      {!checkingAdmin && (
        <Card className="mt-4 bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <h3 className="text-sm font-bold text-foreground mb-2">branding.bz への連携</h3>
            {isAdminUser ? (
              <>
                <p className="text-xs text-muted-foreground mb-3">{adminDescription}</p>
                <Button variant="outline" onClick={onConnectClick} className="h-auto gap-2 px-5 py-2.5 text-sm">
                  <Unplug className="h-4 w-4" />
                  {connectLabel}
                </Button>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">{nonAdminDescription}</p>
            )}
          </CardContent>
        </Card>
      )}

      {onRestart && (
        <div className="mt-4 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRestart}
            className="text-xs text-gray-500"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            最初からやり直す
          </Button>
        </div>
      )}
    </>
  )
}
