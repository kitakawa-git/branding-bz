// ブランドフォント共通設定

export type BrandFontDef = {
  id: string
  label: string
  style: string
  googleFontsFamily: string
  cssFamily: string
  ttfRegularFile: string
  ttfBoldFile: string
}

export const BRAND_FONTS: BrandFontDef[] = [
  {
    id: 'Noto Sans JP',
    label: 'Noto Sans JP',
    style: 'ゴシック',
    googleFontsFamily: 'Noto+Sans+JP:wght@400;700',
    cssFamily: '"Noto Sans JP", sans-serif',
    ttfRegularFile: 'NotoSansJP-Regular.ttf',
    ttfBoldFile: 'NotoSansJP-Bold.ttf',
  },
  {
    id: 'Zen Kaku Gothic New',
    label: 'Zen Kaku Gothic New',
    style: 'モダンゴシック',
    googleFontsFamily: 'Zen+Kaku+Gothic+New:wght@400;700',
    cssFamily: '"Zen Kaku Gothic New", sans-serif',
    ttfRegularFile: 'ZenKakuGothicNew-Regular.ttf',
    ttfBoldFile: 'ZenKakuGothicNew-Bold.ttf',
  },
  {
    id: 'M PLUS 1p',
    label: 'M PLUS 1p',
    style: '丸ゴシック',
    googleFontsFamily: 'M+PLUS+1p:wght@400;700',
    cssFamily: '"M PLUS 1p", sans-serif',
    ttfRegularFile: 'MPLUS1p-Regular.ttf',
    ttfBoldFile: 'MPLUS1p-Bold.ttf',
  },
  {
    id: 'BIZ UDPGothic',
    label: 'BIZ UDPGothic',
    style: 'ビジネスゴシック',
    googleFontsFamily: 'BIZ+UDPGothic:wght@400;700',
    cssFamily: '"BIZ UDPGothic", sans-serif',
    ttfRegularFile: 'BIZUDPGothic-Regular.ttf',
    ttfBoldFile: 'BIZUDPGothic-Bold.ttf',
  },
  {
    id: 'Zen Old Mincho',
    label: 'Zen Old Mincho',
    style: '明朝',
    googleFontsFamily: 'Zen+Old+Mincho:wght@400;700',
    cssFamily: '"Zen Old Mincho", serif',
    ttfRegularFile: 'ZenOldMincho-Regular.ttf',
    ttfBoldFile: 'ZenOldMincho-Bold.ttf',
  },
  {
    id: 'Noto Serif JP',
    label: 'Noto Serif JP',
    style: '明朝',
    googleFontsFamily: 'Noto+Serif+JP:wght@400;700',
    cssFamily: '"Noto Serif JP", serif',
    ttfRegularFile: 'NotoSerifJP-Regular.ttf',
    ttfBoldFile: 'NotoSerifJP-Bold.ttf',
  },
  {
    id: 'Shippori Mincho',
    label: 'Shippori Mincho',
    style: '明朝',
    googleFontsFamily: 'Shippori+Mincho:wght@400;700',
    cssFamily: '"Shippori Mincho", serif',
    ttfRegularFile: 'ShipporiMincho-Regular.ttf',
    ttfBoldFile: 'ShipporiMincho-Bold.ttf',
  },
]

export const DEFAULT_FONT_ID = 'Noto Sans JP'
export const FONT_PREVIEW_TEXT = 'ABCabc 123 あいうえお アイウエオ 漢字表示'

// --- 新しい型定義 ---

export type FontSource = 'google' | 'manual'

export type BrandFontRole = {
  latin: string
  japanese: string
  latin_source: FontSource
  japanese_source: FontSource
}

export type BrandFonts = {
  primary_font: BrandFontRole
  secondary_font: BrandFontRole
}

export const DEFAULT_FONT_ROLE: BrandFontRole = {
  latin: DEFAULT_FONT_ID,
  japanese: DEFAULT_FONT_ID,
  latin_source: 'google',
  japanese_source: 'google',
}

/** ID → フォント定義ルックアップ（未設定→Noto Sans JP）
 *  BRAND_FONTS に無い場合は Google Fonts として動的に定義を生成 */
export function getFontDef(fontId: string | null | undefined): BrandFontDef {
  if (!fontId) return BRAND_FONTS[0]
  const found = BRAND_FONTS.find(f => f.id === fontId)
  if (found) return found
  // Google Fonts から選択されたカスタムフォント
  const encoded = fontId.replace(/ /g, '+')
  return {
    id: fontId,
    label: fontId,
    style: '',
    googleFontsFamily: `${encoded}:wght@400;700`,
    cssFamily: `"${fontId}", sans-serif`,
    ttfRegularFile: '',
    ttfBoldFile: '',
  }
}

/** BrandFontRole から CSS font-family 文字列を生成（欧文→和文→汎用） */
export function getCssFontFamily(role: BrandFontRole): string {
  const { latin, japanese } = role
  const jpDef = getFontDef(japanese)
  const isSerif = jpDef.cssFamily.includes('serif') && !jpDef.cssFamily.includes('sans-serif')
  const fallback = isSerif ? 'serif' : 'sans-serif'

  if (latin === japanese) {
    return `"${latin}", ${fallback}`
  }
  return `"${latin}", "${japanese}", ${fallback}`
}

/** BrandFontRole の表示用ラベル */
export function getFontRoleLabel(role: BrandFontRole): string {
  if (role.latin === role.japanese) return role.latin
  return `${role.latin} / ${role.japanese}`
}

/**
 * DBから読み込んだfontsをパース（3形式対応）
 * 形式A (最古): { latin: { primary, secondary }, japanese: { primary, secondary } }
 * 形式B (旧):   { primary: "Noto Sans JP", secondary: "M PLUS 1p" }
 * 形式C (新):   { primary_font: { latin, japanese, latin_source, japanese_source }, secondary_font: {...} }
 */
export function parseFontsFromDB(raw: unknown): BrandFonts {
  if (!raw || typeof raw !== 'object') {
    return { primary_font: { ...DEFAULT_FONT_ROLE }, secondary_font: { ...DEFAULT_FONT_ROLE } }
  }

  const obj = raw as Record<string, unknown>

  // 形式C: primary_font キーがある（新形式）
  if ('primary_font' in obj && typeof obj.primary_font === 'object' && obj.primary_font !== null) {
    const pf = obj.primary_font as Record<string, unknown>
    const sf = (typeof obj.secondary_font === 'object' && obj.secondary_font !== null)
      ? (obj.secondary_font as Record<string, unknown>)
      : pf
    return {
      primary_font: parseFontRole(pf),
      secondary_font: parseFontRole(sf),
    }
  }

  // 形式B: トップレベルに primary がある
  if ('primary' in obj && !('latin' in obj)) {
    const primary = validateFontId((obj.primary as string) || '')
    const secondary = validateFontId((obj.secondary as string) || primary)
    return {
      primary_font: { latin: primary, japanese: primary, latin_source: 'google', japanese_source: 'google' },
      secondary_font: { latin: secondary, japanese: secondary, latin_source: 'google', japanese_source: 'google' },
    }
  }

  // 形式A: latin/japanese キーがある
  const japanese = obj.japanese as { primary?: string; secondary?: string } | undefined
  const primary = validateFontId(japanese?.primary || '')
  const secondary = validateFontId(japanese?.secondary || primary)
  return {
    primary_font: { latin: primary, japanese: primary, latin_source: 'google', japanese_source: 'google' },
    secondary_font: { latin: secondary, japanese: secondary, latin_source: 'google', japanese_source: 'google' },
  }
}

function parseFontRole(obj: Record<string, unknown>): BrandFontRole {
  return {
    latin: validateFontId((obj.latin as string) || ''),
    japanese: validateFontId((obj.japanese as string) || ''),
    latin_source: ((obj.latin_source as string) === 'manual' ? 'manual' : 'google') as FontSource,
    japanese_source: ((obj.japanese_source as string) === 'manual' ? 'manual' : 'google') as FontSource,
  }
}

function validateFontId(id: string): string {
  return id || DEFAULT_FONT_ID
}

/** Google Fonts CDN <link> URL を生成（source=google のフォントのみ） */
export function getGoogleFontsUrl(fonts: BrandFonts): string {
  const googleFontIds = new Set<string>()
  for (const role of [fonts.primary_font, fonts.secondary_font]) {
    if (role.latin_source === 'google') googleFontIds.add(role.latin)
    if (role.japanese_source === 'google') googleFontIds.add(role.japanese)
  }
  if (googleFontIds.size === 0) return ''
  const families = [...googleFontIds].map(id => getFontDef(id).googleFontsFamily)
  return `https://fonts.googleapis.com/css2?${families.map(f => `family=${f}`).join('&')}&display=swap`
}
