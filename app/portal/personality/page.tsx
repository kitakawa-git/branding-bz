'use client'

// ブランドパーソナリティ 閲覧ページ（感じられ方｜ブランドパーソナリティ）
// 表示項目: 人格（brand_guidelines.traits のレーダーチャート＋リスト）
// ※ トーンオブボイスは /portal/verbal（バーバル）へ移管済み
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/supabase-fetch'
import { usePortalAuth } from '../components/PortalDataProvider'
import { useBrandFonts } from '@/hooks/useBrandFonts'
import { BrandFontLoader } from '@/components/BrandFontLoader'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { BrandPageTracker } from '@/components/analytics/BrandPageTracker'
import { resolveTraitCopy } from '@/lib/brand-mvv'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'

type TraitItem = { name: string; score: number; copy?: string; description: string; added_index?: number }

type Personality = {
  traits: TraitItem[]
  traits_sort: 'registered' | 'custom'
  summary: string | null
}

export default function PortalPersonalityPage() {
  const { companyId } = usePortalAuth()
  const brandFonts = useBrandFonts(companyId)
  const cacheKey = `portal-personality-${companyId}`
  const cached = companyId ? getPageCache<Personality>(cacheKey) : null
  const [data, setData] = useState<Personality | null>(cached)
  const [loading, setLoading] = useState(!cached)

  useEffect(() => {
    if (!companyId) return
    if (getPageCache<Personality>(cacheKey)) return

    // 人格: brand_guidelines.traits
    fetchWithRetry(() =>
      supabase
        .from('brand_guidelines')
        .select('traits, traits_sort, personality_summary')
        .eq('company_id', companyId)
        .maybeSingle()
    ).then((gRes) => {
      const g = gRes.data as Record<string, unknown> | null
      const parsed: Personality = {
        traits: (g?.traits as TraitItem[]) || [],
        traits_sort: (g?.traits_sort as 'registered' | 'custom') || 'registered',
        summary: (g?.personality_summary as string) || null,
      }
      setData(parsed)
      setPageCache(cacheKey, parsed)
      setLoading(false)
    })
  }, [companyId, cacheKey])

  if (loading) return (
    <div className="max-w-4xl mx-auto px-5 pt-4 pb-10 space-y-6">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5 space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-64 w-full max-w-[440px] mx-auto rounded-lg" />
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-lg border border-border bg-background p-4 flex items-center gap-4">
              <div className="flex-1">
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-4 w-full" />
              </div>
              <Skeleton className="w-11 h-11 rounded-full shrink-0" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )

  if (!data) return <div className="text-center py-16 text-muted-foreground text-[15px]">まだ登録されていません</div>

  // フィルター: 入力済みの特性のみ（ソート対応）
  const filteredTraits = data.traits_sort === 'custom'
    ? data.traits.filter(t => t.name && !t.name.match(/^特性\s?\d+$/))
    : [...data.traits].filter(t => t.name && !t.name.match(/^特性\s?\d+$/)).sort((a, b) => (a.added_index ?? 0) - (b.added_index ?? 0))
  const chartData = filteredTraits.map(t => ({ name: t.name, score: t.score }))
  const radarConfig = {
    score: {
      label: 'スコア',
      color: 'hsl(217, 91%, 60%)',
    },
  } satisfies ChartConfig

  const hasTraits = filteredTraits.length > 0

  if (!hasTraits && !data.summary) {
    return <div className="text-center py-16 text-muted-foreground text-[15px]">まだ登録されていません</div>
  }

  return (
    <>
    <BrandFontLoader fonts={brandFonts} />
    {companyId && <BrandPageTracker companyId={companyId} pageType="personality" />}
    <div className="max-w-4xl mx-auto px-5 pt-4 pb-10 space-y-6">

      {/* 1. 人格（ブランドパーソナリティ：レーダーチャート＋概要＋リスト） */}
      {(hasTraits || data.summary) && (
        <section>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5">
              <h2 className="text-xs font-bold text-foreground mb-3 tracking-wide">人格</h2>

              {/* レーダーチャート（3つ以上の場合のみ） */}
              {chartData.length >= 3 && (
                <div className="w-full max-w-[440px] mx-auto mb-6">
                  <ChartContainer config={radarConfig} className="aspect-square">
                    <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="77%">
                      <ChartTooltip
                        content={<ChartTooltipContent hideLabel />}
                      />
                      <PolarGrid />
                      <PolarAngleAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 10 }} tickCount={6} />
                      <Radar
                        dataKey="score"
                        fill="var(--color-score)"
                        fillOpacity={0.2}
                        stroke="var(--color-score)"
                        strokeWidth={2}
                        dot={{ r: 4, fillOpacity: 1, fill: 'var(--color-score)' }}
                      />
                    </RadarChart>
                  </ChartContainer>
                </div>
              )}

              {/* パーソナリティ概要（brand_guidelines.personality_summary） */}
              {data.summary && (
                <p className="text-base sm:text-sm text-foreground/80 leading-[1.9] whitespace-pre-wrap mb-6 m-0">
                  {data.summary}
                </p>
              )}

              <div className="space-y-2">
                {filteredTraits.map((trait, i) => {
                  const { copy, description } = resolveTraitCopy(trait)
                  return (
                  <div key={i} className="rounded-lg border border-border bg-background p-4 flex items-center gap-4">
                    <div className="flex-1">
                      <p className="text-xs font-bold text-foreground mb-0.5 m-0">
                        {trait.name}
                      </p>
                      {copy && (
                        <p className="text-base font-semibold text-foreground mt-0.5 m-0">
                          {copy}
                        </p>
                      )}
                      {description && (
                        <p className="text-base sm:text-sm text-foreground/70 leading-[1.8] whitespace-pre-wrap mt-1 m-0">
                          {description}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-center">
                      <div className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center text-base font-bold">
                        {trait.score}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">/5</div>
                    </div>
                  </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
    </>
  )
}
