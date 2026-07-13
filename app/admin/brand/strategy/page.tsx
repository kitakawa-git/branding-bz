'use client'

// ブランド戦略 編集ページ（ターゲット・ペルソナ・ポジショニングマップ）
// ※ 行動指針(action_guidelines) は /admin/brand/guidelines（ブランド方針）へ移設済み
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/supabase-fetch'
import { useAuth } from '../../components/AdminDataProvider'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import { type PortalSubtitles } from '@/lib/portal-subtitles'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { PositioningMap } from '@/components/PositioningMap'
import { TargetFitMapStatic } from '@/components/TargetFitMapStatic'
import type { TargetFitMap, BrandStanceStatement } from '@/app/tools/stp/app/[sessionId]/page'
import { Plus, Trash2, Check, WandSparkles, Loader2, UserCircle } from 'lucide-react'
import { AVATAR_EMOJIS } from '@/lib/persona/avatars'
import { Fab, FabButton } from '@/components/ui/fab'
import { TitleDescriptionList } from '@/components/shared/TitleDescriptionList'
import { TargetSuggestDialog, type TargetSuggestion } from '@/components/brand/TargetSuggestDialog'
import { TARGET_SUGGEST_MONTHLY_LIMIT } from '@/lib/constants/ai-limits'
import type { PositioningMapData, PositioningMapItem, PositioningMapSize } from '@/lib/types/positioning-map'

type PersonaItem = {
  // id は保存時の id保持sync 用（既存行はUPDATE・新規はINSERT）。新規入力時は未定義。
  id?: string
  name: string
  avatar_emoji: string // 顔アイコン（絵文字）。Persona Builder→connect で来る・ここで編集
  age_range: string
  occupation: string
  description: string
  needs: string[]
  pain_points: string[]
  // Tier1 離散カラム（Persona Builder の goals 由来。persona_data には残しつつ正本は離散カラム）
  decision_factors: string[]
  buying_barriers: string[]
  brand_expectations: string
}

type TargetSegment = {
  name: string
  description: string
}

// 提供価値（value_propositions テーブル。「考え方」から「接し方」へ移動・統合）
// id は保存時の id保持sync 用（既存行はUPDATE・新規はINSERT）。新規入力時は未定義。
type ProvidedValueItem = {
  id?: string
  title: string
  description: string
}

const emptyPersona = (): PersonaItem => ({
  name: '',
  avatar_emoji: '',
  age_range: '',
  occupation: '',
  description: '',
  needs: [],
  pain_points: [],
  decision_factors: [],
  buying_barriers: [],
  brand_expectations: '',
})

const emptyMapData = (): PositioningMapData => ({
  x_axis: { left: '', right: '' },
  y_axis: { bottom: '', top: '' },
  items: [],
})

const emptyMapItem = (): PositioningMapItem => ({
  name: '',
  color: '#3B82F6',
  x: 50,
  y: 50,
  size: 'md',
})

const DEFAULT_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
]

type StrategyCache = {
  targetOverview: string
  targetSegments: TargetSegment[]
  providedValues: ProvidedValueItem[]
  personas: PersonaItem[]
  positioningMapData: PositioningMapData | null
  targetFitMapData: TargetFitMap | null
  brandStanceStatements: { statements: BrandStanceStatement[] } | null
  strengths: string
  competitorsAnalysis: Array<{ name: string; traits: string }>
  portalSubtitle: string
  portalSubtitlesData: PortalSubtitles | null
}

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

  // AIターゲット提案
  const [targetSuggesting, setTargetSuggesting] = useState(false)
  const [targetRemaining, setTargetRemaining] = useState<number | null>(null)
  const [targetResetsAt, setTargetResetsAt] = useState<string | null>(null)
  const [targetSuggestOpen, setTargetSuggestOpen] = useState(false)
  const [targetSuggestions, setTargetSuggestions] = useState<TargetSuggestion[]>([])

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

  // AIターゲット提案の今月残り回数を取得（初期表示用）
  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    fetch('/api/admin/targets/suggest')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data) return
        if (typeof data.remaining === 'number') setTargetRemaining(data.remaining)
        if (data.resetsAt) setTargetResetsAt(data.resetsAt)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [companyId])

  // ISO日時（翌月1日00:00 JST）を「○月○日」表記に
  const formatResetDate = (iso: string | null): string => {
    if (!iso) return ''
    const jst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000)
    return `${jst.getUTCMonth() + 1}月${jst.getUTCDate()}日`
  }

  // AIでターゲットを提案
  const handleSuggestTargets = async () => {
    if (targetSuggesting) return
    if (targetRemaining !== null && targetRemaining <= 0) {
      toast.error('今月の利用上限に達しました')
      return
    }
    setTargetSuggesting(true)
    try {
      const res = await fetch('/api/admin/targets/suggest', { method: 'POST' })
      const data = await res.json().catch(() => ({}))

      if (res.status === 429) {
        setTargetRemaining(0)
        if (data.resetsAt) setTargetResetsAt(data.resetsAt)
        toast.error('今月の利用上限に達しました')
        return
      }
      if (!res.ok) {
        toast.error('ターゲットの提案に失敗しました。時間をおいて再度お試しください')
        return
      }

      if (typeof data.remaining === 'number') setTargetRemaining(data.remaining)
      if (data.resetsAt) setTargetResetsAt(data.resetsAt)

      const list: TargetSuggestion[] = Array.isArray(data.suggestions) ? data.suggestions : []
      if (list.length === 0) {
        toast.info('新たなターゲット候補は見つかりませんでした')
        return
      }
      setTargetSuggestions(list)
      setTargetSuggestOpen(true)
    } catch (err) {
      console.error('[BrandStrategy] AIターゲット提案エラー:', err)
      toast.error('ターゲットの提案に失敗しました。時間をおいて再度お試しください')
    } finally {
      setTargetSuggesting(false)
    }
  }

  // 選択した候補を target_segments に APPEND（名前重複はスキップ）
  const addSelectedTargets = (selected: TargetSuggestion[]) => {
    const existingNames = new Set(targetSegments.map(t => t.name.trim().toLowerCase()).filter(Boolean))
    const toAdd: TargetSegment[] = []
    let skipped = 0
    selected.forEach(s => {
      const n = s.name.trim().toLowerCase()
      if (!s.name.trim() || existingNames.has(n)) {
        skipped++
        return
      }
      existingNames.add(n)
      toAdd.push({ name: s.name.trim(), description: s.description?.trim() || '' })
    })
    if (toAdd.length > 0) setTargetSegments([...targetSegments, ...toAdd])
    setTargetSuggestOpen(false)
    const parts: string[] = []
    if (toAdd.length > 0) parts.push(`${toAdd.length}件を追加しました`)
    if (skipped > 0) parts.push(`重複${skipped}件をスキップ`)
    const msg = parts.length > 0 ? parts.join('・') : '追加対象がありませんでした'
    if (toAdd.length > 0) toast.success(`${msg}（「保存」で確定します）`)
    else toast.info(msg)
  }

  // ペルソナ操作
  const addPersona = () => {
    if (personas.length >= 5) return
    setPersonas([...personas, emptyPersona()])
  }

  const updatePersona = (index: number, field: keyof PersonaItem, value: string | string[]) => {
    const updated = [...personas]
    updated[index] = { ...updated[index], [field]: value }
    setPersonas(updated)
  }

  const removePersona = (index: number) => {
    setPersonas(personas.filter((_, i) => i !== index))
  }

  // 提供価値（value_propositions）操作
  const addProvidedValue = () => {
    setProvidedValues([...providedValues, { title: '', description: '' }])
  }

  const updateProvidedValue = (index: number, field: 'title' | 'description', value: string) => {
    const updated = [...providedValues]
    updated[index] = { ...updated[index], [field]: value }
    setProvidedValues(updated)
  }

  const removeProvidedValue = (index: number) => {
    setProvidedValues(providedValues.filter((_, i) => i !== index))
  }

  // ニーズの操作
  const addNeed = (personaIndex: number) => {
    const updated = [...personas]
    updated[personaIndex] = {
      ...updated[personaIndex],
      needs: [...updated[personaIndex].needs, ''],
    }
    setPersonas(updated)
  }

  const updateNeed = (personaIndex: number, needIndex: number, value: string) => {
    const updated = [...personas]
    const needs = [...updated[personaIndex].needs]
    needs[needIndex] = value
    updated[personaIndex] = { ...updated[personaIndex], needs }
    setPersonas(updated)
  }

  const removeNeed = (personaIndex: number, needIndex: number) => {
    const updated = [...personas]
    updated[personaIndex] = {
      ...updated[personaIndex],
      needs: updated[personaIndex].needs.filter((_, i) => i !== needIndex),
    }
    setPersonas(updated)
  }

  // 課題の操作
  const addPainPoint = (personaIndex: number) => {
    const updated = [...personas]
    updated[personaIndex] = {
      ...updated[personaIndex],
      pain_points: [...updated[personaIndex].pain_points, ''],
    }
    setPersonas(updated)
  }

  const updatePainPoint = (personaIndex: number, pointIndex: number, value: string) => {
    const updated = [...personas]
    const pain_points = [...updated[personaIndex].pain_points]
    pain_points[pointIndex] = value
    updated[personaIndex] = { ...updated[personaIndex], pain_points }
    setPersonas(updated)
  }

  const removePainPoint = (personaIndex: number, pointIndex: number) => {
    const updated = [...personas]
    updated[personaIndex] = {
      ...updated[personaIndex],
      pain_points: updated[personaIndex].pain_points.filter((_, i) => i !== pointIndex),
    }
    setPersonas(updated)
  }

  // Tier1 配列項目（意思決定要因・購買障壁）の汎用操作。needs/pain_points と同じ要領。
  type PersonaListField = 'decision_factors' | 'buying_barriers'
  const addPersonaListItem = (personaIndex: number, field: PersonaListField) => {
    const updated = [...personas]
    updated[personaIndex] = { ...updated[personaIndex], [field]: [...updated[personaIndex][field], ''] }
    setPersonas(updated)
  }
  const updatePersonaListItem = (personaIndex: number, field: PersonaListField, itemIndex: number, value: string) => {
    const updated = [...personas]
    const list = [...updated[personaIndex][field]]
    list[itemIndex] = value
    updated[personaIndex] = { ...updated[personaIndex], [field]: list }
    setPersonas(updated)
  }
  const removePersonaListItem = (personaIndex: number, field: PersonaListField, itemIndex: number) => {
    const updated = [...personas]
    updated[personaIndex] = {
      ...updated[personaIndex],
      [field]: updated[personaIndex][field].filter((_, i) => i !== itemIndex),
    }
    setPersonas(updated)
  }

  // ポジショニングマップ操作
  const initializeMap = () => {
    setPositioningMapData(emptyMapData())
  }

  const clearMap = () => {
    setPositioningMapData(null)
  }

  const updateXAxis = (side: 'left' | 'right', value: string) => {
    setPositioningMapData(prev => {
      if (!prev) return prev
      return { ...prev, x_axis: { ...prev.x_axis, [side]: value } }
    })
  }

  const updateYAxis = (side: 'top' | 'bottom', value: string) => {
    setPositioningMapData(prev => {
      if (!prev) return prev
      return { ...prev, y_axis: { ...prev.y_axis, [side]: value } }
    })
  }

  const addMapItem = () => {
    setPositioningMapData(prev => {
      if (!prev || prev.items.length >= 10) return prev
      const newItem = emptyMapItem()
      newItem.color = DEFAULT_COLORS[prev.items.length % DEFAULT_COLORS.length]
      return { ...prev, items: [...prev.items, newItem] }
    })
  }

  const updateMapItem = (index: number, field: keyof PositioningMapItem, value: string | number) => {
    setPositioningMapData(prev => {
      if (!prev) return prev
      const items = [...prev.items]
      items[index] = { ...items[index], [field]: value }
      return { ...prev, items }
    })
  }

  const removeMapItem = (index: number) => {
    setPositioningMapData(prev => {
      if (!prev) return prev
      return { ...prev, items: prev.items.filter((_, i) => i !== index) }
    })
  }

  // プロット項目が自社かどうか（名称が会社名と一致すれば自社）
  const isSelfItem = (itemName: string) =>
    !!companyName && itemName.trim().toLowerCase() === companyName.trim().toLowerCase()

  // プロット項目の説明（自社=自社の強み strengths、競合=競合の特徴 competitorsAnalysis[].traits）
  const getItemDescription = (itemName: string): string => {
    if (isSelfItem(itemName)) return strengths
    const match = competitorsAnalysis.find(c => c.name.trim().toLowerCase() === itemName.trim().toLowerCase())
    return match?.traits ?? ''
  }

  const updateItemDescription = (itemName: string, text: string) => {
    if (isSelfItem(itemName)) {
      setStrengths(text)
      return
    }
    // 競合: 名称一致でupsert（無ければ追加）
    setCompetitorsAnalysis(prev => {
      const idx = prev.findIndex(c => c.name.trim().toLowerCase() === itemName.trim().toLowerCase())
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], traits: text }
        return next
      }
      return [...prev, { name: itemName.trim(), traits: text }]
    })
  }

  // 自社の立ち位置（ステートメント）の編集
  const updateStanceStatement = (index: number, field: 'target_name' | 'statement' | 'rationale', value: string) => {
    setBrandStanceStatements(prev => {
      if (!prev) return prev
      const statements = [...prev.statements]
      statements[index] = { ...statements[index], [field]: value }
      return { ...prev, statements }
    })
  }

  // 保存処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return
    setSaving(true)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token || ''

    const headers = {
      'Content-Type': 'application/json',
      'apikey': anonKey,
      'Authorization': `Bearer ${token}`,
      'Prefer': 'return=minimal',
    }

    // 主なターゲット（companies.target_segments 用）をクリーンアップ
    const validSegments = targetSegments
      .filter(ts => ts.name.trim())
      .map(ts => ({ name: ts.name.trim(), description: ts.description?.trim() || '' }))
    // ターゲット概要（プロセス文）は brand_personas[0].target にそのまま保存
    const overviewText = targetOverview.trim()

    try {
      // ペルソナ保存: id保持sync（提供価値 value_propositions と同方式）。
      // 旧実装は company単位で全DELETE→全INSERT していたが、これだと
      //  (1) persona_data / journey_map_data（Persona Builder のリッチ出力・ジャーニー全体）が
      //      INSERTペイロードに無いため保存のたびに消える、
      //  (2) persona id が変わり、削除時トリガ cleanup_element_relations_on_delete が
      //      persona を端点に持つ element_relations を道連れに消す（エッジ消失）。
      // → 既存id→PATCH（フォーム6項目＋row0特有列のみ。persona_data/journey_map_data は触れず温存）
      //    / 新規→POST / 実際に削除された分のみ DELETE、に変更する。
      const cleanedPersonas = personas.filter(p =>
        p.name.trim() !== '' || p.age_range.trim() !== '' || p.occupation.trim() !== ''
      )

      // 既存ペルソナ id（sort_order順）
      const pExRes = await fetch(`${supabaseUrl}/rest/v1/brand_personas?company_id=eq.${companyId}&select=id&order=sort_order`, { headers })
      if (!pExRes.ok) {
        throw new Error(`ペルソナの既存取得エラー: HTTP ${pExRes.status}: ${await pExRes.text()}`)
      }
      const pExistingIds = ((await pExRes.json()) as { id: string }[]).map(r => r.id)
      const pExistingIdSet = new Set(pExistingIds)
      const pKept = new Set<string>()
      const savedPersonas: PersonaItem[] = []

      // 1ペルソナ分の書き込み値。persona_data / journey_map_data は含めない＝既存値を温存。
      // target / positioning_map_data / segmentation_data は従来どおり先頭行(row0)にのみ載せる。
      const buildPersonaPayload = (p: PersonaItem, i: number) => ({
        name: p.name,
        avatar_emoji: p.avatar_emoji || null,
        age_range: p.age_range || null,
        occupation: p.occupation || null,
        description: p.description || null,
        needs: p.needs.filter(n => n.trim() !== ''),
        pain_points: p.pain_points.filter(pp => pp.trim() !== ''),
        decision_factors: p.decision_factors.filter(d => d.trim() !== ''),
        buying_barriers: p.buying_barriers.filter(b => b.trim() !== ''),
        brand_expectations: p.brand_expectations.trim() || null,
        sort_order: i,
        target: i === 0 ? (overviewText || null) : null,
        positioning_map_data: i === 0 ? (positioningMapData || null) : null,
        brand_stance_statements: i === 0 ? (brandStanceStatements || null) : null,
      })

      if (cleanedPersonas.length > 0) {
        for (let i = 0; i < cleanedPersonas.length; i++) {
          const p = cleanedPersonas[i]
          const payload = buildPersonaPayload(p, i)
          if (p.id && pExistingIdSet.has(p.id)) {
            const res = await fetch(`${supabaseUrl}/rest/v1/brand_personas?id=eq.${p.id}`, {
              method: 'PATCH', headers, body: JSON.stringify(payload),
            })
            if (!res.ok) throw new Error(`ペルソナの更新エラー: HTTP ${res.status}: ${await res.text()}`)
            pKept.add(p.id)
            savedPersonas.push({ ...p, id: p.id })
          } else {
            const res = await fetch(`${supabaseUrl}/rest/v1/brand_personas`, {
              method: 'POST', headers: { ...headers, 'Prefer': 'return=representation' },
              body: JSON.stringify({ company_id: companyId, ...payload }),
            })
            if (!res.ok) throw new Error(`ペルソナの挿入エラー: HTTP ${res.status}: ${await res.text()}`)
            const inserted = (await res.json()) as { id: string }[]
            const nid = inserted[0]?.id
            if (nid) pKept.add(nid)
            savedPersonas.push({ ...p, id: nid })
          }
        }
      } else if (overviewText || positioningMapData || brandStanceStatements) {
        // ペルソナは無いが概要/ポジショニング/立ち位置を保持するため row0 を1件維持。
        const dummyPayload = {
          name: '',
          sort_order: 0,
          target: overviewText || null,
          positioning_map_data: positioningMapData || null,
          brand_stance_statements: brandStanceStatements || null,
        }
        if (pExistingIds.length > 0) {
          const res = await fetch(`${supabaseUrl}/rest/v1/brand_personas?id=eq.${pExistingIds[0]}`, {
            method: 'PATCH', headers, body: JSON.stringify(dummyPayload),
          })
          if (!res.ok) throw new Error(`ペルソナ概要の更新エラー: HTTP ${res.status}: ${await res.text()}`)
          pKept.add(pExistingIds[0])
        } else {
          const res = await fetch(`${supabaseUrl}/rest/v1/brand_personas`, {
            method: 'POST', headers, body: JSON.stringify({ company_id: companyId, ...dummyPayload }),
          })
          if (!res.ok) throw new Error(`ペルソナ概要の挿入エラー: HTTP ${res.status}: ${await res.text()}`)
        }
      }

      // 実際に削除されたペルソナのみ DELETE（ここだけ削除時トリガでエッジ整理が正しく起きる）
      const pToDelete = pExistingIds.filter(id => !pKept.has(id))
      if (pToDelete.length > 0) {
        const delRes = await fetch(`${supabaseUrl}/rest/v1/brand_personas?id=in.(${pToDelete.join(',')})`, {
          method: 'DELETE', headers,
        })
        if (!delRes.ok) throw new Error(`ペルソナの削除エラー: HTTP ${delRes.status}: ${await delRes.text()}`)
      }

      // 提供価値（value_propositions）保存: id保持sync。
      // 全削除→全INSERT だと毎回 id が変わり、削除時トリガ cleanup_element_relations_on_delete が
      // vp を端点に持つ element_relations を道連れに消す（エッジ消失バグ）。よって
      // 既存id→PATCH（in-place UPDATE）/ 新規→POST / 実際に削除された分のみ DELETE に変更する。
      const cleanedValues = providedValues.filter(v => v.title.trim() !== '')
      const bvExRes = await fetch(`${supabaseUrl}/rest/v1/value_propositions?company_id=eq.${companyId}&select=id`, { headers })
      if (!bvExRes.ok) {
        throw new Error(`提供価値の既存取得エラー: HTTP ${bvExRes.status}: ${await bvExRes.text()}`)
      }
      const bvExistingIds = new Set(((await bvExRes.json()) as { id: string }[]).map(r => r.id))
      const savedValues: ProvidedValueItem[] = []
      const bvKept = new Set<string>()
      for (let i = 0; i < cleanedValues.length; i++) {
        const v = cleanedValues[i]
        const payload = { title: v.title.trim(), description: v.description?.trim() || null, sort_order: i }
        if (v.id && bvExistingIds.has(v.id)) {
          const res = await fetch(`${supabaseUrl}/rest/v1/value_propositions?id=eq.${v.id}`, {
            method: 'PATCH', headers, body: JSON.stringify(payload),
          })
          if (!res.ok) throw new Error(`提供価値の更新エラー: HTTP ${res.status}: ${await res.text()}`)
          bvKept.add(v.id)
          savedValues.push({ ...v, id: v.id })
        } else {
          const res = await fetch(`${supabaseUrl}/rest/v1/value_propositions`, {
            method: 'POST', headers: { ...headers, 'Prefer': 'return=representation' },
            body: JSON.stringify({ company_id: companyId, ...payload }),
          })
          if (!res.ok) throw new Error(`提供価値の挿入エラー: HTTP ${res.status}: ${await res.text()}`)
          const inserted = (await res.json()) as { id: string }[]
          const nid = inserted[0]?.id
          if (nid) bvKept.add(nid)
          savedValues.push({ ...v, id: nid })
        }
      }
      // 実際に削除された提供価値のみ DELETE（ここだけ削除時トリガでエッジ整理が正しく起きる）
      const bvToDelete = [...bvExistingIds].filter(id => !bvKept.has(id))
      if (bvToDelete.length > 0) {
        const res = await fetch(`${supabaseUrl}/rest/v1/value_propositions?id=in.(${bvToDelete.join(',')})`, {
          method: 'DELETE', headers,
        })
        if (!res.ok) throw new Error(`提供価値の削除エラー: HTTP ${res.status}: ${await res.text()}`)
      }

      // ポータルサブタイトル + ターゲットセグメント保存（companies テーブル）
      const updatedSubtitles = { ...(portalSubtitlesData || {}) }
      if (portalSubtitle.trim()) {
        updatedSubtitles.strategy = portalSubtitle.trim()
      } else {
        delete updatedSubtitles.strategy
      }
      await fetch(`${supabaseUrl}/rest/v1/companies?id=eq.${companyId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          portal_subtitles: Object.keys(updatedSubtitles).length > 0 ? updatedSubtitles : null,
          target_segments: validSegments.length > 0 ? validSegments : null,
          // プロット項目カードで編集した自社の強み・競合の特徴
          strengths: strengths.trim() || null,
          competitors_analysis: competitorsAnalysis.filter(c => c.name.trim()).length > 0
            ? competitorsAnalysis.filter(c => c.name.trim()).map(c => ({ name: c.name.trim(), traits: c.traits.trim() }))
            : null,
        }),
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
    return (
      <div className="space-y-6">
        {/* Card 1: ターゲット概要＋主なターゲット＋ペルソナ */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 space-y-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-20 w-full rounded-md" />
            <Skeleton className="h-4 w-24" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[1, 2].map(i => (
                <div key={i} className="border border-border rounded-lg p-4 space-y-3 bg-background">
                  <Skeleton className="h-10 w-full rounded-md" />
                  <Skeleton className="h-16 w-full rounded-md" />
                </div>
              ))}
            </div>
            <Skeleton className="h-4 w-20" />
            <div className="border border-border rounded-lg p-4 space-y-3 bg-background">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-16 w-full rounded-md" />
            </div>
          </CardContent>
        </Card>
        {/* Card 2: ポジショニングマップ */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 space-y-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
    )
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
      <form id="strategy-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: ターゲット概要＋主なターゲット＋ターゲット適合マップ（統合） */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 space-y-8">
            {/* ターゲット概要（プロセス文） */}
            <div>
              <h2 className="text-xs font-bold mb-3">ターゲット概要</h2>
              <AutoResizeTextarea
                value={targetOverview}
                onChange={(e) => setTargetOverview(e.target.value)}
                placeholder="ターゲット全体の考え方・方針の概要文（任意）"
                className="min-h-[90px]"
              />
            </div>

            {/* 主なターゲット */}
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-gray-700">主なターゲット</span>
                  <span className="text-xs text-gray-400">（任意）</span>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleSuggestTargets}
                  disabled={targetSuggesting || targetRemaining === 0}
                  className="text-sm"
                >
                  {targetSuggesting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <WandSparkles size={14} />
                  )}
                  {targetSuggesting ? 'AI提案中...' : 'AIで提案'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                {targetRemaining === 0
                  ? `AI提案は今月の利用上限に達しました（${formatResetDate(targetResetsAt)}にリセット）`
                  : targetRemaining !== null
                    ? `AIによる提案は月${TARGET_SUGGEST_MONTHLY_LIMIT}回まで・今月あと ${targetRemaining} 回`
                    : `AIによる提案は月${TARGET_SUGGEST_MONTHLY_LIMIT}回まで`}
              </p>
              <TitleDescriptionList
                label=""
                items={targetSegments.map(ts => ({ title: ts.name, description: ts.description }))}
                onChange={(newItems) => {
                  setTargetSegments(newItems.map(item => ({ name: item.title, description: item.description })))
                }}
                addButtonLabel="ターゲットを追加"
                titlePlaceholder="セグメント名（例: 中小企業の経営者）"
                descriptionPlaceholder="セグメントの説明"
              />
            </div>

            {/* ターゲット適合マップ（STP連携・読み取り表示） */}
            {targetFitMapData && (
              <div>
                <h2 className="text-xs font-bold mb-3">ターゲット適合マップ</h2>
                <p className="mb-4 text-[13px] text-muted-foreground">
                  選んだターゲットが自社のカバー範囲に入っているかをチェックした結果です。
                </p>
                <TargetFitMapStatic fitMap={targetFitMapData} />
                {targetFitMapData.axis_rationale && (
                  <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
                    <span className="font-medium text-foreground">軸選定の根拠: </span>
                    {targetFitMapData.axis_rationale}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 3: ペルソナ */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <div>
              <h2 className="text-xs font-bold mb-3">ペルソナ</h2>
              <p className="text-xs text-muted-foreground mb-4">
                ターゲット顧客のペルソナを設定します（最大5件）
              </p>

              {personas.map((persona, index) => (
                <div key={index} className="border border-border rounded-lg p-4 mb-3 bg-background">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[13px] font-bold text-muted-foreground">
                      ペルソナ {index + 1}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removePersona(index)}
                      className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>

                  <div className="mb-5">
                    <h2 className="text-xs font-bold mb-3">顔アイコン</h2>
                    <div className="relative w-fit">
                      <button
                        type="button"
                        onClick={() => setOpenAvatarIdx(openAvatarIdx === index ? null : index)}
                        title="顔アイコンを変更"
                        className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 transition hover:ring-2 hover:ring-ds-app-accent/40"
                      >
                        {persona.avatar_emoji
                          ? <span className="text-3xl leading-none" role="img" aria-label="顔アイコン">{persona.avatar_emoji}</span>
                          : <UserCircle className="h-10 w-10 text-gray-400" />}
                      </button>
                      {openAvatarIdx === index && (
                        <div className="absolute left-0 top-14 z-20 w-56 rounded-lg border border-border bg-white p-2 shadow-lg">
                          <div className="grid grid-cols-6 gap-1">
                            {AVATAR_EMOJIS.map(em => (
                              <button
                                key={em}
                                type="button"
                                onClick={() => { updatePersona(index, 'avatar_emoji', persona.avatar_emoji === em ? '' : em); setOpenAvatarIdx(null) }}
                                className={`flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-muted ${persona.avatar_emoji === em ? 'bg-ds-app-accent/5 ring-1 ring-ds-app-accent' : ''}`}
                              >
                                {em}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mb-5">
                    <h2 className="text-xs font-bold mb-3">ペルソナ名称</h2>
                    <Input
                      type="text"
                      value={persona.name}
                      onChange={(e) => updatePersona(index, 'name', e.target.value)}
                      placeholder="例: 情報感度の高いマーケター"
                      className="h-10"
                    />
                  </div>

                  <div className="flex gap-3">
                    <div className="mb-5 flex-1">
                      <h2 className="text-xs font-bold mb-3">年齢層</h2>
                      <Input
                        type="text"
                        value={persona.age_range}
                        onChange={(e) => updatePersona(index, 'age_range', e.target.value)}
                        placeholder="例: 30-40代"
                        className="h-10"
                      />
                    </div>
                    <div className="mb-5 flex-1">
                      <h2 className="text-xs font-bold mb-3">職業</h2>
                      <Input
                        type="text"
                        value={persona.occupation}
                        onChange={(e) => updatePersona(index, 'occupation', e.target.value)}
                        placeholder="例: マーケティング担当者"
                        className="h-10"
                      />
                    </div>
                  </div>

                  <div className="mb-5">
                    <h2 className="text-xs font-bold mb-3">説明</h2>
                    <AutoResizeTextarea
                      value={persona.description}
                      onChange={(e) => updatePersona(index, 'description', e.target.value)}
                      placeholder="このペルソナの背景や特徴"
                      className="min-h-[80px]"
                    />
                  </div>

                  <div className="mb-5">
                    <h2 className="text-xs font-bold mb-3">ニーズ</h2>
                    {persona.needs.map((need, needIndex) => (
                      <div key={needIndex} className="flex gap-2 mb-2">
                        <Input
                          type="text"
                          value={need}
                          onChange={(e) => updateNeed(index, needIndex, e.target.value)}
                          placeholder={`ニーズ ${needIndex + 1}`}
                          className="h-10 flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removeNeed(index, needIndex)}
                          className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => addNeed(index)}
                      className="py-1.5 px-3 text-xs"
                    >
                      <Plus size={16} />ニーズを追加
                    </Button>
                  </div>

                  <div>
                    <h2 className="text-xs font-bold mb-3">課題・ペインポイント</h2>
                    {persona.pain_points.map((point, pointIndex) => (
                      <div key={pointIndex} className="flex gap-2 mb-2">
                        <Input
                          type="text"
                          value={point}
                          onChange={(e) => updatePainPoint(index, pointIndex, e.target.value)}
                          placeholder={`課題 ${pointIndex + 1}`}
                          className="h-10 flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removePainPoint(index, pointIndex)}
                          className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => addPainPoint(index)}
                      className="py-1.5 px-3 text-xs"
                    >
                      <Plus size={16} />課題を追加
                    </Button>
                  </div>

                  <div className="mt-5">
                    <h2 className="text-xs font-bold mb-3">意思決定要因</h2>
                    {persona.decision_factors.map((item, itemIndex) => (
                      <div key={itemIndex} className="flex gap-2 mb-2">
                        <Input
                          type="text"
                          value={item}
                          onChange={(e) => updatePersonaListItem(index, 'decision_factors', itemIndex, e.target.value)}
                          placeholder={`意思決定要因 ${itemIndex + 1}`}
                          className="h-10 flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removePersonaListItem(index, 'decision_factors', itemIndex)}
                          className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => addPersonaListItem(index, 'decision_factors')}
                      className="py-1.5 px-3 text-xs"
                    >
                      <Plus size={16} />意思決定要因を追加
                    </Button>
                  </div>

                  <div className="mt-5">
                    <h2 className="text-xs font-bold mb-3">購買障壁</h2>
                    {persona.buying_barriers.map((item, itemIndex) => (
                      <div key={itemIndex} className="flex gap-2 mb-2">
                        <Input
                          type="text"
                          value={item}
                          onChange={(e) => updatePersonaListItem(index, 'buying_barriers', itemIndex, e.target.value)}
                          placeholder={`購買障壁 ${itemIndex + 1}`}
                          className="h-10 flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removePersonaListItem(index, 'buying_barriers', itemIndex)}
                          className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => addPersonaListItem(index, 'buying_barriers')}
                      className="py-1.5 px-3 text-xs"
                    >
                      <Plus size={16} />購買障壁を追加
                    </Button>
                  </div>

                  <div className="mt-5">
                    <h2 className="text-xs font-bold mb-3">ブランドへの期待</h2>
                    <AutoResizeTextarea
                      value={persona.brand_expectations}
                      onChange={(e) => updatePersona(index, 'brand_expectations', e.target.value)}
                      placeholder="このペルソナがブランドに期待する価値"
                      className="min-h-[60px]"
                    />
                  </div>
                </div>
              ))}

              {personas.length < 5 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={addPersona}
                  className="py-2 px-4 text-[13px]"
                >
                  <Plus size={16} />ペルソナを追加
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 2: 自社の立ち位置＋ポジショニングマップ（統合） */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 space-y-8">
            {/* 自社の立ち位置（STP連携・編集可能） */}
            {brandStanceStatements && brandStanceStatements.statements.length > 0 && (
              <div>
              <h2 className="text-xs font-bold mb-3">自社の立ち位置</h2>
              <p className="mb-4 text-[13px] text-muted-foreground">
                各ターゲットに対して、自社が何者として刺さるかをまとめたステートメントです。
              </p>
              <div className="space-y-3">
                {brandStanceStatements.statements.map((s, i) => {
                  const isMain = s.target_role === 'main'
                  return (
                    <div
                      key={i}
                      className={`rounded-lg border-2 p-4 ${
                        isMain ? 'border-ds-app-accent bg-ds-app-accent/5' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="mb-3 flex items-center gap-2">
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isMain ? 'bg-ds-app-accent text-white' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {isMain ? 'メインターゲット向け' : 'サブターゲット向け'}
                        </span>
                        <Input
                          type="text"
                          value={s.target_name}
                          onChange={(e) => updateStanceStatement(i, 'target_name', e.target.value)}
                          placeholder="ターゲット名"
                          className="h-8 flex-1"
                        />
                      </div>
                      <AutoResizeTextarea
                        value={s.statement}
                        onChange={(e) => updateStanceStatement(i, 'statement', e.target.value)}
                        placeholder="このターゲットに対する自社の立ち位置ステートメント"
                        className="min-h-[72px]"
                      />
                      <div className="mt-3">
                        <Label className="text-xs text-muted-foreground mb-1.5 block">なぜなら</Label>
                        <AutoResizeTextarea
                          value={s.rationale}
                          onChange={(e) => updateStanceStatement(i, 'rationale', e.target.value)}
                          placeholder="この立ち位置が成り立つ理由・根拠"
                          className="min-h-[60px]"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              </div>
            )}

            {/* ポジショニングマップ */}
            <div>
            <h2 className="text-xs font-bold mb-3">ポジショニングマップ</h2>

            {positioningMapData ? (
              <div className="space-y-5">
                {/* 軸ラベル設定 */}
                <div className="space-y-3">
                  <h3 className="text-[11px] text-gray-500">軸ラベル</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">X軸 左</Label>
                      <Input
                        type="text"
                        value={positioningMapData.x_axis.left}
                        onChange={(e) => updateXAxis('left', e.target.value)}
                        placeholder="例: 低価格"
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">X軸 右</Label>
                      <Input
                        type="text"
                        value={positioningMapData.x_axis.right}
                        onChange={(e) => updateXAxis('right', e.target.value)}
                        placeholder="例: 高価格"
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Y軸 下</Label>
                      <Input
                        type="text"
                        value={positioningMapData.y_axis.bottom}
                        onChange={(e) => updateYAxis('bottom', e.target.value)}
                        placeholder="例: 機能重視"
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Y軸 上</Label>
                      <Input
                        type="text"
                        value={positioningMapData.y_axis.top}
                        onChange={(e) => updateYAxis('top', e.target.value)}
                        placeholder="例: デザイン重視"
                        className="h-10"
                      />
                    </div>
                  </div>
                </div>

                {/* 軸選定の根拠（軸ラベルの下に表示） */}
                {positioningMapData?.axis_rationale && (
                  <div className="text-xs text-gray-700 leading-relaxed">
                    <span className="font-bold text-gray-900">軸選定の根拠: </span>
                    {positioningMapData.axis_rationale}
                  </div>
                )}

                {/* アイテム一覧 */}
                <div className="space-y-3">
                  <h3 className="text-[11px] text-gray-500">
                    プロット項目（{positioningMapData.items.length}/10）
                  </h3>

                  {positioningMapData.items.map((item, index) => (
                    <div key={index} className="border border-border rounded-lg p-4 bg-background">
                      <div className="flex items-center gap-3 mb-3">
                        <input
                          type="color"
                          value={item.color}
                          onChange={(e) => updateMapItem(index, 'color', e.target.value)}
                          className="w-10 h-10 border border-border rounded-lg cursor-pointer p-0.5"
                        />
                        <Input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateMapItem(index, 'name', e.target.value)}
                          placeholder="名称（例: 自社、競合A）"
                          className="h-10 flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removeMapItem(index)}
                          className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground mb-2 block">
                            X位置: {item.x}
                          </Label>
                          <Slider
                            value={[item.x]}
                            onValueChange={([val]) => updateMapItem(index, 'x', val)}
                            min={0}
                            max={100}
                            step={1}
                            className="w-full"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-2 block">
                            Y位置: {item.y}
                          </Label>
                          <Slider
                            value={[item.y]}
                            onValueChange={([val]) => updateMapItem(index, 'y', val)}
                            min={0}
                            max={100}
                            step={1}
                            className="w-full"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mt-3">
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">サイズ</Label>
                        <div className="flex gap-1.5">
                          {([
                            { value: 'sm' as PositioningMapSize, label: '小' },
                            { value: 'md' as PositioningMapSize, label: '中' },
                            { value: 'lg' as PositioningMapSize, label: '大' },
                            { value: 'custom' as PositioningMapSize, label: 'カスタム' },
                          ]).map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => updateMapItem(index, 'size', opt.value)}
                              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                                item.size === opt.value
                                  ? 'bg-foreground text-background border-foreground'
                                  : 'bg-background text-foreground border-border hover:bg-muted'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        {item.size === 'custom' && (
                          <div className="flex items-center gap-2">
                            <Slider
                              value={[item.customSize || 6]}
                              onValueChange={([val]) => updateMapItem(index, 'customSize', val)}
                              min={2}
                              max={20}
                              step={1}
                              className="w-24"
                            />
                            <span className="text-xs text-muted-foreground w-6">{item.customSize || 6}</span>
                          </div>
                        )}
                      </div>

                      {/* 説明: 自社=自社の強み / 競合=競合の特徴。名称一致で自社判別 */}
                      <div className="mt-3">
                        <Label className="text-xs text-muted-foreground mb-1.5 block">
                          {isSelfItem(item.name) ? '自社の強み' : '競合の特徴'}
                        </Label>
                        <AutoResizeTextarea
                          value={getItemDescription(item.name)}
                          onChange={(e) => updateItemDescription(item.name, e.target.value)}
                          placeholder={isSelfItem(item.name)
                            ? '自社が提供できる強み・価値'
                            : 'この競合の特徴・強み'}
                          className="min-h-[72px]"
                        />
                      </div>
                    </div>
                  ))}

                  {positioningMapData.items.length < 10 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addMapItem}
                      className="py-2 px-4 text-[13px]"
                    >
                      <Plus size={16} />項目を追加
                    </Button>
                  )}
                </div>

                {/* プレビュー */}
                <div>
                  <h3 className="text-[11px] text-gray-500 mb-2">プレビュー</h3>
                  <PositioningMap data={positioningMapData} />
                </div>

                {/* マップ削除 */}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={clearMap}
                  className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ) : (
              <div>
                <p className="text-[13px] text-muted-foreground mb-3">
                  ポジショニングマップを作成してください
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={initializeMap}
                  className="py-2 px-4 text-[13px]"
                >
                  マップを作成
                </Button>
              </div>
            )}
            </div>
          </CardContent>
        </Card>

        {/* 自社の強み・競合分析はポジショニングマップの各プロット項目カード内で編集する（読み取り専用カードは廃止） */}

        {/* Card 3: 提供価値（value_propositions。「考え方」から移動・統合） */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <h2 className="text-xs font-bold mb-3">提供価値</h2>
            <p className="text-xs text-muted-foreground mb-4">
              顧客に提供する価値を設定します（ポータルの「接し方」に表示されます）
            </p>

            {providedValues.map((value, index) => (
              <div key={index} className="border border-border rounded-lg p-4 mb-3 bg-background">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[13px] font-bold text-muted-foreground">
                    提供価値 {index + 1}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeProvidedValue(index)}
                    className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>

                <div className="mb-5">
                  <h2 className="text-xs font-bold mb-3">タイトル</h2>
                  <Input
                    type="text"
                    value={value.title}
                    onChange={(e) => updateProvidedValue(index, 'title', e.target.value)}
                    placeholder="提供価値のタイトル"
                    className="h-10"
                  />
                </div>

                <div>
                  <h2 className="text-xs font-bold mb-3">説明</h2>
                  <AutoResizeTextarea
                    value={value.description}
                    onChange={(e) => updateProvidedValue(index, 'description', e.target.value)}
                    placeholder="この提供価値の詳細説明"
                    className="min-h-[80px]"
                  />
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={addProvidedValue}
              className="py-2 px-4 text-[13px]"
            >
              <Plus size={16} />提供価値を追加
            </Button>
          </CardContent>
        </Card>

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
