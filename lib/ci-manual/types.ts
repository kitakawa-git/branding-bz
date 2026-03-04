// CIマニュアル PDF出力用 型定義

export type ValueItem = { name: string; description: string; added_index: number }
export type HistoryItem = { year: string; event: string }
export type BusinessItem = { title: string; description: string; added_index: number }
export type TraitItem = { name: string; score: number; description: string; added_index: number }

export type ColorItem = { name: string; hex: string }
export type ColorPalette = {
  brand_colors: ColorItem[]
  secondary_colors: ColorItem[]
  accent_colors: ColorItem[]
  utility_colors: ColorItem[]
}
import type { BrandFonts } from '@/lib/brand-fonts'
export type LogoItem = { url: string; caption: string; added_index: number }
export type LogoSection = { title: string; items: LogoItem[] }
export type GuidelineImage = { url: string; caption: string; added_index: number }

export type TermItem = {
  preferred_term: string
  avoided_term: string
  context: string
  category: string
}

export type PersonaItem = {
  name: string
  age_range: string
  occupation: string
  description: string
  needs: string[]
  pain_points: string[]
}

export type ActionGuideline = { title: string; description: string }

export type PositioningMapSize = 'sm' | 'md' | 'lg' | 'custom'
export type PositioningMapItem = {
  name: string
  color: string
  x: number
  y: number
  size: PositioningMapSize
  customSize?: number
}
export type PositioningMapData = {
  x_axis: { left: string; right: string }
  y_axis: { bottom: string; top: string }
  items: PositioningMapItem[]
}

// セクション選択
export type SelectedSections = {
  cover: boolean
  toc: boolean
  guidelines: boolean
  visuals: boolean
  verbal: boolean
  strategy: boolean
  colophon: boolean
}

// CIマニュアル全データ
export type CIManualData = {
  company: {
    name: string
    logo_url: string | null
  }
  guidelines: {
    slogan: string | null
    concept_visual_url: string | null
    brand_statement: string | null
    mission: string | null
    vision: string | null
    values: ValueItem[]
    brand_story: string | null
    history: HistoryItem[]
    business_content: BusinessItem[]
    traits: TraitItem[]
  } | null
  visuals: {
    color_palette: ColorPalette
    fonts: BrandFonts | null
    logo_concept: string | null
    logo_sections: LogoSection[]
    visual_guidelines: string | null
    visual_guidelines_images: GuidelineImage[]
  } | null
  verbal: {
    tone_of_voice: string | null
    terms: TermItem[]
  } | null
  strategy: {
    target: string | null
    personas: PersonaItem[]
    positioning_map_data: PositioningMapData | null
    action_guidelines: ActionGuideline[]
  } | null
  brandColor: string
}
