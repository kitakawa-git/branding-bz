'use client'

// ブランド戦略 閲覧ページ
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/supabase-fetch'
import { usePortalAuth } from '../components/PortalDataProvider'
import { useBrandFonts } from '@/hooks/useBrandFonts'
import { BrandFontLoader } from '@/components/BrandFontLoader'
import { getCssFontFamily } from '@/lib/brand-fonts'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { BrandPageTracker } from '@/components/analytics/BrandPageTracker'
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

// 主なターゲット（管理画面で編集する companies.target_segments）
type TargetSegment = { name: string; description: string }

// 提供価値（value_propositions テーブル ＋ companies.provided_values レガシー）
type ProvidedValueItem = { title: string; description: string | null }

export default function PortalStrategyPage() {
  const { companyId } = usePortalAuth()
  const brandFonts = useBrandFonts(companyId)
  const primaryStyle = brandFonts ? { fontFamily: getCssFontFamily(brandFonts.primary_font) } : undefined
  const secondaryStyle = brandFonts ? { fontFamily: getCssFontFamily(brandFonts.secondary_font) } : undefined

  type StrategyCache = {
    target: string
    targetSegments: TargetSegment[]
    providedValues: ProvidedValueItem[]
    personas: Persona[]
    positioningMapUrl: string
    positioningMapData: PositioningMapData | null
  }
  const cacheKey = `portal-strategy-${companyId}`
  const cached = companyId ? getPageCache<StrategyCache>(cacheKey) : null

  const [target, setTarget] = useState(cached?.target ?? '')
  const [targetSegments, setTargetSegments] = useState<TargetSegment[]>(cached?.targetSegments ?? [])
  const [providedValues, setProvidedValues] = useState<ProvidedValueItem[]>(cached?.providedValues ?? [])
  const [personas, setPersonas] = useState<Persona[]>(cached?.personas ?? [])
  const [positioningMapUrl, setPositioningMapUrl] = useState(cached?.positioningMapUrl ?? '')
  const [positioningMapData, setPositioningMapData] = useState<PositioningMapData | null>(cached?.positioningMapData ?? null)
  const [loading, setLoading] = useState(!cached)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    if (!companyId) return
    if (getPageCache<StrategyCache>(cacheKey)) return

    Promise.all([
      fetchWithRetry(() =>
        supabase
          .from('brand_personas')
          .select('name, age_range, occupation, description, needs, pain_points, target, positioning_map_url, positioning_map_data, sort_order')
          .eq('company_id', companyId)
          .order('sort_order')
      ),
      // 主なターゲット（companies.target_segments）
      fetchWithRetry(() =>
        supabase.from('companies').select('target_segments').eq('id', companyId).maybeSingle()
      ),
      // 提供価値（value_propositions テーブル。管理画面 ブランド戦略で編集）
      fetchWithRetry(() =>
        supabase
          .from('value_propositions')
          .select('title, description, sort_order')
          .eq('company_id', companyId)
          .order('sort_order')
      ),
    ]).then(([personasRes, companyRes, bvRes]) => {
      const data = personasRes.data as Record<string, unknown>[] | null
      const companyData = companyRes.data as Record<string, unknown> | null

      // ターゲット: companies.target_segments（管理画面入力）を優先。なければ brand_personas.target テキスト
      const rawSegments = (companyData?.target_segments as TargetSegment[]) || []
      const parsedSegments: TargetSegment[] = rawSegments
        .filter(s => s && s.name)
        .map(s => ({ name: s.name || '', description: s.description || '' }))
      setTargetSegments(parsedSegments)

      // 提供価値（value_propositions のみ。レガシー companies.provided_values は廃止し business_content へ移行済み）
      const parsedProvidedValues: ProvidedValueItem[] = []
      if (bvRes.data && Array.isArray(bvRes.data)) {
        for (const d of bvRes.data as Record<string, unknown>[]) {
          const title = (d.title as string) || ''
          if (title.trim()) parsedProvidedValues.push({ title, description: (d.description as string) || null })
        }
      }
      setProvidedValues(parsedProvidedValues)

      let parsedTarget = ''
      let parsedPersonas: Persona[] = []
      let parsedMapUrl = ''
      let parsedMapData: PositioningMapData | null = null
      if (data && Array.isArray(data) && data.length > 0) {
        const first = data[0]
        parsedTarget = (first.target as string) || ''
        parsedMapUrl = (first.positioning_map_url as string) || ''
        parsedMapData = (first.positioning_map_data as PositioningMapData) || null
        parsedPersonas = data.map((rec) => ({
          name: (rec.name as string) || '',
          age_range: (rec.age_range as string) || null,
          occupation: (rec.occupation as string) || null,
          description: (rec.description as string) || null,
          needs: (rec.needs as string[]) || [],
          pain_points: (rec.pain_points as string[]) || [],
        }))
      }
      setTarget(parsedTarget)
      setPositioningMapUrl(parsedMapUrl)
      setPositioningMapData(parsedMapData)
      setPersonas(parsedPersonas)

      setPageCache(cacheKey, {
        target: parsedTarget,
        targetSegments: parsedSegments,
        providedValues: parsedProvidedValues,
        positioningMapUrl: parsedMapUrl,
        positioningMapData: parsedMapData,
        personas: parsedPersonas,
      })
      setLoading(false)
    })
  }, [companyId, cacheKey])

  if (loading) return (
    <div className="max-w-4xl mx-auto px-5 pt-4 pb-10 space-y-6">
      {/* ターゲット概要＋主なターゲット＋ペルソナ（2列） */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-4 sm:p-5 space-y-4">
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
      {/* ポジショニングマップ */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-4 sm:p-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-64 w-full mt-3 rounded-lg" />
        </CardContent>
      </Card>
    </div>
  )

  const hasTarget = targetSegments.length > 0 || !!target
  const hasContent = hasTarget || personas.some(p => p.name) || positioningMapData || positioningMapUrl || providedValues.length > 0
  if (!hasContent) return <div className="text-center py-16 text-muted-foreground text-[15px]">まだ登録されていません</div>

  const validPersonas = personas.filter(p => p.name)

  return (
    <>
    <BrandFontLoader fonts={brandFonts} />
    {companyId && <BrandPageTracker companyId={companyId} pageType="strategy" />}
    <div className="max-w-4xl mx-auto px-5 pt-4 pb-10 space-y-6">

      {/* Card 1: ターゲット＋ペルソナ */}
      {(hasTarget || validPersonas.length > 0) && (
        <section>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-4 sm:p-5 space-y-6">
              {hasTarget && (
                <div>
                  <h2 className="text-xs font-bold text-foreground mb-3 tracking-wide">ターゲット</h2>
                  {/* 概要文（プロセス文） */}
                  {target && (
                    <p className="text-base sm:text-sm text-foreground/80 leading-[1.8] whitespace-pre-wrap m-0 mb-3" style={secondaryStyle}>{target}</p>
                  )}
                  {/* 主なターゲット（セグメント一覧） */}
                  {targetSegments.length > 0 && (
                    <div className="space-y-3">
                      {targetSegments.map((seg, i) => (
                        <div key={i} className="relative overflow-hidden rounded-lg border border-border bg-background p-4 pl-5">
                          {/* 左端の青バー（「私たちの『らしさ』」カード同装飾） */}
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600" />
                          <p className="text-sm font-bold text-foreground m-0">{seg.name}</p>
                          {seg.description && (
                            <p className="text-base sm:text-sm text-foreground/70 leading-[1.8] whitespace-pre-wrap mt-1 m-0" style={secondaryStyle}>{seg.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {validPersonas.length > 0 && (
                <div>
                  <h2 className="text-xs font-bold text-foreground mb-3 tracking-wide">ペルソナ</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {validPersonas.map((persona, i) => (
                  <div key={i} className="rounded-lg border border-border bg-background p-5">
                  <div className="mb-3">
                    <p className="text-base font-bold text-foreground mb-0.5 m-0">
                      {persona.name}
                    </p>
                    <p className="text-base sm:text-sm text-foreground/80 leading-[1.8] whitespace-pre-wrap m-0">
                      {[persona.age_range, persona.occupation].filter(Boolean).join(' / ')}
                    </p>
                  </div>

                  {persona.description && (
                    <p className="text-base sm:text-sm text-muted-foreground leading-relaxed mb-4 m-0">
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
            <CardContent className="p-4 sm:p-5">
              <h2 className="text-xs font-bold text-foreground mb-3 tracking-wide">ポジショニングマップ</h2>
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

      {/* 提供価値（value_propositions ＋ companies.provided_values。空なら非表示。「考え方」から移動） */}
      {providedValues.length > 0 && (
        <section>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-4 sm:p-5">
              <h2 className="text-xs font-bold text-foreground mb-3 tracking-wide">提供価値</h2>
              <div className="space-y-3">
                {providedValues.map((val, i) => (
                  <div key={i} className="rounded-lg border border-border bg-background p-4 flex items-start gap-4">
                    <div className="shrink-0 w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-base font-bold">
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="text-base font-bold text-foreground mb-1" style={primaryStyle}>
                        {val.title}
                      </div>
                      {val.description && (
                        <div className="text-base sm:text-sm text-foreground/80 leading-[1.8] whitespace-pre-wrap" style={secondaryStyle}>
                          {val.description}
                        </div>
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
