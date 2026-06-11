'use client'

// Step 5: 結果表示・微調整・PDF・本体連携
// ステージ1では骨格のみ。結果表示はステージ3で実装する。
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'

interface Step5Props {
  onBack: () => void
}

export function Step5Result({ onBack }: Step5Props) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Step 5: 診断結果</h1>

      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            診断結果の表示・微調整・PDF出力は実装ステージ3で提供予定です。
          </p>
        </CardContent>
      </Card>

      {/* フッターナビゲーション */}
      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-3 flex justify-start">
        <Button variant="outline" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          戻る
        </Button>
      </div>
    </div>
  )
}
