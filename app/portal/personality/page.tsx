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
import { BrandPersonaCard } from '@/components/shared/BrandPersonaCard'
import { type PersonalityTraitItem } from '@/components/shared/PersonalityTraitList'

type TraitItem = { name: string; score: number; copy?: string; description: string; added_index?: number }

type ArchetypeSide = { key: string; label: string; copy: string; description: string }
type Archetype = { primary: ArchetypeSide; secondary: ArchetypeSide } | null

type Personality = {
  traits: TraitItem[]
  traits_sort: 'registered' | 'custom'
  summary: string | null
  archetype: Archetype
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

    // 人格: brand_guidelines.traits ＋ アーキタイプ: brand_personalities.archetype
    Promise.all([
      fetchWithRetry(() =>
        supabase
          .from('brand_guidelines')
          .select('traits, traits_sort, personality_summary')
          .eq('company_id', companyId)
          .maybeSingle()
      ),
      fetchWithRetry(() =>
        supabase
          .from('brand_personalities')
          .select('archetype')
          .eq('company_id', companyId)
          .maybeSingle()
      ),
    ]).then(([gRes, pRes]) => {
      const g = gRes.data as Record<string, unknown> | null
      const p = pRes.data as Record<string, unknown> | null
      const parsed: Personality = {
        traits: (g?.traits as TraitItem[]) || [],
        traits_sort: (g?.traits_sort as 'registered' | 'custom') || 'registered',
        summary: (g?.personality_summary as string) || null,
        archetype: (p?.archetype as Archetype) || null,
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
        <CardContent className="p-4 sm:p-5 space-y-4">
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
  const hasTraits = filteredTraits.length > 0
  const archetype = data.archetype

  if (!hasTraits && !data.summary && !archetype) {
    return <div className="text-center py-16 text-muted-foreground text-[15px]">まだ登録されていません</div>
  }

  return (
    <>
    <BrandFontLoader fonts={brandFonts} />
    {companyId && <BrandPageTracker companyId={companyId} pageType="personality" />}
    <div className="max-w-4xl mx-auto px-5 pt-4 pb-10 space-y-6">

      {/* 1. ブランドの人格（レーダーチャート＋概要＋特性リスト・共通コンポーネント） */}
      {(hasTraits || data.summary) && (
        <section>
          <BrandPersonaCard
            chartData={chartData}
            summary={data.summary}
            traits={filteredTraits.map<PersonalityTraitItem>(t => {
              const { copy, description } = resolveTraitCopy(t)
              return { name: t.name, score: t.score, copy, description }
            })}
          />
        </section>
      )}

      {/* 2. アーキタイプ（主・副人格：brand_personalities.archetype） */}
      {archetype && (
        <section>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-4 sm:p-5 space-y-4">
              <h2 className="text-sm font-bold text-foreground tracking-wide">アーキタイプ</h2>

              {/* 主人格（大） */}
              <div className="rounded-lg border-2 border-ds-app-accent bg-blue-50/40 p-5">
                <p className="text-[11px] font-semibold tracking-wide text-ds-app-accent-hover mb-1">主人格</p>
                <h3 className="text-xl font-bold text-foreground m-0">{archetype.primary.label}</h3>
                {archetype.primary.copy && (
                  <p className="mt-1 text-base font-semibold text-ds-app-accent-hover m-0">{archetype.primary.copy}</p>
                )}
                {archetype.primary.description && (
                  <p className="mt-3 text-base sm:text-sm text-foreground/80 leading-[1.8] m-0">{archetype.primary.description}</p>
                )}
              </div>

              {/* 副人格（小） */}
              <div className="rounded-lg border border-border bg-background p-4">
                <p className="text-[11px] font-semibold tracking-wide text-muted-foreground mb-1">副人格</p>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <h3 className="text-lg font-bold text-foreground m-0">{archetype.secondary.label}</h3>
                  {archetype.secondary.copy && (
                    <p className="text-sm font-semibold text-muted-foreground m-0">{archetype.secondary.copy}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
    </>
  )
}
