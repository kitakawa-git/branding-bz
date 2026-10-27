'use client'

// ブランド戦略 編集ページ（ターゲット・ペルソナ・ポジショニングマップ）
// ※ 行動指針(action_guidelines) は /admin/brand/guidelines（ブランド方針）へ移設済み
// 各カード・保存処理・AIターゲット提案は ./_components へ分割
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/supabase-fetch'
import { useAuth } from '../../components/AdminDataProvider'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { Button } from '@/components/ui/button'
import { type PortalSubtitles } from '@/lib/portal-subtitles'
import type { TargetFitMap, BrandStanceStatement } from '@/app/tools/stp/app/[sessionId]/page'
import { Check } from 'lucide-react'
import { Fab, FabButton } from '@/components/ui/fab'
import { TargetSuggestDialog } from '@/components/brand/TargetSuggestDialog'
import type { PositioningMapData } from '@/lib/types/positioning-map'
import { type PersonaItem, type ProvidedValueItem, type StrategyCache, type TargetSegment } from './_components/types'
import { StrategySkeleton } from './_components/StrategySkeleton'
import { TargetCard } from './_components/TargetCard'
import { PersonaCard } from './_components/PersonaCard'
import { PositioningCard } from './_components/PositioningCard'
import { ProvidedValuesCard } from './_components/ProvidedValuesCard'
import { useTargetSuggest } from './_components/useTargetSuggest'
import { buildRestHeaders, saveStrategy } from './_components/saveStrategy'

export default function BrandStrategyPage() {
  const { companyId, companyName } = useAuth()
  const cacheKey = `admin-brand-strategy-${companyId}`
  const cached = companyId ? getPageCache<StrategyCache>(cacheKey) : null
  const [targetOverview, setTargetOverview] = useState<string>(cached?.targetOverview ?? '')
  const [targetSegments, setTargetSegments] = useState<TargetSegment[]>(cached?.targetSegments ?? [])
  const [providedValues, setProvidedValues] = useState<ProvidedValueItem[]>(cached?.providedValues ?? [])
  const [personas, setPersonas] = useState<PersonaItem[]>(cached?.personas ?? [])
  const [openAvatarIdx, setOpenAvatarIdx] = useState<number | null>(null)
  const [positioningMapData, setPositioningMapData] = useState<PositioningMapData | null>(cached?.positioningMapData ?? null)
  const [targetFitMapData, setTargetFitMapData] = useState<TargetFitMap | null>(cached?.targetFitMapData ?? null)
  const [brandStanceStatements, setBrandStanceStatements] = useState<{ statements: BrandStanceStatement[] } | null>(cached?.brandStanceStatements ?? null)
  const [strengths, setStrengths] = useState<string>(cached?.strengths ?? '')
  const [competitorsAnalysis, setCompetitorsAnalysis] = useState<Array<{ name: string; traits: string }>>(cached?.competitorsAnalysis ?? [])
  const [loading, setLoading] = useState(!cached)
  const [fetchError, setFetchError] = useState('')
  const [saving, setSaving] = useState(false)
  const [portalSubtitle, setPortalSubtitle] = useState(cached?.portalSubtitle ?? '')
  const [portalSubtitlesData, setPortalSubtitlesData] = useState<PortalSubtitles | null>(cached?.portalSubtitlesData ?? null)

  const fetchData = async () => {
    if (!companyId) return
    setLoading(true)
    setFetchError('')

    try {
      const { data, error: fetchErr } = await fetchWithRetry(() =>
        supabase.from('brand_personas').select('*').eq('company_id', companyId).order('sort_order')
      )
      if (fetchErr) throw new Error(fetchErr)

      // 提供価値（value_propositions テーブル。「考え方」から移動・統合）
      const { data: bvData } = await fetchWithRetry(() =>
        supabase.from('value_propositions').select('id, title, description, sort_order').eq('company_id', companyId).order('sort_order')
      )
      const parsedProvidedValues: ProvidedValueItem[] = ((bvData as Record<string, unknown>[]) || []).map((d) => ({
        id: (d.id as string) || undefined,
        title: (d.title as string) || '',
        description: (d.description as string) || '',
      }))
      setProvidedValues(parsedProvidedValues)

      // ポータルサブタイトル・ターゲットセグメント取得
      let fetchedSubtitlesData: PortalSubtitles | null = null
      let fetchedSubtitle = ''
      let companyData: Record<string, unknown> | null = null
      try {
        const { data: cd } = await supabase
          .from('companies')
          .select('portal_subtitles, target_segments, strengths, competitors_analysis')
          .eq('id', companyId)
          .single()
        companyData = cd as Record<string, unknown> | null
        if (companyData) {
          const subtitles = (companyData.portal_subtitles as PortalSubtitles) || null
          fetchedSubtitlesData = subtitles
          fetchedSubtitle = subtitles?.strategy || ''
          setPortalSubtitlesData(subtitles)
          setPortalSubtitle(fetchedSubtitle)
        }
      } catch {
        // 取得失敗は無視
      }

      // target_segments 構造化データ: companies.target_segments 優先
      const rawTs = (companyData?.target_segments as TargetSegment[]) || []
      const companyTargetSegments = rawTs
        .filter(ts => ts && ts.name)
        .map(ts => ({ name: ts.name || '', description: ts.description || '' }))
      // STP連携: 自社の強み・競合分析（companies）
      const parsedStrengths = (companyData?.strengths as string) || ''
      const parsedCompetitorsAnalysis = ((companyData?.competitors_analysis as Array<{ name?: string; traits?: string }>) || [])
        .filter(c => c?.name?.trim())
        .map(c => ({ name: (c.name as string).trim(), traits: (c.traits || '').trim() }))
      setStrengths(parsedStrengths)
      setCompetitorsAnalysis(parsedCompetitorsAnalysis)

      if (data && data.length > 0) {
        const first = data[0] as Record<string, unknown>
        // ターゲット概要（プロセス文）: brand_personas[0].target
        const parsedTargetOverview = (first.target as string) || ''
        const parsedMapData = (first.positioning_map_data as PositioningMapData) || null
        // STP連携: ターゲット適合マップ・自社の立ち位置（保存済みを読み取り表示）
        const parsedFitMap = (first.target_fit_map_data as TargetFitMap) || null
        const parsedStance = (first.brand_stance_statements as { statements: BrandStanceStatement[] }) || null
        const parsedPersonas = data.map((d: Record<string, unknown>) => ({
          id: (d.id as string) || undefined,
          name: (d.name as string) || '',
          avatar_emoji: (d.avatar_emoji as string) || '',
          age_range: (d.age_range as string) || '',
          occupation: (d.occupation as string) || '',
          description: (d.description as string) || '',
          needs: (d.needs as string[]) || [],
          pain_points: (d.pain_points as string[]) || [],
          decision_factors: (d.decision_factors as string[]) || [],
          buying_barriers: (d.buying_barriers as string[]) || [],
          brand_expectations: (d.brand_expectations as string) || '',
        }))

        // 主なターゲット: companies.target_segments（概要文とは別管理）
        setTargetOverview(parsedTargetOverview)
        setTargetSegments(companyTargetSegments)
        setPositioningMapData(parsedMapData)
        setTargetFitMapData(parsedFitMap)
        setBrandStanceStatements(parsedStance)
        setPersonas(parsedPersonas)
        setPageCache<StrategyCache>(cacheKey, {
          targetOverview: parsedTargetOverview,
          targetSegments: companyTargetSegments,
          providedValues: parsedProvidedValues,
          personas: parsedPersonas,
          positioningMapData: parsedMapData,
          targetFitMapData: parsedFitMap,
          brandStanceStatements: parsedStance,
          strengths: parsedStrengths,
          competitorsAnalysis: parsedCompetitorsAnalysis,
          portalSubtitle: fetchedSubtitle,
          portalSubtitlesData: fetchedSubtitlesData,
        })
      } else if (companyTargetSegments.length > 0) {
        // brand_personas レコードなしでも companies のデータがあれば表示
        setTargetSegments(companyTargetSegments)
      }
    } catch (err) {
      console.error('[BrandStrategy] データ取得エラー:', err)
      const msg = err instanceof Error ? err.message : 'データの取得に失敗しました'
      setFetchError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!companyId) return
    if (getPageCache<StrategyCache>(cacheKey)) return
    fetchData()
  }, [companyId, cacheKey])

  // AIターゲット提案（残り回数取得の effect は上のデータ取得 effect の後に登録＝従来と同順）
  const {
    targetSuggesting,
    targetRemaining,
    targetResetsAt,
    targetSuggestOpen,
    setTargetSuggestOpen,
    targetSuggestions,
    handleSuggestTargets,
    addSelectedTargets,
  } = useTargetSuggest(companyId, targetSegments, setTargetSegments)

  // 保存処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return
    setSaving(true)

    const headers = await buildRestHeaders()

    // 主なターゲット（companies.target_segments 用）をクリーンアップ
    const validSegments = targetSegments
      .filter(ts => ts.name.trim())
      .map(ts => ({ name: ts.name.trim(), description: ts.description?.trim() || '' }))
    // ターゲット概要（プロセス文）は brand_personas[0].target にそのまま保存
    const overviewText = targetOverview.trim()

    try {
      const { savedPersonas, savedValues, updatedSubtitles } = await saveStrategy({
        companyId,
        headers,
        personas,
        providedValues,
        overviewText,
        validSegments,
        positioningMapData,
        brandStanceStatements,
        portalSubtitle,
        portalSubtitlesData,
        strengths,
        competitorsAnalysis,
      })
      setPortalSubtitlesData(updatedSubtitles)

      // 保存で確定した id を状態へ反映（reload無しの再保存で新規行が重複INSERTされないように）
      setPersonas(savedPersonas)
      setTargetSegments(validSegments)
      setProvidedValues(savedValues)
      // 保存内容でページキャッシュを更新（他ページ往復で消える問題の防止）
      setPageCache<StrategyCache>(cacheKey, {
        targetOverview: overviewText,
        targetSegments: validSegments,
        providedValues: savedValues,
        personas: savedPersonas,
        positioningMapData,
        targetFitMapData,
        brandStanceStatements,
        strengths,
        competitorsAnalysis,
        portalSubtitle: portalSubtitle.trim(),
        portalSubtitlesData: updatedSubtitles,
      })
      toast.success('保存しました')
    } catch (err) {
      console.error('[BrandStrategy Save] エラー:', err)
      toast.error('保存に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <StrategySkeleton />
  }

  if (fetchError) {
    return (
      <div className="text-center p-10">
        <p className="text-red-600 text-sm mb-3">{fetchError}</p>
        <Button variant="outline" onClick={fetchData} className="py-2 px-4 text-[13px]">
          再読み込み
        </Button>
      </div>
    )
  }

  return (
    <div>
      <form id="strategy-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Card 1: ターゲット概要＋主なターゲット＋ターゲット適合マップ（統合） */}
        <TargetCard
          targetOverview={targetOverview}
          onTargetOverviewChange={setTargetOverview}
          targetSegments={targetSegments}
          onTargetSegmentsChange={setTargetSegments}
          targetFitMapData={targetFitMapData}
          targetSuggesting={targetSuggesting}
          targetRemaining={targetRemaining}
          targetResetsAt={targetResetsAt}
          onSuggestTargets={handleSuggestTargets}
        />

        {/* Card 3: ペルソナ */}
        <PersonaCard
          personas={personas}
          setPersonas={setPersonas}
          openAvatarIdx={openAvatarIdx}
          setOpenAvatarIdx={setOpenAvatarIdx}
        />

        {/* Card 2: 自社の立ち位置＋ポジショニングマップ（統合） */}
        <PositioningCard
          brandStanceStatements={brandStanceStatements}
          setBrandStanceStatements={setBrandStanceStatements}
          positioningMapData={positioningMapData}
          setPositioningMapData={setPositioningMapData}
          companyName={companyName}
          strengths={strengths}
          setStrengths={setStrengths}
          competitorsAnalysis={competitorsAnalysis}
          setCompetitorsAnalysis={setCompetitorsAnalysis}
        />

        {/* 自社の強み・競合分析はポジショニングマップの各プロット項目カード内で編集する（読み取り専用カードは廃止） */}

        {/* Card 3: 提供価値（value_propositions。「考え方」から移動・統合） */}
        <ProvidedValuesCard providedValues={providedValues} setProvidedValues={setProvidedValues} />

      </form>

      {/* 固定保存バー */}
      {/* FabBar との重なりを防ぐスペーサー */}
      <div className="h-24" />

      {/* 保存 FAB（右下固定・include-bz node の FabButton と同装飾） */}
      <Fab>
        <FabButton type="submit" form="strategy-form" disabled={saving} icon={<Check size={16} />}>
          {saving ? '保存中...' : '保存'}
        </FabButton>
      </Fab>

      {/* AIターゲット提案の候補選択ダイアログ */}
      <TargetSuggestDialog
        open={targetSuggestOpen}
        onOpenChange={setTargetSuggestOpen}
        suggestions={targetSuggestions}
        onConfirm={addSelectedTargets}
      />
    </div>
  )
}
