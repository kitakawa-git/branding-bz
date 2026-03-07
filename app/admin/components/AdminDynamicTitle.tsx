'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from './AuthProvider'
import { supabase } from '@/lib/supabase'

const titleMap: Record<string, string> = {
  '/admin/dashboard': 'ダッシュボード',
  '/admin/members': 'アカウント一覧',
  '/admin/company': 'ブランド基本情報',
  '/admin/brand/guidelines': 'ブランド方針',
  '/admin/brand/visuals': 'ビジュアル',
  '/admin/brand/verbal': 'バーバル',
  '/admin/brand/strategy': 'ブランド戦略',
  '/admin/analytics': 'アクセス解析',
  '/admin/card-template': 'QRコード出力',
  '/admin/announcements': 'お知らせ管理',
  '/admin/kpi': '目標管理',
  '/admin/ci-manual': 'CIマニュアル出力',
}

export function AdminDynamicTitle() {
  const pathname = usePathname()
  const { companyId } = useAuth()
  const [companyName, setCompanyName] = useState<string | null>(null)

  useEffect(() => {
    if (!companyId) return
    supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single()
      .then(({ data }) => {
        if (data?.name) setCompanyName(data.name)
      })
  }, [companyId])

  useEffect(() => {
    const pageName = titleMap[pathname]
    if (!pageName) return
    if (companyName) {
      document.title = `管理 ${pageName} | ${companyName} on branding.bz`
    } else {
      document.title = `管理 ${pageName} | branding.bz`
    }
  }, [pathname, companyName])

  return null
}
