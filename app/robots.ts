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
          '/tools/colors/app/',
          '/tools/stp/app/',
          '/tools/persona/app/',
          '/tools/colors/auth/',
          '/tools/stp/auth/',
          '/tools/persona/auth/',
        ],
      },
    ],
    sitemap: 'https://branding.bz/sitemap.xml',
  }
}
