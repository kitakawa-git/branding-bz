'use client'

// 各構築ツール（STP / ペルソナ / カラー定義 等）で共通利用する Step1 基本情報フォーム。
// 企業名・業種・事業内容・現状の顧客層（AI提案）＋（任意で）競合企業（AI提案）を扱う。
// プリフィル（本体companies）・オートセーブ・companies同期を内包。
// 競合の有無・次へボタン文言・顧客層の説明文は props で切り替える。
import { useState, useCallback, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { IndustrySelect } from '@/components/shared/IndustrySelect'
import { TitleDescriptionList } from '@/components/shared/TitleDescriptionList'
import { FieldHeading } from '@/components/shared/FieldHeading'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { ArrowRight, Plus, Trash2, Loader2, ExternalLink, Check } from 'lucide-react'
import { AIButton } from '@/components/shared/AIButton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { COMPETITOR_SUGGEST_MONTHLY_LIMIT } from '@/lib/constants/ai-limits'
import { TargetSuggestDialog, type TargetSuggestion } from '@/components/brand/TargetSuggestDialog'

export interface Competitor {
  name: string
  url: string
  notes?: string
}

interface SuggestedCompetitor {
  name: string
  url: string
  reason: string
}

interface BusinessDescription {
  title: string
  description: string
}

interface TargetSegment {
  name: string
  description: string
}

// 共通の基本情報型（competitors は常に持つ＝[] でも可）
export interface ToolBasicInfo {
  company_name: string
  industry_category: string
  industry_subcategory: string
  business_descriptions: BusinessDescription[]
  target_segments: TargetSegment[]
  competitors: Competitor[]
  // 旧フィールド（後方互換）
  industry?: string
  industry_other?: string
  products?: string
  current_customers?: string
  target_description?: string
}

interface ToolStep1Props {
  basicInfo: Partial<ToolBasicInfo>
  onNext: (data: ToolBasicInfo) => Promise<boolean>
  onSaveField: (data: ToolBasicInfo) => Promise<void>
  /** 次へボタンの文言（例: 「セグメンテーションへ」「ペルソナ生成へ」） */
  nextLabel: string
  /** 競合企業・サービス欄を表示するか（既定: true）。false のツールは competitors を companies へ書かない。 */
  showCompetitors?: boolean
  /** 顧客層欄の見出し（ツールにより変えられる。既定: 「現状の顧客層」） */
  targetLabel?: string
  /** 顧客層欄の説明文（ツールにより文言を変えられる） */
  targetLead?: string
}

const DEFAULT_TARGET_LEAD =
  '現在ビジネスをしている顧客像を入力してください。これは分析の出発点であり、最終ターゲットではありません（最終ターゲットは Step 3 で決めます）。'

// 旧 industry ラベルから新 industry_category への移行マッピング
const LEGACY_INDUSTRY_MAP: Record<string, { category: string; subcategory: string }> = {
  '製造業': { category: 'manufacturing', subcategory: 'その他' },
  '情報通信業': { category: 'it_tech', subcategory: 'その他' },
  '小売・卸売業': { category: 'retail_wholesale', subcategory: 'その他' },
  'サービス業': { category: 'service', subcategory: 'その他' },
  '建設・不動産業': { category: 'construction_realestate', subcategory: 'その他' },
  '飲食業': { category: 'food_beverage', subcategory: 'その他' },
  '医療・福祉': { category: 'medical_welfare', subcategory: 'その他' },
  '教育・学習支援': { category: 'education', subcategory: 'その他' },
  '金融・保険業': { category: 'finance_insurance', subcategory: 'その他' },
  '運輸・物流業': { category: 'other', subcategory: '' },
}

function migrateCompetitors(competitorsField: string | Competitor[] | undefined): Competitor[] {
  if (!competitorsField) return []
  if (Array.isArray(competitorsField)) return competitorsField
  if (typeof competitorsField === 'string' && competitorsField.trim()) {
    return competitorsField
      .split(/[、,\n]/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(name => ({ name, url: '', notes: '' }))
  }
  return []
}

// 旧 current_customers / target_description テキストを構造化データに変換
function migrateTargetSegments(basicInfo: Partial<ToolBasicInfo>): TargetSegment[] {
  if (basicInfo.target_segments && basicInfo.target_segments.length > 0) {
    return basicInfo.target_segments
  }
  if (basicInfo.current_customers && basicInfo.current_customers.trim()) {
    return [{ name: 'ターゲット', description: basicInfo.current_customers.trim() }]
  }
  if (basicInfo.target_description && basicInfo.target_description.trim()) {
    return [{ name: basicInfo.target_description.trim(), description: '' }]
  }
  return []
}

function migrateProducts(basicInfo: Partial<ToolBasicInfo>): BusinessDescription[] {
  if (basicInfo.business_descriptions && basicInfo.business_descriptions.length > 0) {
    return basicInfo.business_descriptions
  }
  if (basicInfo.products && basicInfo.products.trim()) {
    return [{ title: basicInfo.products.trim(), description: '' }]
  }
  return []
}

export function ToolStep1BasicInfo({
  basicInfo,
  onNext,
  onSaveField,
  nextLabel,
  showCompetitors = true,
  targetLabel = '現状の顧客層',
  targetLead = DEFAULT_TARGET_LEAD,
}: ToolStep1Props) {
  const migratedIndustry = basicInfo.industry
    ? LEGACY_INDUSTRY_MAP[basicInfo.industry] || null
    : null

  const [companyName, setCompanyName] = useState(basicInfo.company_name || '')
  const [industryCategory, setIndustryCategory] = useState(
    basicInfo.industry_category || migratedIndustry?.category || ''
  )
  const [industrySubcategory, setIndustrySubcategory] = useState(
    basicInfo.industry_subcategory || migratedIndustry?.subcategory || ''
  )
  const [businessDescriptions, setBusinessDescriptions] = useState<BusinessDescription[]>(
    migrateProducts(basicInfo)
  )
  const [targetSegments, setTargetSegments] = useState<TargetSegment[]>(
    migrateTargetSegments(basicInfo)
  )
  const [competitors, setCompetitors] = useState<Competitor[]>(
    migrateCompetitors(basicInfo.competitors)
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // AI競合提案
  const [suggesting, setSuggesting] = useState(false)
  const [suggestRemaining, setSuggestRemaining] = useState<number | null>(null)
  const [suggestResetsAt, setSuggestResetsAt] = useState<string | null>(null)
  const [suggestDialogOpen, setSuggestDialogOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<SuggestedCompetitor[]>([])
  const [selectedIdx, setSelectedIdx] = useState<Set<number>>(new Set())
  const [suggestUnlimited, setSuggestUnlimited] = useState(false)
  const [competitorToDelete, setCompetitorToDelete] = useState<number | null>(null)

  // AIターゲット提案
  const [targetSuggesting, setTargetSuggesting] = useState(false)
  const [targetRemaining, setTargetRemaining] = useState<number | null>(null)
  const [, setTargetResetsAt] = useState<string | null>(null)
  const [targetSuggestOpen, setTargetSuggestOpen] = useState(false)
  const [targetSuggestions, setTargetSuggestions] = useState<TargetSuggestion[]>([])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const userIdRef = useRef<string | null>(null)

  // プリフィル: 本体(companies)の最新データを取得
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const res = await fetch(`/api/tools/shared-profile?userId=${user.id}`)
        if (!res.ok) return

        const result = await res.json()
        if (result.source === 'none' || !result.data) return

        const d = result.data
        const isCompany = result.source === 'company'
        const updates: Partial<ToolBasicInfo> = {}

        if (d.brand_name && (isCompany || !companyName)) {
          setCompanyName(d.brand_name)
          updates.company_name = d.brand_name
        }
        if (d.industry_category && (isCompany || !industryCategory)) {
          setIndustryCategory(d.industry_category)
          updates.industry_category = d.industry_category
          if (isCompany || !industrySubcategory) {
            setIndustrySubcategory(d.industry_subcategory || '')
            updates.industry_subcategory = d.industry_subcategory || ''
          }
        }
        if (d.industry_subcategory && (isCompany || !industrySubcategory)) {
          setIndustrySubcategory(d.industry_subcategory)
          updates.industry_subcategory = d.industry_subcategory
        }

        if (d.business_descriptions?.length > 0 && (isCompany || businessDescriptions.length === 0)) {
          setBusinessDescriptions(d.business_descriptions)
          updates.business_descriptions = d.business_descriptions
        }
        if (d.target_segments?.length > 0 && (isCompany || targetSegments.length === 0)) {
          setTargetSegments(d.target_segments)
          updates.target_segments = d.target_segments
        }

        // 競合: 表示するツールのみ取り込む（非表示ツールでは扱わない）
        if (showCompetitors && d.competitors?.length > 0 && (isCompany || competitors.length === 0)) {
          const comps = (d.competitors as Array<{ name: string; url: string; notes: string }>)
            .filter((c: { name: string }) => c.name?.trim())
            .map((c: { name: string; url: string; notes: string }) => ({
              name: c.name.trim(), url: c.url || '', notes: c.notes || '',
            }))
          setCompetitors(comps)
          updates.competitors = comps
        }

        if (Object.keys(updates).length > 0) {
          onSaveField(updates as ToolBasicInfo)
        }
      } catch {
        // プリフィル失敗は無視
      }
    }

    fetchProfile()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      userIdRef.current = user?.id || null
    })
  }, [])

  // AI競合提案の今月残り回数（競合表示ツールのみ）
  useEffect(() => {
    if (!showCompetitors) return
    let cancelled = false
    fetch('/api/tools/stp/suggest-competitors')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data) return
        if (typeof data.remaining === 'number') setSuggestRemaining(data.remaining)
        if (data.resetsAt) setSuggestResetsAt(data.resetsAt)
        setSuggestUnlimited(data.unlimited === true)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [showCompetitors])

  // AIターゲット提案の今月残り回数（共用エンドポイント）
  useEffect(() => {
    let cancelled = false
    fetch('/api/tools/stp/suggest-targets')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data) return
        if (typeof data.remaining === 'number') setTargetRemaining(data.remaining)
        if (data.resetsAt) setTargetResetsAt(data.resetsAt)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const getCurrentData = useCallback((): ToolBasicInfo => ({
    company_name: companyName.trim(),
    industry_category: industryCategory,
    industry_subcategory: industrySubcategory,
    business_descriptions: businessDescriptions.filter(b => b.title.trim()),
    target_segments: targetSegments.filter(ts => ts.name.trim()),
    competitors: competitors.filter(c => c.name.trim()),
  }), [companyName, industryCategory, industrySubcategory, businessDescriptions, targetSegments, competitors])

  // 本体（companies）へリアルタイム同期（fire and forget）
  const syncToCompany = useCallback((data: ToolBasicInfo) => {
    const userId = userIdRef.current
    if (!userId) return
    // 競合非表示ツールは competitors を送らない（companies.competitors を空で潰さないため）
    const body: Record<string, unknown> = {
      userId,
      company_name: data.company_name,
      industry_category: data.industry_category,
      industry_subcategory: data.industry_subcategory,
      business_descriptions: data.business_descriptions,
      target_segments: data.target_segments,
    }
    if (showCompetitors) body.competitors = data.competitors
    fetch('/api/tools/shared-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {})
  }, [showCompetitors])

  const triggerAutoSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const data = getCurrentData()
      onSaveField(data)
      syncToCompany(data)
    }, 1000)
  }, [getCurrentData, onSaveField, syncToCompany])

  useEffect(() => {
    const hasData = companyName || industryCategory || businessDescriptions.length > 0 || targetSegments.length > 0 || competitors.length > 0
    if (hasData) triggerAutoSave()
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyName, industryCategory, industrySubcategory, businessDescriptions, targetSegments, competitors])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!companyName.trim()) newErrors.companyName = '企業名またはブランド名を入力してください'
    if (!industryCategory) newErrors.industryCategory = '業種（大分類）を選択してください'
    if (!industrySubcategory) newErrors.industrySubcategory = '業種（中分類）を選択してください'
    const validDescriptions = businessDescriptions.filter(b => b.title.trim())
    if (validDescriptions.length === 0) newErrors.businessDescriptions = '事業内容を1つ以上入力してください'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = async () => {
    if (!validate()) return
    setSaving(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const data = getCurrentData()
    syncToCompany(data)
    const success = await onNext(data)
    if (!success) setSaving(false)
  }

  // 競合企業操作（最大5社）
  const MAX_COMPETITORS = 5
  const addCompetitor = () => {
    if (competitors.length >= MAX_COMPETITORS) return
    setCompetitors([...competitors, { name: '', url: '', notes: '' }])
  }
  const removeCompetitor = (index: number) => {
    setCompetitors(competitors.filter((_, i) => i !== index))
  }
  const updateCompetitor = (index: number, field: 'name' | 'url' | 'notes', value: string) => {
    const updated = [...competitors]
    updated[index] = { ...updated[index], [field]: value }
    setCompetitors(updated)
  }

  const normName = (s: string): string => (s || '').trim().toLowerCase()
  const normHost = (u: string): string => {
    let h = (u || '').trim().toLowerCase()
    if (!h) return ''
    h = h.replace(/^https?:\/\//, '').replace(/^www\./, '')
    h = h.split(/[/?#]/)[0]
    return h.replace(/\/$/, '')
  }

  const formatResetDate = (iso: string | null): string => {
    if (!iso) return ''
    const jst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000)
    return `${jst.getUTCMonth() + 1}月${jst.getUTCDate()}日`
  }

  const handleSuggestCompetitors = async () => {
    if (suggesting) return
    if (!suggestUnlimited && suggestRemaining !== null && suggestRemaining <= 0) {
      toast.error('今月の利用上限に達しました')
      return
    }
    setSuggesting(true)
    try {
      const res = await fetch('/api/tools/stp/suggest-competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ basic_info: getCurrentData() }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.status === 429) {
        setSuggestRemaining(0)
        if (data.resetsAt) setSuggestResetsAt(data.resetsAt)
        toast.error('今月の利用上限に達しました')
        return
      }
      if (!res.ok) {
        toast.error('競合の提案に失敗しました。時間をおいて再度お試しください')
        return
      }

      if (typeof data.remaining === 'number') setSuggestRemaining(data.remaining)
      if (data.resetsAt) setSuggestResetsAt(data.resetsAt)
      setSuggestUnlimited(data.unlimited === true)

      const list: SuggestedCompetitor[] = Array.isArray(data.suggestions) ? data.suggestions : []
      if (list.length === 0) {
        toast.info('新たな競合候補は見つかりませんでした')
        return
      }
      setSuggestions(list)
      setSelectedIdx(new Set(list.map((_, i) => i)))
      setSuggestDialogOpen(true)
    } catch (err) {
      console.error('[Tool] AI競合提案エラー:', err)
      toast.error('競合の提案に失敗しました。時間をおいて再度お試しください')
    } finally {
      setSuggesting(false)
    }
  }

  const toggleSuggestion = (index: number) => {
    setSelectedIdx(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const toggleAllSuggestions = () => {
    setSelectedIdx(prev =>
      prev.size === suggestions.length ? new Set() : new Set(suggestions.map((_, i) => i)),
    )
  }

  const addSelectedSuggestions = () => {
    const existingNames = new Set(competitors.map(c => normName(c.name)).filter(Boolean))
    const existingHosts = new Set(competitors.map(c => normHost(c.url)).filter(Boolean))

    const toAdd: Competitor[] = []
    let skipped = 0
    let capped = 0

    suggestions.forEach((s, i) => {
      if (!selectedIdx.has(i)) return
      const n = normName(s.name)
      const h = normHost(s.url)
      if (existingNames.has(n) || (h && existingHosts.has(h))) {
        skipped++
        return
      }
      if (competitors.length + toAdd.length >= MAX_COMPETITORS) {
        capped++
        return
      }
      existingNames.add(n)
      if (h) existingHosts.add(h)
      toAdd.push({ name: s.name, url: s.url, notes: s.reason })
    })

    if (toAdd.length > 0) setCompetitors([...competitors, ...toAdd])
    setSuggestDialogOpen(false)

    const parts: string[] = []
    if (toAdd.length > 0) parts.push(`${toAdd.length}社を追加しました`)
    if (skipped > 0) parts.push(`重複${skipped}社をスキップ`)
    if (capped > 0) parts.push(`上限(${MAX_COMPETITORS}社)超過${capped}社をスキップ`)
    const msg = parts.length > 0 ? parts.join('・') : '追加対象がありませんでした'
    if (toAdd.length > 0) toast.success(msg)
    else toast.info(msg)
  }

  const handleSuggestTargets = async () => {
    if (targetSuggesting) return
    if (targetRemaining !== null && targetRemaining <= 0) {
      toast.error('今月の利用上限に達しました')
      return
    }
    setTargetSuggesting(true)
    try {
      const res = await fetch('/api/tools/stp/suggest-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ basic_info: getCurrentData() }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.status === 429) {
        setTargetRemaining(0)
        if (data.resetsAt) setTargetResetsAt(data.resetsAt)
        toast.error('今月の利用上限に達しました')
        return
      }
      if (!res.ok) {
        toast.error('顧客層の提案に失敗しました。時間をおいて再度お試しください')
        return
      }

      if (typeof data.remaining === 'number') setTargetRemaining(data.remaining)
      if (data.resetsAt) setTargetResetsAt(data.resetsAt)

      const list: TargetSuggestion[] = Array.isArray(data.suggestions) ? data.suggestions : []
      if (list.length === 0) {
        toast.info('新たな顧客層候補は見つかりませんでした')
        return
      }
      setTargetSuggestions(list)
      setTargetSuggestOpen(true)
    } catch (err) {
      console.error('[Tool] AIターゲット提案エラー:', err)
      toast.error('ターゲットの提案に失敗しました。時間をおいて再度お試しください')
    } finally {
      setTargetSuggesting(false)
    }
  }

  const TARGET_MAX = 10
  const addSelectedTargets = (selected: TargetSuggestion[]) => {
    const existingNames = new Set(targetSegments.map(t => normName(t.name)).filter(Boolean))
    const toAdd: TargetSegment[] = []
    let skipped = 0
    let capped = 0
    selected.forEach(s => {
      const n = normName(s.name)
      if (!s.name.trim() || existingNames.has(n)) {
        skipped++
        return
      }
      if (targetSegments.length + toAdd.length >= TARGET_MAX) {
        capped++
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
    if (capped > 0) parts.push(`上限(${TARGET_MAX}件)超過${capped}件をスキップ`)
    const msg = parts.length > 0 ? parts.join('・') : '追加対象がありませんでした'
    if (toAdd.length > 0) toast.success(msg)
    else toast.info(msg)
  }

  const isValid =
    companyName.trim() !== '' &&
    industryCategory !== '' &&
    industrySubcategory !== '' &&
    businessDescriptions.some(b => b.title.trim() !== '')

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Step 1: 基本情報</h1>
      <p className="mb-4 text-[13px] text-muted-foreground">企業名・サービス名・個人名など、ブランディングの対象となる名称を入力してください。</p>

      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">
          {/* 企業名またはブランド名 */}
          <div className="mb-5">
            <FieldHeading required className="mb-3 mt-0">企業名またはブランド名</FieldHeading>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="例: 株式会社○○ / ブランド名"
              maxLength={100}
              className={`h-10 ${errors.companyName ? 'border-red-400' : ''}`}
            />
            {errors.companyName && <p className="mt-1 text-xs text-red-500">{errors.companyName}</p>}
          </div>

          {/* 業種 */}
          <div className="mb-5">
            <FieldHeading required className="mb-3">業種</FieldHeading>
            <IndustrySelect
              category={industryCategory}
              subcategory={industrySubcategory}
              onCategoryChange={(val) => { setIndustryCategory(val); setIndustrySubcategory('') }}
              onSubcategoryChange={(val) => { setIndustrySubcategory(val) }}
            />
            {(errors.industryCategory || errors.industrySubcategory) && (
              <p className="mt-1 text-xs text-red-500">
                {errors.industryCategory || errors.industrySubcategory}
              </p>
            )}
          </div>

          {/* 事業内容（構造化入力） */}
          <div className="mb-5">
            <FieldHeading required className="mb-3">事業内容</FieldHeading>
            <TitleDescriptionList
              label=""
              items={businessDescriptions}
              onChange={setBusinessDescriptions}
              addButtonLabel="事業内容を追加"
              titlePlaceholder="事業タイトル"
              descriptionPlaceholder="事業の説明"
              error={errors.businessDescriptions}
            />
          </div>

          {/* 現状の顧客層（構造化入力＋AI提案） */}
          <div className="mt-7 mb-5">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <FieldHeading optional className="mb-0 mt-0">{targetLabel}</FieldHeading>
              <AIButton
                type="button"
                size="sm"
                onClick={handleSuggestTargets}
                disabled={targetSuggesting || targetRemaining === 0}
                className="shrink-0"
                icon={targetSuggesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}
              >
                {targetSuggesting ? '提案中…' : 'AIで顧客層を提案'}
              </AIButton>
            </div>
            <p className="text-[13px] text-muted-foreground mb-1">{targetLead}</p>
            <TitleDescriptionList
              label=""
              items={targetSegments.map(ts => ({ title: ts.name, description: ts.description }))}
              onChange={(newItems) => {
                setTargetSegments(newItems.map(item => ({ name: item.title, description: item.description })))
              }}
              addButtonLabel="顧客層を追加"
              titlePlaceholder="顧客層の名称（例: 中堅医療機器商社）"
              descriptionPlaceholder="顧客像の説明"
            />
          </div>

          {/* 競合企業・サービス（表示ツールのみ） */}
          {showCompetitors && (
            <div className="mt-7 mb-5">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <FieldHeading optional className="mb-0 mt-0">競合企業・サービス</FieldHeading>
                <AIButton
                  type="button"
                  size="sm"
                  onClick={handleSuggestCompetitors}
                  disabled={suggesting || (!suggestUnlimited && suggestRemaining === 0)}
                  className="shrink-0"
                  icon={suggesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}
                >
                  {suggesting ? '提案中…' : 'AIで競合を提案'}
                </AIButton>
              </div>
              <p className="text-[13px] text-muted-foreground mb-1">
                Step 4のポジショニングマップに競合を配置します。企業名に加えてURLやメモを入力すると、AIの分析精度が向上します。
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                {suggestUnlimited
                  ? 'AIによる提案（テストモード・無制限）'
                  : suggestRemaining === 0
                    ? `AI提案は今月の利用上限に達しました（${formatResetDate(suggestResetsAt)}にリセット）`
                    : suggestRemaining !== null
                      ? `AIによる提案は月${COMPETITOR_SUGGEST_MONTHLY_LIMIT}回まで・今月あと ${suggestRemaining} 回`
                      : `AIによる提案は月${COMPETITOR_SUGGEST_MONTHLY_LIMIT}回まで`}
              </p>
              {competitors.length > 0 && (
                <div className="space-y-3 mb-3">
                  {competitors.map((comp, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white p-3">
                      <div className="flex-1 space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Input
                            value={comp.name}
                            onChange={(e) => updateCompetitor(i, 'name', e.target.value)}
                            placeholder="企業名（必須）"
                            className="h-8 text-sm font-medium"
                          />
                          <Input
                            value={comp.url}
                            onChange={(e) => updateCompetitor(i, 'url', e.target.value)}
                            placeholder="https://..."
                            className="h-8 text-sm"
                          />
                        </div>
                        <Input
                          value={comp.notes || ''}
                          onChange={(e) => updateCompetitor(i, 'notes', e.target.value)}
                          placeholder="例: 大手向けブランディング会社、高額だがリブランドに強い"
                          className="h-8 text-xs text-gray-600"
                          maxLength={200}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setCompetitorToDelete(i)}
                        className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {competitors.length < MAX_COMPETITORS ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCompetitor}
                  className="text-sm"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  競合企業を追加
                </Button>
              ) : (
                <p className="text-xs text-gray-400">最大5社まで</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* フッターナビゲーション */}
      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-4 flex justify-end">
        <Button
          onClick={handleNext}
          disabled={saving || !isValid}
          className="h-14 gap-2 px-6 text-base font-bold"
        >
          {saving ? '保存中...' : nextLabel}
          {!saving && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>

      {/* AI競合提案の候補選択ダイアログ */}
      <Dialog open={suggestDialogOpen} onOpenChange={setSuggestDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>AIによる競合候補</DialogTitle>
            <DialogDescription>
              web検索で見つかった実在の競合候補です。追加するものを選択してください。
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {selectedIdx.size} / {suggestions.length} 件を選択中
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleAllSuggestions}
              className="h-7 text-xs"
            >
              {selectedIdx.size === suggestions.length ? '全解除' : '全選択'}
            </Button>
          </div>

          <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {suggestions.map((s, i) => {
              const selected = selectedIdx.has(i)
              return (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleSuggestion(i)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggleSuggestion(i)
                    }
                  }}
                  className={`flex w-full cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                    selected
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      selected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    {selected && <Check size={12} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-900">{s.name}</div>
                    {s.url && (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 break-all text-xs text-ds-app-accent-hover hover:underline"
                      >
                        {s.url}
                        <ExternalLink size={11} className="shrink-0" />
                      </a>
                    )}
                    {s.reason && <p className="mt-1 text-xs text-gray-600">{s.reason}</p>}
                  </div>
                </div>
              )
            })}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSuggestDialogOpen(false)}>
              キャンセル
            </Button>
            <Button type="button" onClick={addSelectedSuggestions} disabled={selectedIdx.size === 0}>
              選択した競合を追加（{selectedIdx.size}）
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 競合削除の確認ダイアログ */}
      <AlertDialog
        open={competitorToDelete !== null}
        onOpenChange={(open) => { if (!open) setCompetitorToDelete(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>この競合を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {competitorToDelete !== null && competitors[competitorToDelete]?.name
                ? `「${competitors[competitorToDelete].name}」を削除します。`
                : 'この競合を削除します。'}
              この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (competitorToDelete !== null) removeCompetitor(competitorToDelete)
                setCompetitorToDelete(null)
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
