'use client'

// ブランドの人格 特性リスト（共通コンポーネント）
// - 各特性を「左：ラベル/コピー/説明 + 右：44px青バッジ /5」の横フレックスカードで表示
// - Aaker 5次元（診断ツール表示モード）とポータル ブランドパーソナリティ の両方から使用
// - 編集モード（スライダー編集）は Step5 独自の派生のため本コンポーネントの対象外
import { CSSProperties } from 'react'

export interface PersonalityTraitItem {
  name: string
  score: number
  copy?: string | null
  description?: string | null
}

interface PersonalityTraitListProps {
  traits: PersonalityTraitItem[]
  /** ポータルのブランドフォント適用用のインラインスタイル（省略可） */
  bodyTextStyle?: CSSProperties
  className?: string
}

export function PersonalityTraitList({ traits, bodyTextStyle, className = '' }: PersonalityTraitListProps) {
  if (!traits.length) return null

  return (
    <div className={`space-y-2 ${className}`}>
      {traits.map((trait, i) => (
        <div
          key={`${trait.name}-${i}`}
          className="rounded-lg border border-border bg-background p-4 flex items-center gap-4"
        >
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground mb-0.5 m-0">{trait.name}</p>
            {trait.copy && (
              <p className="text-[18px] font-semibold text-foreground mt-0.5 m-0" style={bodyTextStyle}>
                {trait.copy}
              </p>
            )}
            {trait.description && (
              <p
                className="text-base sm:text-sm text-foreground/70 leading-[1.8] whitespace-pre-wrap mt-1 m-0"
                style={bodyTextStyle}
              >
                {trait.description}
              </p>
            )}
          </div>
          <div className="shrink-0 text-center">
            <div className="w-11 h-11 rounded-full bg-ds-app-accent text-white flex items-center justify-center text-base font-bold">
              {trait.score}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">/5</div>
          </div>
        </div>
      ))}
    </div>
  )
}
