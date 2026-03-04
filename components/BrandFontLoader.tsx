'use client'

import { getGoogleFontsUrl, type BrandFonts } from '@/lib/brand-fonts'

/** Google Fonts CDN <link> を挿入するコンポーネント */
export function BrandFontLoader({ fonts }: { fonts: BrandFonts | null }) {
  if (!fonts) return null
  const url = getGoogleFontsUrl(fonts)
  if (!url) return null
  return (
    // eslint-disable-next-line @next/next/no-page-custom-font
    <link rel="stylesheet" href={url} />
  )
}
