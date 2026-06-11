'use client'

// Step 4: AI診断実行
// ステージ1ではUI骨格のみ。診断ロジック（AI呼び出し）はステージ2で実装する。
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Sparkles } from 'lucide-react'

interface Step4Props {
  onBack: () => void
}

export function Step4Diagnosis({ onBack }: Step4Props) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Step 4: AI診断</h1>

      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-8 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-blue-600" strokeWidth={1.5} />
          <h2 className="mt-4 text-base font-bold text-foreground">
            回答をもとに、AIがブランドの人格を生成します
          </h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Aaker 5次元スコアと12アーキタイプを同時に算出し、<br className="hidden sm:block" />
            トーンオブボイス・期待印象タグまで一括で提案します。
          </p>
          <div className="mt-6">
            <Button disabled className="gap-1.5">
              <Sparkles className="h-4 w-4" />
              AI診断を実行（次のアップデートで利用可能）
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            ※ AI診断ロジックは実装ステージ2で提供予定です
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
