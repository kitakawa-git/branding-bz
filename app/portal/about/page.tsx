'use client'

// 私たちについて（会社/ブランド概要）閲覧ページ
// 表示: 会社名(日本語/英語)・ロゴ・スローガン・業種・設立・代表者・公式サイト・事業内容
// - 会社名(日/英)・ロゴ・スローガンは PortalDataProvider から、その他は companies を直接取得
// - 事業内容は philosophy_elements の service 行（管理は基本情報ページ）
// - 沿革/MVV は「考え方」にあるため重複させない
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/supabase-fetch'
import { fetchPhilosophy } from '@/lib/brand/philosophy'
import { usePortalAuth } from '../components/PortalDataProvider'
import { INDUSTRY_CATEGORIES } from '@/lib/constants/industries'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getPageCache, setPageCache } from '@/lib/page-cache'

// 事業内容（philosophy_elements の service 行）。id は無い（表示専用）。
type BusinessItem = { title: string; description: string; added_index?: number }

type Overview = {
  name: string
  name_ja: string
  name_en: string
  website_url: string
  industry_category: string
  industry_subcategory: string
  founded: string
  representative: string
  business_content: BusinessItem[]
  business_content_sort: 'registered' | 'custom'
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
      // 会社概要・事業内容（service 行）・事業内容の表示順を並列取得
      const [companyRes, phil, guidelinesRes] = await Promise.all([
        fetchWithRetry(() =>
          supabase
            .from('companies')
            .select('name, name_ja, name_en, website_url, industry_category, industry_subcategory, founded, representative')
            .eq('id', companyId)
            .single()
        ),
        fetchPhilosophy(supabase, companyId),
        fetchWithRetry(() =>
          supabase
            .from('brand_guidelines')
            .select('business_content_sort')
            .eq('company_id', companyId)
            .maybeSingle()
        ),
      ])
      const { data: row } = companyRes
      if (!active) return
      if (row) {
        const r = row as Record<string, string | null>
        const guidelinesRow = guidelinesRes.data as { business_content_sort?: string | null } | null
        const overview: Overview = {
          name: r.name || '',
          name_ja: r.name_ja || '',
          name_en: r.name_en || '',
          website_url: r.website_url || '',
          industry_category: r.industry_category || '',
          industry_subcategory: r.industry_subcategory || '',
          founded: r.founded || '',
          representative: r.representative || '',
          business_content: phil.services,
          business_content_sort: guidelinesRow?.business_content_sort === 'custom' ? 'custom' : 'registered',
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

  // フィルター: 入力済みの事業内容のみ（登録順=added_index昇順 / カスタム=配列順）
  const filteredBusiness = data.business_content_sort === 'custom'
    ? data.business_content.filter(b => b.title)
    : [...data.business_content].filter(b => b.title).sort((a, b) => (a.added_index ?? 0) - (b.added_index ?? 0))

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

          {/* 事業内容（管理: 基本情報ページ / データ: philosophy_elements の service 行） */}
          {filteredBusiness.length > 0 && (
            <div className="mt-8">
              <h2 className="text-sm font-bold text-foreground mb-3 tracking-wide">事業内容</h2>
              <div className="space-y-3">
                {filteredBusiness.map((item, i) => (
                  <div key={i} className="rounded-lg border border-border bg-background p-4">
                    <span className="text-[18px] font-semibold text-foreground">{item.title}</span>
                    {item.description && (
                      <p className="text-base text-foreground/80 leading-relaxed whitespace-pre-wrap mt-1 m-0">
                        {item.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
