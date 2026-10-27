// ターゲットカード（ターゲット概要＋主なターゲット＋ターゲット適合マップ）
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import { TargetFitMapStatic } from '@/components/TargetFitMapStatic'
import type { TargetFitMap } from '@/app/tools/stp/app/[sessionId]/page'
import { WandSparkles, Loader2 } from 'lucide-react'
import { TitleDescriptionList } from '@/components/shared/TitleDescriptionList'
import { TARGET_SUGGEST_MONTHLY_LIMIT } from '@/lib/constants/ai-limits'
import { type TargetSegment } from './types'

// ISO日時（翌月1日00:00 JST）を「○月○日」表記に
const formatResetDate = (iso: string | null): string => {
  if (!iso) return ''
  const jst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000)
  return `${jst.getUTCMonth() + 1}月${jst.getUTCDate()}日`
}

type Props = {
  targetOverview: string
  onTargetOverviewChange: (value: string) => void
  targetSegments: TargetSegment[]
  onTargetSegmentsChange: (segments: TargetSegment[]) => void
  targetFitMapData: TargetFitMap | null
  targetSuggesting: boolean
  targetRemaining: number | null
  targetResetsAt: string | null
  onSuggestTargets: () => void
}

export function TargetCard({
  targetOverview,
  onTargetOverviewChange,
  targetSegments,
  onTargetSegmentsChange,
  targetFitMapData,
  targetSuggesting,
  targetRemaining,
  targetResetsAt,
  onSuggestTargets,
}: Props) {
  return (
    <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
      <CardContent className="p-5 space-y-8">
        {/* ターゲット概要（プロセス文） */}
        <div>
          <h2 className="text-xs font-bold mb-3">ターゲット概要</h2>
          <AutoResizeTextarea
            value={targetOverview}
            onChange={(e) => onTargetOverviewChange(e.target.value)}
            placeholder="ターゲット全体の考え方・方針の概要文（任意）"
            className="min-h-[90px]"
          />
        </div>

        {/* 主なターゲット */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-gray-700">主なターゲット</span>
              <span className="text-xs text-gray-400">（任意）</span>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onSuggestTargets}
              disabled={targetSuggesting || targetRemaining === 0}
              className="text-sm"
            >
              {targetSuggesting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <WandSparkles size={14} />
              )}
              {targetSuggesting ? 'AI提案中...' : 'AIで提案'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            {targetRemaining === 0
              ? `AI提案は今月の利用上限に達しました（${formatResetDate(targetResetsAt)}にリセット）`
              : targetRemaining !== null
                ? `AIによる提案は月${TARGET_SUGGEST_MONTHLY_LIMIT}回まで・今月あと ${targetRemaining} 回`
                : `AIによる提案は月${TARGET_SUGGEST_MONTHLY_LIMIT}回まで`}
          </p>
          <TitleDescriptionList
            label=""
            items={targetSegments.map(ts => ({ title: ts.name, description: ts.description }))}
            onChange={(newItems) => {
              onTargetSegmentsChange(newItems.map(item => ({ name: item.title, description: item.description })))
            }}
            addButtonLabel="ターゲットを追加"
            titlePlaceholder="セグメント名（例: 中小企業の経営者）"
            descriptionPlaceholder="セグメントの説明"
          />
        </div>

        {/* ターゲット適合マップ（STP連携・読み取り表示） */}
        {targetFitMapData && (
          <div>
            <h2 className="text-xs font-bold mb-3">ターゲット適合マップ</h2>
            <p className="mb-4 text-[13px] text-muted-foreground">
              選んだターゲットが自社のカバー範囲に入っているかをチェックした結果です。
            </p>
            <TargetFitMapStatic fitMap={targetFitMapData} />
            {targetFitMapData.axis_rationale && (
              <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground">軸選定の根拠: </span>
                {targetFitMapData.axis_rationale}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
