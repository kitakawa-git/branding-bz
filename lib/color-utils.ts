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

/** WCAG AA基準を満たすか判定（通常テキスト: 4.5:1、大きいテキスト: 3:1） */
export function meetsWcagAA(
  foreground: string,
  background: string,
  isLargeText = false
): boolean {
  const ratio = getContrastRatio(foreground, background)
  return isLargeText ? ratio >= 3 : ratio >= 4.5
}

/** HEX → RGB 変換 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  try {
    const [r, g, b] = chroma(hex).rgb()
    return { r, g, b }
  } catch {
    return { r: 0, g: 0, b: 0 }
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

/** 2色間の色差（知覚的な違い）を算出 */
export function colorDifference(color1: string, color2: string): number {
  try {
    return chroma.deltaE(color1, color2)
  } catch {
    return 0
  }
}

/** HEXが有効か判定 */
export function isValidHex(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex)
}
