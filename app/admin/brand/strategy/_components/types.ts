// ブランド戦略 編集ページの型（ペルソナ・主なターゲット・提供価値・ページキャッシュ）
import { type PortalSubtitles } from '@/lib/portal-subtitles'
import type { TargetFitMap, BrandStanceStatement } from '@/app/tools/stp/app/[sessionId]/page'
import type { PositioningMapData } from '@/lib/types/positioning-map'

export type PersonaItem = {
  // id は保存時の id保持sync 用（既存行はUPDATE・新規はINSERT）。新規入力時は未定義。
  id?: string
  name: string
  avatar_emoji: string // 顔アイコン（絵文字）。Persona Builder→connect で来る・ここで編集
  age_range: string
  occupation: string
  description: string
  needs: string[]
  pain_points: string[]
  // Tier1 離散カラム（Persona Builder の goals 由来。persona_data には残しつつ正本は離散カラム）
  decision_factors: string[]
  buying_barriers: string[]
  brand_expectations: string
}

export type TargetSegment = {
  name: string
  description: string
}

// 提供価値（value_propositions テーブル。「考え方」から「接し方」へ移動・統合）
// id は保存時の id保持sync 用（既存行はUPDATE・新規はINSERT）。新規入力時は未定義。
export type ProvidedValueItem = {
  id?: string
  title: string
  description: string
}

export type BrandStanceStatements = { statements: BrandStanceStatement[] }

export type CompetitorAnalysisItem = { name: string; traits: string }

export type StrategyCache = {
  targetOverview: string
  targetSegments: TargetSegment[]
  providedValues: ProvidedValueItem[]
  personas: PersonaItem[]
  positioningMapData: PositioningMapData | null
  targetFitMapData: TargetFitMap | null
  brandStanceStatements: { statements: BrandStanceStatement[] } | null
  strengths: string
  competitorsAnalysis: Array<{ name: string; traits: string }>
  portalSubtitle: string
  portalSubtitlesData: PortalSubtitles | null
}
