// 目標設定ダイアログ Step 1（ミッション・バリュー表示 + 目標入力）
import { splitBrandCopy } from '@/lib/brand-mvv'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { X } from 'lucide-react'
import {
  PERIOD_TYPE_LABELS,
  PERIOD_DURATION_LABELS,
  getPeriodTitle,
  type BrandValue,
  type GoalPeriod,
} from './kpi-utils'
import { ConceptVisualBackdrop } from '@/components/brand/ConceptVisualBackdrop'

type Props = {
  setupStep: 0 | 1 | 2
  setSetupStep: (step: 0 | 1 | 2) => void
  goalPeriod: GoalPeriod | null
  missionText: string | null
  valuesData: BrandValue[]
  conceptVisualUrl: string | null
  setupGoalText: string
  setSetupGoalText: (text: string) => void
  handleGoalStepNext: () => void
}

export function GoalSetupDialog({
  setupStep,
  setSetupStep,
  goalPeriod,
  missionText,
  valuesData,
  conceptVisualUrl,
  setupGoalText,
  setSetupGoalText,
  handleGoalStepNext,
}: Props) {
  return (
    <Dialog open={setupStep === 1} onOpenChange={open => { if (!open) setSetupStep(0) }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <div className="sticky top-0 bg-background z-10 border-b px-6 py-4 flex items-center justify-between">
          <DialogTitle className="text-base font-bold">{getPeriodTitle(goalPeriod)}</DialogTitle>
          <button onClick={() => setSetupStep(0)} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          <div>
            <p className="text-sm text-foreground font-semibold mb-1">
              &ldquo;ブランドにどう貢献するか&rdquo;を宣言しましょう。
            </p>
            <p className="text-xs text-muted-foreground">
              ミッションとバリューを踏まえ、具体的かつ測定できる目標を記入してください。
            </p>
          </div>

          {(missionText || valuesData.length > 0) && (
            // 背景はダッシュボードの「私たちのミッション」カードと同じ（コンセプトビジュアル＋白い紗）
            <div className="relative overflow-hidden rounded-xl border bg-[hsl(0_0%_97%)]">
              <ConceptVisualBackdrop url={conceptVisualUrl} />
              <div className="relative p-4 space-y-4">
              {missionText && (() => {
                const { copy, body } = splitBrandCopy(missionText)
                return (
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">私たちのミッション</Label>
                    {copy && <p className="text-base sm:text-sm font-semibold text-foreground mt-1 m-0 leading-relaxed">{copy}</p>}
                    {body && <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line mt-1 m-0">{body}</p>}
                  </div>
                )
              })()}
              {valuesData.length > 0 && (
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">私たちのバリュー</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    {valuesData.map((v, i) => (
                      <div key={i} className="bg-background rounded-md p-2.5 border">
                        <p className="text-sm font-bold text-foreground m-0">{v.name}</p>
                        {v.description && <p className="text-[11px] text-muted-foreground mt-0.5 m-0 whitespace-pre-line">{v.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs font-bold mb-1.5 block">
              あなたの{goalPeriod ? `${PERIOD_TYPE_LABELS[goalPeriod.type]}（${PERIOD_DURATION_LABELS[goalPeriod.type] || ''}）` : ''}目標
            </Label>
            <Textarea
              value={setupGoalText}
              onChange={e => setSetupGoalText(e.target.value)}
              rows={3}
              className="resize-none"
              placeholder="例：ブランド学習動画を月2本公開し、社内の理解度を30%向上させる"
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-background z-10 border-t px-6 py-4">
          <Button onClick={handleGoalStepNext} className="w-full">
            次へ — KPIを設定する
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
