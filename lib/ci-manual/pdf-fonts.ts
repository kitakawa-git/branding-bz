// フォント登録（@react-pdf/renderer用）
// PDF は CSS font-family フォールバックチェーンをサポートしないため、
// 和文フォント（japanese）を使用し、TTFが無い場合は NotoSansJP にフォールバック
import { Font } from '@react-pdf/renderer'
import { getFontDef, DEFAULT_FONT_ID, type BrandFonts } from '@/lib/brand-fonts'

let lastKey = ''

export function registerFonts(brandFonts?: BrandFonts) {
  const primaryJp = brandFonts?.primary_font?.japanese || DEFAULT_FONT_ID
  const secondaryJp = brandFonts?.secondary_font?.japanese || primaryJp
  const key = `${primaryJp}|${secondaryJp}`
  if (key === lastKey) return
  lastKey = key

  // ブラウザ環境では絶対URLが必要
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  // NotoSansJP は常に登録（フォールバック）
  Font.register({
    family: 'NotoSansJP',
    fonts: [
      { src: `${origin}/fonts/NotoSansJP-Regular.ttf`, fontWeight: 400 },
      { src: `${origin}/fonts/NotoSansJP-Bold.ttf`, fontWeight: 700 },
    ],
  })

  // BrandPrimary エイリアス（和文フォントを使用）
  const pDef = getFontDef(primaryJp)
  if (pDef.ttfRegularFile) {
    Font.register({
      family: 'BrandPrimary',
      fonts: [
        { src: `${origin}/fonts/${pDef.ttfRegularFile}`, fontWeight: 400 },
        { src: `${origin}/fonts/${pDef.ttfBoldFile}`, fontWeight: 700 },
      ],
    })
  } else {
    // カスタム Google Font は TTF 未登録のため NotoSansJP をフォールバック
    Font.register({
      family: 'BrandPrimary',
      fonts: [
        { src: `${origin}/fonts/NotoSansJP-Regular.ttf`, fontWeight: 400 },
        { src: `${origin}/fonts/NotoSansJP-Bold.ttf`, fontWeight: 700 },
      ],
    })
  }

  // BrandSecondary エイリアス（和文フォントを使用）
  const sDef = getFontDef(secondaryJp)
  if (sDef.ttfRegularFile) {
    Font.register({
      family: 'BrandSecondary',
      fonts: [
        { src: `${origin}/fonts/${sDef.ttfRegularFile}`, fontWeight: 400 },
        { src: `${origin}/fonts/${sDef.ttfBoldFile}`, fontWeight: 700 },
      ],
    })
  } else {
    Font.register({
      family: 'BrandSecondary',
      fonts: [
        { src: `${origin}/fonts/NotoSansJP-Regular.ttf`, fontWeight: 400 },
        { src: `${origin}/fonts/NotoSansJP-Bold.ttf`, fontWeight: 700 },
      ],
    })
  }

  // ハイフネーション無効化（日本語テキスト用）
  Font.registerHyphenationCallback((word) => [word])
}
