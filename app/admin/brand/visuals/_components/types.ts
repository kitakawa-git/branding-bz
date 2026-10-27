// ビジュアルアイデンティティ編集ページの型・定数
import { type PortalSubtitles } from '@/lib/portal-subtitles'
import { type BrandFonts } from '@/lib/brand-fonts'
import { type LogoItem, type GuidelineImage, type LogoBaseImage } from './sortable'

export type LogoSection = { title: string; items: LogoItem[] }

export type ColorItem = { name: string; hex: string }
export type ColorPalette = {
  brand_colors: ColorItem[]
  secondary_colors: ColorItem[]
  accent_colors: ColorItem[]
  utility_colors: ColorItem[]
}

export type ColorCategory = keyof ColorPalette

export const COLOR_CATEGORIES: { key: ColorCategory; label: string; minColors: number }[] = [
  { key: 'brand_colors', label: 'プライマリカラー', minColors: 1 },
  { key: 'secondary_colors', label: 'セカンダリカラー', minColors: 0 },
  { key: 'accent_colors', label: 'アクセントカラー', minColors: 0 },
  { key: 'utility_colors', label: 'その他', minColors: 0 },
]

export const DEFAULT_PALETTE: ColorPalette = {
  brand_colors: [{ name: 'Primary', hex: '#1a1a1a' }],
  secondary_colors: [{ name: 'Secondary', hex: '#666666' }],
  accent_colors: [{ name: 'Accent', hex: '#2563eb' }],
  utility_colors: [],
}

export type Visuals = {
  fonts: BrandFonts
  visual_guidelines: string
  visual_guidelines_images: GuidelineImage[]
  visual_guidelines_sort: 'registered' | 'custom'
  // ロゴ基本形画像（複数枚・キャプション付き・ロゴコンセプトの上に表示）
  logo_images: LogoBaseImage[]
  logo_concept: string
  logo_sections: LogoSection[]
  logo_sections_sort: 'registered' | 'custom'
  color_palette: ColorPalette
}

export type VisualsCache = {
  visualsId: string | null
  visuals: Visuals
  portalSubtitle: string
  portalSubtitlesData: PortalSubtitles | null
}

export type SetVisuals = React.Dispatch<React.SetStateAction<Visuals>>
