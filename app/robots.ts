import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/portal/',
          '/superadmin/',
          '/signup',
          // PDF 直リンクが検索結果に出てフォームを迂回されないよう塞ぐ（ページ /document は許可）
          '/documents/',
          '/tools/colors/app/',
          '/tools/stp/app/',
          '/tools/persona/app/',
          '/tools/personality/app/',
          '/tools/sorou/app/',
          // 日程調整の共有リンク（参加者だけが見るページ）
          '/tools/sorou/e/',
          '/tools/colors/auth/',
          '/tools/stp/auth/',
          '/tools/persona/auth/',
          '/tools/personality/auth/',
        ],
      },
    ],
    sitemap: 'https://branding.bz/sitemap.xml',
  }
}
