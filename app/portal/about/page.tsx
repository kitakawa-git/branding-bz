'use client'

// 私たちについて（会社/ブランド概要）閲覧ページ
// 表示: 会社名(日本語/英語)・ロゴ・スローガン・業種・設立・代表者・所在地・公式サイト
// - 会社名(日/英)・ロゴ・スローガンは PortalDataProvider から、その他は companies を直接取得
// - 沿革/事業内容/MVV は「考え方」にあるため重複させない
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/supabase-fetch'
import { usePortalAuth } from '../components/PortalDataProvider'
import { INDUSTRY_CATEGORIES } from '@/lib/constants/industries'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getPageCache, setPageCache } from '@/lib/page-cache'

type Overview = {
  name: string
  name_ja: string
  name_en: string
  website_url: string
  industry_category: string
  industry_subcategory: string
  founded: string
  address: string
  representative: string
}

function industryLabel(category: string, subcategory: string): string {
  const cat = INDUSTRY_CATEGORIES.find(c => c.value === category)?.label
  return [cat, subcategory].filter(Boolean).join(' ／ ')
}

export default function PortalAboutPage() {
  const { companyId, companyName, companyLogoUrl } = usePortalAuth()
  const cacheKey = `portal-about-${companyId}`
  const cached = companyId ? getPageCache<Overview>(cacheKey) : null
  const [data, setData] = useState<Overview | null>(cached)
  const [loading, setLoading] = useState(!cached)

  useEffect(() => {
    if (!companyId) return
    let active = true
    const run = async () => {
      const { data: row } = await fetchWithRetry(() =>
        supabase
          .from('companies')
          .select('name, name_ja, name_en, website_url, industry_category, industry_subcategory, founded, address, representative')
          .eq('id', companyId)
          .single()
      )
      if (!active) return
      if (row) {
        const r = row as Record<string, string | null>
        const overview: Overview = {
          name: r.name || '',
          name_ja: r.name_ja || '',
          name_en: r.name_en || '',
          website_url: r.website_url || '',
          industry_category: r.industry_category || '',
          industry_subcategory: r.industry_subcategory || '',
          founded: r.founded || '',
          address: r.address || '',
          representative: r.representative || '',
        }
        setData(overview)
        setPageCache(cacheKey, overview)
      }
      setLoading(false)
    }
    run()
    return () => { active = false }
  }, [companyId, cacheKey])

  if (loading && !data) {
    return (
      <div className="max-w-4xl mx-auto px-5 pt-4 pb-10">
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-4 sm:p-6 space-y-4">
            <Skeleton className="h-16 w-16 rounded-lg" />
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-5 w-40" />
            <div className="space-y-3 pt-4">
              {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-6 w-full" />)}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) return null

  const nameJa = data.name_ja || data.name
  const nameEn = data.name_en
  const rows: Array<{ label: string; value: React.ReactNode }> = []
  if (data.founded) rows.push({ label: '設立', value: data.founded })
  if (data.representative) rows.push({ label: '代表者', value: data.representative })
  if (data.address) rows.push({ label: '所在地', value: data.address })
  const industry = industryLabel(data.industry_category, data.industry_subcategory)
  if (industry) rows.push({ label: '業種', value: industry })
  if (data.website_url) {
    rows.push({
      label: '公式サイト',
      value: (
        <a
          href={data.website_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ds-app-accent hover:underline break-all"
        >
          {data.website_url}
        </a>
      ),
    })
  }

  return (
    <div className="max-w-4xl mx-auto px-5 pt-4 pb-10">
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none overflow-hidden">
        <CardContent className="p-4 sm:p-6">
          {/* ヘッダー: ロゴ＋会社名＋スローガン */}
          <div className="flex items-center gap-4">
            {companyLogoUrl && (
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
                <img src={companyLogoUrl} alt={companyName || ''} className="size-full object-contain" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground m-0">{nameJa}</h1>
              {nameEn && nameEn !== nameJa && (
                <p className="text-sm text-muted-foreground m-0 mt-0.5">{nameEn}</p>
              )}
            </div>
          </div>

          {/* 概要テーブル */}
          {rows.length > 0 && (
            <dl className="mt-6 divide-y divide-border rounded-lg border border-border bg-background">
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-[7rem_1fr] gap-3 px-4 py-3 sm:grid-cols-[9rem_1fr]">
                  <dt className="text-[13px] font-medium text-muted-foreground">{r.label}</dt>
                  <dd className="text-base text-foreground/80 leading-relaxed m-0 break-words">{r.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {rows.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">情報はまだ登録されていません。</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
