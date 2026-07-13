'use client'

// パーソナリティ人格の共通表示コンポーネント
// - レーダーチャート（recharts・上限5・青アクセント）
// - パーソナリティ概要文（枠なし・見出しなし・pre-wrap）
// ポータル /portal/personality と診断ツール Step5 の両方から使用する（見た目統一）
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'

export interface RadarPoint {
  name: string
  score: number
}

interface PersonalityRadarProps {
  /** レーダーに描画する {name, score} 配列（3項目以上でチャート表示） */
  data: RadarPoint[]
  /** 概要文（あれば表示・レーダー直下・枠なし・見出しなし） */
  summary?: string | null
  /** チャート最大幅（デフォルト 440px。編集モード等で非表示にしたい場合は hideChart で切替） */
  maxChartWidth?: number
  /** チャート非表示（例: 編集モード中） */
  hideChart?: boolean
  /** 概要文の追加クラス（余白等の微調整用） */
  summaryClassName?: string
}

const radarConfig = {
  score: {
    label: 'スコア',
    // アプリ青アクセント（DB design_tokens(app) → --ds-app-accent）
    color: 'var(--ds-app-accent)',
  },
} satisfies ChartConfig

export function PersonalityRadar({
  data,
  summary,
  maxChartWidth = 440,
  hideChart = false,
  summaryClassName = '',
}: PersonalityRadarProps) {
  const showChart = !hideChart && data.length >= 3

  return (
    <>
      {showChart && (
        <div className="w-full mx-auto mb-0" style={{ maxWidth: `${maxChartWidth}px` }}>
          <ChartContainer config={radarConfig} className="aspect-square">
            <RadarChart data={data} cx="50%" cy="50%" outerRadius="77%">
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <PolarGrid />
              <PolarAngleAxis dataKey="name" tick={{ fontSize: 12 }} />
              <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 10 }} tickCount={6} />
              <Radar
                dataKey="score"
                fill="var(--color-score)"
                fillOpacity={0.2}
                stroke="var(--color-score)"
                strokeWidth={2}
                dot={{ r: 4, fillOpacity: 1, fill: 'var(--color-score)' }}
              />
            </RadarChart>
          </ChartContainer>
        </div>
      )}

      {summary && (
        <p className={`text-base text-foreground/80 leading-relaxed whitespace-pre-wrap m-0 mb-6 ${summaryClassName}`}>
          {summary}
        </p>
      )}
    </>
  )
}
