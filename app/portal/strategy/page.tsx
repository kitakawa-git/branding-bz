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
import { PersonaCarousel } from './PersonaCarousel'
import { PersonaCard, type PortalPersona } from './PersonaCard'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { BrandPageTracker } from '@/components/analytics/BrandPageTracker'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { PositioningMap } from '@/components/PositioningMap'
import type { PositioningMapData } from '@/lib/types/positioning-map'
import type { BrandStanceStatement } from '@/app/tools/stp/app/[sessionId]/page'

type Persona = PortalPersona

// 主なターゲット（管理画面で編集する companies.target_segments）
type TargetSegment = { name: string; description: string }

// セグメンテーション（STP分析ツールから連携。brand_personas[0].segmentation_data）
type SegmentationData = {
  variables?: Array<{
    name: string
    segments?: Array<{ name: string; description?: string; selected?: boolean }>
  }>
}

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
    segmentationData: SegmentationData | null
    providedValues: ProvidedValueItem[]
    personas: Persona[]
    positioningMapUrl: string
    positioningMapData: PositioningMapData | null
    brandStanceStatements: { statements: BrandStanceStatement[] } | null
    strengths: string
  }
  const cacheKey = `portal-strategy-${companyId}`
  const cached = companyId ? getPageCache<StrategyCache>(cacheKey) : null

  const [target, setTarget] = useState(cached?.target ?? '')
  const [targetSegments, setTargetSegments] = useState<TargetSegment[]>(cached?.targetSegments ?? [])
  const [segmentationData, setSegmentationData] = useState<SegmentationData | null>(cached?.segmentationData ?? null)
  const [providedValues, setProvidedValues] = useState<ProvidedValueItem[]>(cached?.providedValues ?? [])
  const [personas, setPersonas] = useState<Persona[]>(cached?.personas ?? [])
  const [positioningMapUrl, setPositioningMapUrl] = useState(cached?.positioningMapUrl ?? '')
  const [positioningMapData, setPositioningMapData] = useState<PositioningMapData | null>(cached?.positioningMapData ?? null)
  const [brandStanceStatements, setBrandStanceStatements] = useState<{ statements: BrandStanceStatement[] } | null>(cached?.brandStanceStatements ?? null)
  const [strengths, setStrengths] = useState<string>(cached?.strengths ?? '')
  const [loading, setLoading] = useState(!cached)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    if (!companyId) return
    if (getPageCache<StrategyCache>(cacheKey)) return

    Promise.all([
      fetchWithRetry(() =>
        supabase
          .from('brand_personas')
          .select('name, avatar_emoji, age_range, occupation, description, needs, pain_points, brand_expectations, target, positioning_map_url, positioning_map_data, segmentation_data, brand_stance_statements, sort_order')
          .eq('company_id', companyId)
          .order('sort_order')
      ),
      // 主なターゲット（companies.target_segments）
      fetchWithRetry(() =>
        supabase.from('companies').select('target_segments, strengths').eq('id', companyId).maybeSingle()
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
      // STP連携: 自社の強み（companies.strengths）
      const parsedStrengths = (companyData?.strengths as string) || ''
      setStrengths(parsedStrengths)

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
      let parsedSegmentation: SegmentationData | null = null
      let parsedStance: { statements: BrandStanceStatement[] } | null = null
      if (data && Array.isArray(data) && data.length > 0) {
        const first = data[0]
        parsedTarget = (first.target as string) || ''
        parsedMapUrl = (first.positioning_map_url as string) || ''
        parsedMapData = (first.positioning_map_data as PositioningMapData) || null
        parsedSegmentation = (first.segmentation_data as SegmentationData) || null
        parsedStance = (first.brand_stance_statements as { statements: BrandStanceStatement[] }) || null
        parsedPersonas = data.map((rec) => ({
          name: (rec.name as string) || '',
          avatar_emoji: (rec.avatar_emoji as string) || null,
          age_range: (rec.age_range as string) || null,
          occupation: (rec.occupation as string) || null,
          description: (rec.description as string) || null,
          needs: (rec.needs as string[]) || [],
          pain_points: (rec.pain_points as string[]) || [],
          brand_expectations: (rec.brand_expectations as string) || null,
        }))
      }
      setTarget(parsedTarget)
      setPositioningMapUrl(parsedMapUrl)
      setPositioningMapData(parsedMapData)
      setSegmentationData(parsedSegmentation)
      setBrandStanceStatements(parsedStance)
      setPersonas(parsedPersonas)

      setPageCache(cacheKey, {
        target: parsedTarget,
        targetSegments: parsedSegments,
        segmentationData: parsedSegmentation,
        providedValues: parsedProvidedValues,
        positioningMapUrl: parsedMapUrl,
        positioningMapData: parsedMapData,
        brandStanceStatements: parsedStance,
        strengths: parsedStrengths,
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
  // セグメンテーション: 採用（selected）セグメントを持つ切り口のみ表示対象
  const segmentationVariables = (segmentationData?.variables || [])
    .map(v => ({ name: v.name, segments: (v.segments || []).filter(s => s.selected) }))
    .filter(v => v.segments.length > 0)
  const hasSegmentation = segmentationVariables.length > 0
  const hasContent = hasTarget || hasSegmentation || personas.some(p => p.name) || positioningMapData || positioningMapUrl || providedValues.length > 0
  if (!hasContent) return <div className="text-center py-16 text-muted-foreground text-[15px]">まだ登録されていません</div>

  const validPersonas = personas.filter(p => p.name)

  return (
    <>
    <BrandFontLoader fonts={brandFonts} />
    {companyId && <BrandPageTracker companyId={companyId} pageType="strategy" />}
    <div className="max-w-4xl mx-auto px-5 pt-4 pb-10 space-y-6">

      {/* Card 1: セグメンテーション＋ターゲット＋ペルソナ */}
      {(hasSegmentation || hasTarget || validPersonas.length > 0) && (
        <section>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-4 sm:p-5 space-y-6">
              {/* セグメンテーション（STP分析ツールから連携） */}
              {hasSegmentation && (
                <div>
                  <h2 className="text-sm font-bold text-foreground mb-3 tracking-wide">セグメンテーション</h2>
                  <div className="space-y-3">
                    {segmentationVariables.map((variable, vi) => (
                      <div key={vi}>
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 m-0">{variable.name}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {variable.segments.map((seg, si) => (
                            <span
                              key={si}
                              className="inline-block px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs text-ds-app-accent-hover"
                              title={seg.description || undefined}
                            >
                              {seg.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {hasTarget && (
                <div>
                  <h2 className="text-sm font-bold text-foreground mb-3 tracking-wide">ターゲット</h2>
                  {/* 主なターゲット（セグメント一覧） */}
                  {targetSegments.length > 0 && (
                    <div className="space-y-3">
                      {targetSegments.map((seg, i) => (
                        <div key={i} className="relative overflow-hidden rounded-lg border border-border bg-background p-4 pl-5">
                          {/* 左端の青バー（「私たちの『らしさ』」カード同装飾） */}
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-ds-app-accent" />
                          <p className="text-sm font-bold text-foreground m-0">{seg.name}</p>
                          {seg.description && (
                            <p className="text-base sm:text-sm text-foreground/70 leading-[1.8] whitespace-pre-wrap mt-1 m-0" style={secondaryStyle}>{seg.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* 概要文（プロセス文）。主なターゲットの下に表示 */}
                  {target && (
                    <p className={`text-base sm:text-sm text-foreground/80 leading-[1.8] whitespace-pre-wrap m-0 ${targetSegments.length > 0 ? 'mt-3' : ''}`} style={secondaryStyle}>{target}</p>
                  )}
                </div>
              )}
              {validPersonas.length > 0 && (
                <div>
                  <h2 className="text-sm font-bold text-foreground mb-3 tracking-wide">ペルソナ</h2>
              <PersonaCarousel>
                {validPersonas.map((persona, i) => (
                  <PersonaCard key={i} persona={persona} />
                ))}
              </PersonaCarousel>
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

      {/* 自社の立ち位置（STP連携・読み取り表示。空なら非表示） */}
      {brandStanceStatements && brandStanceStatements.statements.length > 0 && (
        <section>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-4 sm:p-5">
              <h2 className="text-sm font-bold text-foreground mb-3 tracking-wide">自社の立ち位置</h2>
              <p className="mb-4 text-[13px] text-muted-foreground">
                各ターゲットに対して、自社が何者として刺さるかをまとめたステートメントです。
              </p>
              <div className="space-y-3">
                {brandStanceStatements.statements.map((s, i) => {
                  const isMain = s.target_role === 'main'
                  return (
                    <div
                      key={i}
                      className={`rounded-lg border p-4 ${
                        isMain ? 'border-ds-app-accent bg-ds-app-accent/5' : 'border-border bg-background'
                      }`}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isMain ? 'bg-ds-app-accent text-white' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {isMain ? 'メインターゲット向け' : 'サブターゲット向け'}
                        </span>
                        <span className="text-xs text-muted-foreground">{s.target_name}</span>
                      </div>
                      <p className="text-sm leading-relaxed text-foreground" style={{ fontFamily: 'serif' }}>
                        {s.statement}
                      </p>
                      {s.rationale && (
                        <p className="mt-3 pt-3 border-t border-gray-100 text-xs text-muted-foreground leading-relaxed">
                          <span className="font-medium">なぜなら: </span>{s.rationale}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* 私たちの強み（STP連携・読み取り表示。空なら非表示） */}
      {strengths && strengths.trim() && (
        <section>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-4 sm:p-5">
              <h2 className="text-sm font-bold text-foreground mb-3 tracking-wide">私たちの強み</h2>
              <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">{strengths}</p>
            </CardContent>
          </Card>
        </section>
      )}

      {/* 提供価値（value_propositions ＋ companies.provided_values。空なら非表示。「考え方」から移動） */}
      {providedValues.length > 0 && (
        <section>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-4 sm:p-5">
              <h2 className="text-sm font-bold text-foreground mb-3 tracking-wide">提供価値</h2>
              <div className="space-y-3">
                {providedValues.map((val, i) => (
                  <div key={i} className="rounded-lg border border-border bg-background p-4 flex items-start gap-4">
                    <div className="shrink-0 w-9 h-9 rounded-full bg-ds-app-accent text-white flex items-center justify-center text-base font-bold">
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

