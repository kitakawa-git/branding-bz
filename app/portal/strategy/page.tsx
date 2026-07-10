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
import { PositioningMapAndStance } from '@/components/shared/PositioningMapAndStance'
import { TargetSegmentCards } from '@/components/shared/TargetSegmentCards'
import { TargetDeepDive } from '@/components/shared/TargetDeepDive'
import { TargetFitMapPreview } from '@/components/shared/TargetFitMapPreview'
import type { PositioningMapData } from '@/lib/types/positioning-map'
import type { BrandStanceStatement, TargetFitMap } from '@/app/tools/stp/app/[sessionId]/page'

type Persona = PortalPersona

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
    brandStanceStatements: { statements: BrandStanceStatement[] } | null
    strengths: string
    buyingFactors: string[]
    competitorsAnalysis: Array<{ name: string; traits?: string }>
    targetFitMap: TargetFitMap | null
  }
  const cacheKey = `portal-strategy-${companyId}`
  const cached = companyId ? getPageCache<StrategyCache>(cacheKey) : null

  const [target, setTarget] = useState(cached?.target ?? '')
  const [targetSegments, setTargetSegments] = useState<TargetSegment[]>(cached?.targetSegments ?? [])
  const [providedValues, setProvidedValues] = useState<ProvidedValueItem[]>(cached?.providedValues ?? [])
  const [personas, setPersonas] = useState<Persona[]>(cached?.personas ?? [])
  const [positioningMapUrl, setPositioningMapUrl] = useState(cached?.positioningMapUrl ?? '')
  const [positioningMapData, setPositioningMapData] = useState<PositioningMapData | null>(cached?.positioningMapData ?? null)
  const [brandStanceStatements, setBrandStanceStatements] = useState<{ statements: BrandStanceStatement[] } | null>(cached?.brandStanceStatements ?? null)
  const [strengths, setStrengths] = useState<string>(cached?.strengths ?? '')
  const [buyingFactors, setBuyingFactors] = useState<string[]>(cached?.buyingFactors ?? [])
  const [competitorsAnalysis, setCompetitorsAnalysis] = useState<Array<{ name: string; traits?: string }>>(cached?.competitorsAnalysis ?? [])
  const [targetFitMap, setTargetFitMap] = useState<TargetFitMap | null>(cached?.targetFitMap ?? null)
  const [loading, setLoading] = useState(!cached)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    if (!companyId) return
    if (getPageCache<StrategyCache>(cacheKey)) return

    Promise.all([
      fetchWithRetry(() =>
        supabase
          .from('brand_personas')
          .select('name, avatar_emoji, age_range, occupation, description, needs, pain_points, brand_expectations, target, positioning_map_url, positioning_map_data, brand_stance_statements, decision_factors, target_fit_map_data, sort_order')
          .eq('company_id', companyId)
          .order('sort_order')
      ),
      // 主なターゲット（companies.target_segments）
      fetchWithRetry(() =>
        supabase.from('companies').select('target_segments, strengths, competitors_analysis').eq('id', companyId).maybeSingle()
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
      // STP連携: 自社の強み（companies.strengths）・競合分析（companies.competitors_analysis）
      const parsedStrengths = (companyData?.strengths as string) || ''
      setStrengths(parsedStrengths)
      const parsedCompetitorsAnalysis = (companyData?.competitors_analysis as Array<{ name: string; traits?: string }> | null) || []
      setCompetitorsAnalysis(parsedCompetitorsAnalysis)

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
      let parsedStance: { statements: BrandStanceStatement[] } | null = null
      let parsedBuyingFactors: string[] = []
      let parsedFitMap: TargetFitMap | null = null
      if (data && Array.isArray(data) && data.length > 0) {
        const first = data[0]
        parsedTarget = (first.target as string) || ''
        parsedMapUrl = (first.positioning_map_url as string) || ''
        parsedMapData = (first.positioning_map_data as PositioningMapData) || null
        parsedStance = (first.brand_stance_statements as { statements: BrandStanceStatement[] }) || null
        parsedBuyingFactors = (first.decision_factors as string[]) || []
        parsedFitMap = (first.target_fit_map_data as TargetFitMap) || null
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
      setBrandStanceStatements(parsedStance)
      setBuyingFactors(parsedBuyingFactors)
      setTargetFitMap(parsedFitMap)
      setPersonas(parsedPersonas)

      setPageCache(cacheKey, {
        target: parsedTarget,
        targetSegments: parsedSegments,
        providedValues: parsedProvidedValues,
        positioningMapUrl: parsedMapUrl,
        positioningMapData: parsedMapData,
        brandStanceStatements: parsedStance,
        strengths: parsedStrengths,
        buyingFactors: parsedBuyingFactors,
        competitorsAnalysis: parsedCompetitorsAnalysis,
        targetFitMap: parsedFitMap,
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

  const hasDeepDive = !!strengths?.trim() || buyingFactors.length > 0 || competitorsAnalysis.length > 0
  const hasTarget = targetSegments.length > 0 || !!target || hasDeepDive
  const hasContent = hasTarget || personas.some(p => p.name) || positioningMapData || positioningMapUrl || providedValues.length > 0
  if (!hasContent) return <div className="text-center py-16 text-muted-foreground text-[15px]">まだ登録されていません</div>

  const validPersonas = personas.filter(p => p.name)

  return (
    <>
    <BrandFontLoader fonts={brandFonts} />
    {companyId && <BrandPageTracker companyId={companyId} pageType="strategy" />}
    <div className="max-w-4xl mx-auto px-5 pt-4 pb-10 space-y-6">

      {/* Card 1: ターゲット */}
      {hasTarget && (
        <section>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-4 sm:p-5">
              <h2 className="text-sm font-bold text-foreground mb-3 tracking-wide">ターゲット</h2>
              {/* 主なターゲット（STP分析ツール Step5と共通のバッジカード表現。先頭がメイン、以降がサブ） */}
              {targetSegments.length > 0 ? (
                <TargetSegmentCards
                  main={targetSegments[0] || null}
                  subs={targetSegments.slice(1)}
                  mainExtra={
                    <TargetDeepDive
                      buyingFactors={buyingFactors}
                      strengths={strengths}
                      competitorsAnalysis={competitorsAnalysis}
                    />
                  }
                />
              ) : hasDeepDive ? (
                <TargetDeepDive
                  buyingFactors={buyingFactors}
                  strengths={strengths}
                  competitorsAnalysis={competitorsAnalysis}
                  bordered={false}
                />
              ) : null}
              {/* 概要文（プロセス文）。AI生成の概要文（target_summary）が未生成の場合、
                  STP連携APIはメインターゲットの説明文をそのままフォールバックするため、
                  重複表示を避けるためメインターゲット説明文と同一なら非表示にする */}
              {target && target !== targetSegments[0]?.description && (
                <p className={`text-base sm:text-sm text-foreground/80 leading-[1.8] whitespace-pre-wrap m-0 ${targetSegments.length > 0 || hasDeepDive ? 'mt-3' : ''}`} style={secondaryStyle}>{target}</p>
              )}
              {/* ターゲット適合マップ（STP分析ツールと共通表示） */}
              {targetFitMap?.x_axis?.left && <TargetFitMapPreview fitMap={targetFitMap} />}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Card 1.5: ペルソナ */}
      {validPersonas.length > 0 && (
        <section>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-4 sm:p-5">
              <PersonaCarousel title="ペルソナ">
                {validPersonas.map((persona, i) => (
                  <PersonaCard key={i} persona={persona} />
                ))}
              </PersonaCarousel>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Card 2: ポジショニングマップ＋自社の立ち位置（STP Step5と共通レイアウト） */}
      {positioningMapData ? (
        <section>
          <PositioningMapAndStance
            positioningMapData={positioningMapData}
            brandStance={brandStanceStatements?.statements || []}
          />
        </section>
      ) : positioningMapUrl ? (
        <section>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none overflow-hidden">
            <CardContent className="p-4 sm:p-5">
              <h2 className="text-sm font-bold text-foreground mb-3 tracking-wide">ポジショニングマップ</h2>
              <img
                src={positioningMapUrl}
                alt="ポジショニングマップ"
                onClick={() => setModalOpen(true)}
                className="w-full max-h-[400px] object-contain rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
              />
            </CardContent>
          </Card>

          {/* 画像拡大ダイアログ（旧画像形式の場合のみ） */}
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

          {/* 自社の立ち位置（旧画像形式の場合は独立表示） */}
          {brandStanceStatements && brandStanceStatements.statements.length > 0 && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-bold text-gray-900">自社の立ち位置</h2>
              <div className="space-y-3.5">
                {brandStanceStatements.statements.map((s, i) => {
                  const isMain = s.target_role === 'main'
                  return (
                    <div
                      key={i}
                      className={`relative rounded-lg px-3 py-2.5 ${
                        isMain ? 'border border-ds-app-accent-soft bg-blue-50/50' : 'border border-blue-300 bg-blue-50/30'
                      }`}
                    >
                      <p className={`text-sm font-bold ${isMain ? 'text-gray-900' : 'text-gray-700'}`}>{s.target_name}</p>
                      <p className="mt-1 text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">{s.statement}</p>
                      {s.rationale && (
                        <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">なぜなら: {s.rationale}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      ) : null}

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

