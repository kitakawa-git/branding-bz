'use client'

// ブランドの人格 統合カード（共通コンポーネント）
// - 見出し「ブランドの人格」
// - レーダーチャート＋パーソナリティ概要（PersonalityRadar）
// - 特性リスト（PersonalityTraitList）
// - 右上に任意のアクション（微調整ボタンや調整済みバッジなど）を差し込める（headerRight prop）
// 使用場所: 診断ツール Step5（非編集モード）とポータル /portal/personality の両方
import { CSSProperties, ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { PersonalityRadar, type RadarPoint } from './PersonalityRadar'
import { PersonalityTraitList, type PersonalityTraitItem } from './PersonalityTraitList'

interface BrandPersonaCardProps {
  chartData: RadarPoint[]
  summary?: string | null
  traits: PersonalityTraitItem[]
  /** 見出し右側に差し込む要素（微調整ボタン・調整済みバッジなど） */
  headerRight?: ReactNode
  /** レーダーチャート最大幅（デフォルト440） */
  maxChartWidth?: number
  /** レーダー・概要を隠す（編集モード等） */
  hideChart?: boolean
  /** 特性リストの直前に差し込む要素（編集モードのスライダー UI 等） */
  traitListReplacement?: ReactNode
  /** ポータルのブランドフォント適用用 */
  bodyTextStyle?: CSSProperties
  className?: string
}

export function BrandPersonaCard({
  chartData,
  summary,
  traits,
  headerRight,
  maxChartWidth = 440,
  hideChart = false,
  traitListReplacement,
  bodyTextStyle,
  className = '',
}: BrandPersonaCardProps) {
  return (
    <Card className={`bg-[hsl(0_0%_97%)] border shadow-none ${className}`}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground tracking-wide">ブランドの人格</h2>
          {headerRight && <div className="flex items-center gap-2">{headerRight}</div>}
        </div>

        <PersonalityRadar
          data={chartData}
          summary={summary}
          maxChartWidth={maxChartWidth}
          hideChart={hideChart}
          summaryClassName="mb-4"
        />

        {traitListReplacement ?? <PersonalityTraitList traits={traits} bodyTextStyle={bodyTextStyle} />}
      </CardContent>
    </Card>
  )
}
