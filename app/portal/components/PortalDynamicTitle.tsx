'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { usePortalAuth } from './PortalDataProvider'

const titleMap: Record<string, string> = {
  '/portal': 'ダッシュボード',
  '/portal/about': '私たちについて',
  '/portal/timeline': 'タイムライン',
  '/portal/announcements': 'お知らせ',
  '/portal/kpi': '目標・KPI',
  '/portal/learning': 'ラーニング',
  '/portal/guidelines': 'ブランド方針',
  '/portal/personality': 'ブランドパーソナリティ',
  '/portal/strategy': 'ブランド戦略',
  '/portal/visuals': 'ビジュアル',
  '/portal/verbal': 'バーバル',
  '/portal/profile': 'マイプロフィール',
}

export function PortalDynamicTitle() {
  const pathname = usePathname()
  const { companyName } = usePortalAuth()

  useEffect(() => {
    const pageName = titleMap[pathname]
    if (!pageName) return
    if (companyName) {
      document.title = `${pageName} | ${companyName} on branding.bz`
    } else {
      document.title = `${pageName} | branding.bz`
    }
  }, [pathname, companyName])

  return null
}
