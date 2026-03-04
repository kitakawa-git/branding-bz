'use client'

// ブランド方針 閲覧ページ
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/supabase-fetch'
import { usePortalAuth } from '../components/PortalAuthProvider'
import { getSubtitle } from '@/lib/portal-subtitles'
import { useBrandFonts } from '@/hooks/useBrandFonts'
import { BrandFontLoader } from '@/components/BrandFontLoader'
import { getCssFontFamily } from '@/lib/brand-fonts'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { Separator } from '@/components/ui/separator'
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

type ValueItem = { name: string; description: string; added_index?: number }
type HistoryItem = { year: string; event: string }
type BusinessItem = { title: string; description: string; added_index?: number }
type TraitItem = { name: string; score: number; description: string; added_index?: number }

type Guidelines = {
  slogan: string | null
  concept_visual_url: string | null
  brand_video_url: string | null
  brand_statement: string | null
  mission: string | null
  vision: string | null
  values: ValueItem[]
  values_sort: 'registered' | 'custom'
  brand_story: string | null
  history: HistoryItem[]
  business_content: BusinessItem[]
  business_content_sort: 'registered' | 'custom'
  traits: TraitItem[]
  traits_sort: 'registered' | 'custom'
}

// YouTube URL をembedに変換
function getYouTubeEmbedUrl(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/)
  return match ? `https://www.youtube.com/embed/${match[1]}` : null
}

export default function PortalGuidelinesPage() {
  const { companyId, portalSubtitles } = usePortalAuth()
  const brandFonts = useBrandFonts(companyId)
  const primaryStyle = brandFonts ? { fontFamily: getCssFontFamily(brandFonts.primary_font) } : undefined
  const secondaryStyle = brandFonts ? { fontFamily: getCssFontFamily(brandFonts.secondary_font) } : undefined
  const cacheKey = `portal-guidelines-${companyId}`
  const cached = companyId ? getPageCache<Guidelines>(cacheKey) : null
  const [data, setData] = useState<Guidelines | null>(cached)
  const [loading, setLoading] = useState(!cached)

  useEffect(() => {
    if (!companyId) return
    if (getPageCache<Guidelines>(cacheKey)) return

    fetchWithRetry(() =>
      supabase
        .from('brand_guidelines')
        .select('slogan, concept_visual_url, brand_video_url, brand_statement, mission, vision, values, values_sort, brand_story, history, business_content, business_content_sort, traits, traits_sort')
        .eq('company_id', companyId)
        .single()
    ).then(({ data: d }) => {
      if (d) {
        const rec = d as Record<string, unknown>
        const parsed: Guidelines = {
          slogan: (rec.slogan as string) || null,
          concept_visual_url: (rec.concept_visual_url as string) || null,
          brand_video_url: (rec.brand_video_url as string) || null,
          brand_statement: (rec.brand_statement as string) || null,
          mission: (rec.mission as string) || null,
          vision: (rec.vision as string) || null,
          values: (rec.values as ValueItem[]) || [],
          values_sort: (rec.values_sort as 'registered' | 'custom') || 'registered',
          brand_story: (rec.brand_story as string) || null,
          history: (rec.history as HistoryItem[]) || [],
          business_content: (rec.business_content as BusinessItem[]) || [],
          business_content_sort: (rec.business_content_sort as 'registered' | 'custom') || 'registered',
          traits: (rec.traits as TraitItem[]) || [],
          traits_sort: (rec.traits_sort as 'registered' | 'custom') || 'registered',
        }
        setData(parsed)
        setPageCache(cacheKey, parsed)
      }
      setLoading(false)
    })
  }, [companyId, cacheKey])

  if (loading) return (
    <div className="max-w-4xl mx-auto px-5 pt-4 pb-6 space-y-6">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5 space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </CardContent>
      </Card>
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5 space-y-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-1/2" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2].map(i => (
              <div key={i} className="rounded-lg border border-border bg-background p-5">
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5 space-y-4">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-20 w-full" />
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

  // フィルター: 入力済みのバリューのみ（ソート対応）
  const filteredValues = data.values_sort === 'custom'
    ? data.values.filter(v => v.name)
    : [...data.values].filter(v => v.name).sort((a, b) => (a.added_index ?? 0) - (b.added_index ?? 0))

  // フィルター: 入力済みの沿革のみ
  const filteredHistory = data.history.filter(h => h.year || h.event)

  // フィルター: 入力済みの事業内容のみ（ソート対応）
  const filteredBusiness = data.business_content_sort === 'custom'
    ? data.business_content.filter(b => b.title)
    : [...data.business_content].filter(b => b.title).sort((a, b) => (a.added_index ?? 0) - (b.added_index ?? 0))

  const embedUrl = data.brand_video_url ? getYouTubeEmbedUrl(data.brand_video_url) : null

  return (
    <>
    <BrandFontLoader fonts={brandFonts} />
    <div className="max-w-4xl mx-auto px-5 pt-4 pb-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">ブランド方針</h1>
        <p className="text-sm text-muted-foreground">
          {getSubtitle(portalSubtitles, 'guidelines')}
        </p>
      </div>

      {/* 1. スローガン＋コンセプトビジュアル＋ブランド動画＋メッセージ */}
      {(data.slogan || data.concept_visual_url || data.brand_video_url || data.brand_statement) && (
        <section>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none overflow-hidden">
            <CardContent className="p-5 space-y-4">
              {data.slogan && (
                <div>
                  <h2 className="text-sm font-bold text-foreground mb-2 tracking-wide">スローガン</h2>
                  <p className="text-3xl font-bold text-foreground m-0" style={primaryStyle}>{data.slogan}</p>
                </div>
              )}
              {data.concept_visual_url && (
                <div>
                  <h2 className="text-sm font-bold text-foreground mb-3 tracking-wide">コンセプトビジュアル</h2>
                  <img
                    src={data.concept_visual_url}
                    alt="コンセプトビジュアル"
                    className="w-full h-auto object-contain rounded-lg"
                  />
                </div>
              )}
              {data.brand_video_url && (
                <div>
                  <h2 className="text-sm font-bold text-foreground mb-3 tracking-wide">ブランド動画</h2>
                  {embedUrl ? (
                    <div className="relative pb-[56.25%] h-0">
                      <iframe
                        src={embedUrl}
                        title="ブランド動画"
                        className="absolute top-0 left-0 w-full h-full border-none rounded-lg"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <a
                      href={data.brand_video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 text-sm"
                    >
                      {data.brand_video_url}
                    </a>
                  )}
                </div>
              )}
              {data.brand_statement && (
                <div>
                  <h2 className="text-sm font-bold text-foreground mb-3 tracking-wide">メッセージ</h2>
                  <p className="text-sm text-foreground/80 leading-[1.8] whitespace-pre-wrap m-0" style={secondaryStyle}>{data.brand_statement}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* 5. ミッション＋ビジョン＋バリュー */}
      {(data.mission || data.vision || filteredValues.length > 0) && (
        <section>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5 space-y-4">
              {data.mission && (
                <div>
                  <h2 className="text-sm font-bold text-foreground mb-2 tracking-wide">ミッション</h2>
                  <p className="text-2xl font-bold text-foreground m-0" style={primaryStyle}>{data.mission}</p>
                </div>
              )}
              {data.vision && (
                <div>
                  <h2 className="text-sm font-bold text-foreground mb-2 tracking-wide">ビジョン</h2>
                  <p className="text-2xl font-bold text-foreground m-0" style={primaryStyle}>{data.vision}</p>
                </div>
              )}
              {filteredValues.length > 0 && (
                <div>
                  <h2 className="text-sm font-bold text-foreground mb-3 tracking-wide">バリュー</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredValues.map((v, i) => (
                      <div key={i} className="rounded-lg border border-border bg-background p-5">
                        <p className="text-lg font-bold text-foreground mb-1.5 m-0" style={primaryStyle}>
                          {v.name}
                        </p>
                        {v.description && (
                          <p className="text-sm text-foreground/80 leading-[1.8] whitespace-pre-wrap m-0" style={secondaryStyle}>
                            {v.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* 8. ブランドストーリー＋沿革＋事業内容 */}
      {(data.brand_story || filteredHistory.length > 0 || filteredBusiness.length > 0) && (
        <section>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5 space-y-4">
              {data.brand_story && (
                <div>
                  <h2 className="text-sm font-bold text-foreground mb-3 tracking-wide">ブランドストーリー</h2>
                  <p className="text-sm text-foreground/80 leading-[1.8] whitespace-pre-wrap m-0" style={secondaryStyle}>{data.brand_story}</p>
                </div>
              )}
              {filteredHistory.length > 0 && (
                <div>
                  <h2 className="text-sm font-bold text-foreground mb-3 tracking-wide">沿革</h2>
                  {filteredHistory.map((item, i) => (
                    <div key={i}>
                      <div className="flex gap-4">
                        <div className="shrink-0 w-16 text-sm font-bold text-blue-600 relative pl-4">
                          <div className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-blue-600" />
                          {item.year}
                        </div>
                        <div className="text-sm text-foreground leading-relaxed">
                          {item.event}
                        </div>
                      </div>
                      {i < filteredHistory.length - 1 && <Separator className="my-4" />}
                    </div>
                  ))}
                </div>
              )}
              {filteredBusiness.length > 0 && (
                <div>
                  <h2 className="text-sm font-bold text-foreground mb-3 tracking-wide">事業内容</h2>
                  <div className="space-y-2">
                    {filteredBusiness.map((item, i) => (
                      <div key={i} className="rounded-lg border border-border bg-background border-l-2 border-l-blue-600 p-4 flex gap-3">
                        <span className="text-xs font-mono text-muted-foreground tabular-nums pt-0.5">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-base font-semibold text-foreground">{item.title}</span>
                          {item.description && (
                            <p className="text-sm text-foreground/80 leading-[1.8] whitespace-pre-wrap mt-1 m-0">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* 11. ブランド特性（レーダーチャート＋リスト） */}
      {filteredTraits.length > 0 && (
        <section>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5">
              <h2 className="text-sm font-bold text-foreground mb-3 tracking-wide">ブランド特性</h2>

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
                      <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fontSize: 10 }} tickCount={6} />
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

              <div className="space-y-2">
                {filteredTraits.map((trait, i) => (
                  <div key={i} className="rounded-lg border border-border bg-background p-4 flex items-center gap-4">
                    <div className="flex-1">
                      <p className="text-base font-bold text-foreground mb-0.5 m-0">
                        {trait.name}
                      </p>
                      {trait.description && (
                        <p className="text-sm text-foreground/80 leading-[1.8] whitespace-pre-wrap m-0">
                          {trait.description}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-center">
                      <div className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center text-base font-bold">
                        {trait.score}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">/10</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
    </>
  )
}
