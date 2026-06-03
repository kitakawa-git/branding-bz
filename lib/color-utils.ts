// カラーユーティリティ関数（chroma-js ベース）
import chroma from 'chroma-js'
import type { PaletteProposal, AccessibilityScore } from '@/lib/types/color-tool'

/** WCAG 2.1 コントラスト比を算出 */
export function getContrastRatio(color1: string, color2: string): number {
  try {
    return chroma.contrast(color1, color2)
  } catch {
    return 0
  }
}

/** パレット全体のアクセシビリティスコアを算出 */
export function calculateAccessibilityScore(
  palette: PaletteProposal
): AccessibilityScore {
  const primaryOnLight = getContrastRatio(palette.primary.hex, palette.neutrals.light.hex)
  const primaryOnDark = getContrastRatio(palette.primary.hex, palette.neutrals.dark.hex)
  const accentOnLight = getContrastRatio(palette.accent.hex, palette.neutrals.light.hex)

  return {
    primaryOnLight,
    primaryOnDark,
    accentOnLight,
    passes: primaryOnLight >= 4.5 && accentOnLight >= 4.5,
  }
}
