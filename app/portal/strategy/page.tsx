'use client'

// ブランド戦略 閲覧ページ
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
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { PositioningMap } from '@/components/PositioningMap'
import type { PositioningMapData } from '@/lib/types/positioning-map'

type Persona = {
  name: string
  age_range: string | null
  occupation: string | null
  description: string | null
  needs: string[]
  pain_points: string[]
}

type ActionGuideline = {
  title: string
  description: string
}

export default function PortalStrategyPage() {
  const { companyId, portalSubtitles } = usePortalAuth()
  const brandFonts = useBrandFonts(companyId)
  const secondaryStyle = brandFonts ? { fontFamily: getCssFontFamily(brandFonts.secondary_font) } : undefined

  type StrategyCache = {
    target: string
    personas: Persona[]
    positioningMapUrl: string
    positioningMapData: PositioningMapData | null
    actionGuidelines: ActionGuideline[]
  }
  const cacheKey = `portal-strategy-${companyId}`
  const cached = companyId ? getPageCache<StrategyCache>(cacheKey) : null

  const [target, setTarget] = useState(cached?.target ?? '')
  const [personas, setPersonas] = useState<Persona[]>(cached?.personas ?? [])
  const [positioningMapUrl, setPositioningMapUrl] = useState(cached?.positioningMapUrl ?? '')
  const [positioningMapData, setPositioningMapData] = useState<PositioningMapData | null>(cached?.positioningMapData ?? null)
  const [actionGuidelines, setActionGuidelines] = useState<ActionGuideline[]>(cached?.actionGuidelines ?? [])
  const [loading, setLoading] = useState(!cached)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    if (!companyId) return
    if (getPageCache<StrategyCache>(cacheKey)) return

    fetchWithRetry(() =>
      supabase
        .from('brand_personas')
        .select('name, age_range, occupation, description, needs, pain_points, target, positioning_map_url, positioning_map_data, action_guidelines, sort_order')
        .eq('company_id', companyId)
        .order('sort_order')
    ).then(({ data }) => {
      if (data && Array.isArray(data) && data.length > 0) {
        const first = data[0] as Record<string, unknown>
        setTarget((first.target as string) || '')
        setPositioningMapUrl((first.positioning_map_url as string) || '')
        setPositioningMapData((first.positioning_map_data as PositioningMapData) || null)
        setActionGuidelines((first.action_guidelines as ActionGuideline[]) || [])

        setPersonas(data.map((d: unknown) => {
          const rec = d as Record<string, unknown>
          return {
            name: (rec.name as string) || '',
            age_range: (rec.age_range as string) || null,
            occupation: (rec.occupation as string) || null,
            description: (rec.description as string) || null,
            needs: (rec.needs as string[]) || [],
            pain_points: (rec.pain_points as string[]) || [],
          }
        }))

        setPageCache(cacheKey, {
          target: (first.target as string) || '',
          positioningMapUrl: (first.positioning_map_url as string) || '',
          positioningMapData: (first.positioning_map_data as PositioningMapData) || null,
          actionGuidelines: (first.action_guidelines as ActionGuideline[]) || [],
          personas: data.map((d: unknown) => {
            const rec = d as Record<string, unknown>
            return {
              name: (rec.name as string) || '',
              age_range: (rec.age_range as string) || null,
              occupation: (rec.occupation as string) || null,
              description: (rec.description as string) || null,
              needs: (rec.needs as string[]) || [],
              pain_points: (rec.pain_points as string[]) || [],
            }
          }),
        })
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
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-4 w-24" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2].map(i => (
              <div key={i} className="rounded-lg border border-border bg-background p-5 space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-12 w-full" />
                <div className="flex gap-1.5">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-64 w-full mt-3 rounded-lg" />
        </CardContent>
      </Card>
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5 space-y-2">
          <Skeleton className="h-4 w-24" />
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-lg border border-border bg-background border-l-2 border-l-blue-600 p-4 flex gap-3">
              <Skeleton className="h-4 w-6" />
              <div className="flex-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-full mt-1" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )

  const hasContent = target || personas.some(p => p.name) || positioningMapData || positioningMapUrl || actionGuidelines.length > 0
  if (!hasContent) return <div className="text-center py-16 text-muted-foreground text-[15px]">まだ登録されていません</div>

  const validPersonas = personas.filter(p => p.name)

  return (
    <>
    <BrandFontLoader fonts={brandFonts} />
    <div className="max-w-4xl mx-auto px-5 pt-4 pb-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">ブランド戦略</h1>
        <p className="text-sm text-muted-foreground">
          {getSubtitle(portalSubtitles, 'strategy')}
        </p>
      </div>

      {/* Card 1: ターゲット＋ペルソナ */}
      {(target || validPersonas.length > 0) && (
        <section>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5 space-y-4">
              {target && (
                <div>
                  <h2 className="text-sm font-bold text-foreground mb-3 tracking-wide">ターゲット</h2>
                  <p className="text-sm text-foreground/80 leading-[1.8] whitespace-pre-wrap m-0" style={secondaryStyle}>{target}</p>
                </div>
              )}
              {validPersonas.length > 0 && (
                <div>
                  <h2 className="text-sm font-bold text-foreground mb-3 tracking-wide">ペルソナ</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {validPersonas.map((persona, i) => (
                  <div key={i} className="rounded-lg border border-border bg-background p-5">
                  <div className="mb-3">
                    <p className="text-base font-bold text-foreground mb-0.5 m-0">
                      {persona.name}
                    </p>
                    <p className="text-sm text-foreground/80 leading-[1.8] whitespace-pre-wrap m-0">
                      {[persona.age_range, persona.occupation].filter(Boolean).join(' / ')}
                    </p>
                  </div>

                  {persona.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4 m-0">
                      {persona.description}
                    </p>
                  )}

                  {persona.needs.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 m-0">ニーズ</p>
                      <div className="flex flex-wrap gap-1.5">
                        {persona.needs.map((need, ni) => (
                          <span key={ni} className="inline-block px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs text-blue-700">
                            {need}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {persona.pain_points.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 m-0">課題</p>
                      <div className="flex flex-wrap gap-1.5">
                        {persona.pain_points.map((point, pi) => (
                          <span key={pi} className="inline-block px-2.5 py-1 bg-red-50 border border-red-200 rounded-full text-xs text-red-600">
                            {point}
                          </span>
                        ))}
                      </div>
                    </div>
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

      {/* Card 2: ポジショニングマップ */}
      {(positioningMapData || positioningMapUrl) && (
        <section>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none overflow-hidden">
            <CardContent className="p-5">
              <h2 className="text-sm font-bold text-foreground mb-3 tracking-wide">ポジショニングマップ</h2>
              {positioningMapData ? (
                <PositioningMap data={positioningMapData} />
              ) : positioningMapUrl ? (
                <img
                  src={positioningMapUrl}
                  alt="ポジショニングマップ"
                  onClick={() => setModalOpen(true)}
                  className="w-full max-h-[400px] object-contain rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                />
              ) : null}
            </CardContent>
          </Card>

          {/* 画像拡大ダイアログ（旧画像形式の場合のみ） */}
          {!positioningMapData && positioningMapUrl && (
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
              <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 bg-transparent border-none shadow-none">
                <DialogTitle className="sr-only">ポジショニングマップ拡大表示</DialogTitle>
                <img
                  src={positioningMapUrl}
                  alt="ポジショニングマップ 拡大表示"
                  className="max-w-full max-h-[85vh] object-contain rounded-lg mx-auto"
                />
              </DialogContent>
            </Dialog>
          )}
        </section>
      )}

      {/* Card 3: 行動指針 */}
      {actionGuidelines.length > 0 && (
        <section>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5">
              <h2 className="text-sm font-bold text-foreground mb-3 tracking-wide">行動指針</h2>
              <div className="space-y-2">
                {actionGuidelines.map((g, i) => (
                  <div key={i} className="rounded-lg border border-border bg-background border-l-2 border-l-blue-600 p-4 flex gap-3">
                    <span className="text-xs font-mono text-muted-foreground tabular-nums pt-0.5">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-base font-semibold text-foreground">{g.title}</span>
                      {g.description && (
                        <p className="text-sm text-foreground/80 leading-[1.8] whitespace-pre-wrap mt-1 m-0">
                          {g.description}
                        </p>
                      )}
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
