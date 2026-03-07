'use client'

// Step 1: 基本情報フォーム（会社名・業種・事業内容・顧客・競合）
import { useState, useCallback, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { IndustrySelect } from '@/components/shared/IndustrySelect'
import { supabase } from '@/lib/supabase'
import { ChevronRight, Plus, Trash2 } from 'lucide-react'

interface Competitor {
  name: string
  url: string
}

interface BusinessDescription {
  title: string
  description: string
}

interface TargetSegment {
  name: string
  description: string
}

interface BasicInfo {
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
}

interface Step1Props {
  basicInfo: BasicInfo
  onNext: (data: BasicInfo) => Promise<boolean>
  onSaveField: (data: BasicInfo) => Promise<void>
}

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

// 旧 competitors テキストを構造化データに変換
function migrateCompetitors(
  competitorsField: string | Competitor[] | undefined
): Competitor[] {
  if (!competitorsField) return []
  if (Array.isArray(competitorsField)) return competitorsField
  if (typeof competitorsField === 'string' && competitorsField.trim()) {
    return competitorsField
      .split(/[、,\n]/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(name => ({ name, url: '' }))
  }
  return []
}

// 旧 current_customers テキストを構造化データに変換
function migrateTargetSegments(
  basicInfo: BasicInfo
): TargetSegment[] {
  // 新形式があればそのまま
  if (basicInfo.target_segments?.length > 0) {
    return basicInfo.target_segments
  }
  // 旧形式（current_customersテキスト）があれば変換
  if (basicInfo.current_customers && basicInfo.current_customers.trim()) {
    return [{ name: 'ターゲット', description: basicInfo.current_customers.trim() }]
  }
  return []
}

// 旧 products テキストを構造化データに変換
function migrateProducts(
  basicInfo: BasicInfo
): BusinessDescription[] {
  // 新形式があればそのまま
  if (basicInfo.business_descriptions?.length > 0) {
    return basicInfo.business_descriptions
  }
  // 旧形式（productsテキスト）があれば変換
  if (basicInfo.products && basicInfo.products.trim()) {
    return [{ title: basicInfo.products.trim(), description: '' }]
  }
  return []
}

export function Step1BasicInfo({ basicInfo, onNext, onSaveField }: Step1Props) {
  // 旧 industry フィールドのマイグレーション
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
  const [showPrefilledBanner, setShowPrefilledBanner] = useState(false)

  // デバウンス用タイマー
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // プリフィル: 初回表示時に本体 or 過去セッションからデータを読み込み
  useEffect(() => {
    // 既にフォームにデータがある場合はスキップ
    if (basicInfo.company_name || basicInfo.industry_category || basicInfo.industry) return

    const fetchProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const res = await fetch(`/api/tools/shared-profile?userId=${user.id}`)
        if (!res.ok) return

        const result = await res.json()
        if (result.source === 'none' || !result.data) return

        const d = result.data
        let changed = false
        if (d.brand_name && !companyName) {
          setCompanyName(d.brand_name)
          changed = true
        }
        if (d.industry_category && !industryCategory) {
          setIndustryCategory(d.industry_category)
          changed = true
        }
        if (d.industry_subcategory && !industrySubcategory) {
          setIndustrySubcategory(d.industry_subcategory)
          changed = true
        }
        if (d.business_descriptions?.length > 0 && businessDescriptions.length === 0) {
          setBusinessDescriptions(d.business_descriptions)
          changed = true
        }
        if (d.target_segments?.length > 0 && targetSegments.length === 0) {
          setTargetSegments(d.target_segments)
          changed = true
        }
        if (d.competitors?.length > 0 && competitors.length === 0) {
          setCompetitors(d.competitors)
          changed = true
        }

        if (changed) {
          setShowPrefilledBanner(true)
        }
      } catch {
        // プリフィル失敗は無視
      }
    }

    fetchProfile()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // プリフィルバナーの5秒後フェードアウト
  useEffect(() => {
    if (!showPrefilledBanner) return
    const timer = setTimeout(() => setShowPrefilledBanner(false), 5000)
    return () => clearTimeout(timer)
  }, [showPrefilledBanner])

  // 現在のフォームデータを取得
  const getCurrentData = useCallback((): BasicInfo => ({
    company_name: companyName.trim(),
    industry_category: industryCategory,
    industry_subcategory: industrySubcategory,
    business_descriptions: businessDescriptions.filter(b => b.title.trim()),
    target_segments: targetSegments.filter(ts => ts.name.trim()),
    competitors: competitors.filter(c => c.name.trim()),
  }), [companyName, industryCategory, industrySubcategory, businessDescriptions, targetSegments, competitors])

  // 1秒デバウンスのオートセーブ
  const triggerAutoSave = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      onSaveField(getCurrentData())
    }, 1000)
  }, [getCurrentData, onSaveField])

  // フォーム値が変わるたびにオートセーブをトリガー
  useEffect(() => {
    const hasData = companyName || industryCategory || businessDescriptions.length > 0 || targetSegments.length > 0 || competitors.length > 0
    if (hasData) {
      triggerAutoSave()
    }
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyName, industryCategory, industrySubcategory, businessDescriptions, targetSegments, competitors])

  // バリデーション
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!companyName.trim()) {
      newErrors.companyName = '企業名・ブランド名を入力してください'
    }

    if (!industryCategory) {
      newErrors.industryCategory = '業種（大分類）を選択してください'
    }

    if (!industrySubcategory) {
      newErrors.industrySubcategory = '業種（中分類）を選択してください'
    }

    const validDescriptions = businessDescriptions.filter(b => b.title.trim())
    if (validDescriptions.length === 0) {
      newErrors.businessDescriptions = '事業内容を1つ以上入力してください'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = async () => {
    if (!validate()) return

    setSaving(true)
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    const data = getCurrentData()
    const success = await onNext(data)
    if (!success) setSaving(false)
  }

  // 事業内容操作
  const addBusinessDescription = () => {
    setBusinessDescriptions([...businessDescriptions, { title: '', description: '' }])
  }

  const removeBusinessDescription = (index: number) => {
    setBusinessDescriptions(businessDescriptions.filter((_, i) => i !== index))
  }

  const updateBusinessDescription = (index: number, field: 'title' | 'description', value: string) => {
    const updated = [...businessDescriptions]
    updated[index] = { ...updated[index], [field]: value }
    setBusinessDescriptions(updated)
  }

  // ターゲットセグメント操作
  const addTargetSegment = () => {
    if (targetSegments.length >= 10) return
    setTargetSegments([...targetSegments, { name: '', description: '' }])
  }

  const removeTargetSegment = (index: number) => {
    setTargetSegments(targetSegments.filter((_, i) => i !== index))
  }

  const updateTargetSegment = (index: number, field: 'name' | 'description', value: string) => {
    const updated = [...targetSegments]
    updated[index] = { ...updated[index], [field]: value }
    setTargetSegments(updated)
  }

  // 競合企業操作
  const addCompetitor = () => {
    if (competitors.length >= 10) return
    setCompetitors([...competitors, { name: '', url: '' }])
  }

  const removeCompetitor = (index: number) => {
    setCompetitors(competitors.filter((_, i) => i !== index))
  }

  const updateCompetitor = (index: number, field: 'name' | 'url', value: string) => {
    const updated = [...competitors]
    updated[index] = { ...updated[index], [field]: value }
    setCompetitors(updated)
  }

  // 必須フィールドが埋まっているかチェック（次へボタンの活性化用）
  const isValid =
    companyName.trim() !== '' &&
    industryCategory !== '' &&
    industrySubcategory !== '' &&
    businessDescriptions.some(b => b.title.trim() !== '')

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-gray-900">基本情報</h2>
        <p className="mt-1 text-sm text-gray-500">
          STP分析の対象となる事業の基本情報を入力してください
        </p>
      </div>

      {/* プリフィルバナー */}
      {showPrefilledBanner && (
        <div
          className="rounded-md bg-blue-50 px-4 py-2 text-sm text-blue-600 transition-opacity duration-500"
          style={{ opacity: showPrefilledBanner ? 1 : 0 }}
        >
          branding.bz のデータを読み込みました
        </div>
      )}

      {/* 企業名・ブランド名 */}
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <label className="text-sm font-bold text-gray-700">企業名・ブランド名</label>
          <span className="text-xs text-red-500">*</span>
        </div>
        <Input
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="例: 株式会社○○ / ブランド名"
          maxLength={100}
          className={errors.companyName ? 'border-red-400' : ''}
        />
        {errors.companyName && (
          <p className="mt-1 text-xs text-red-500">{errors.companyName}</p>
        )}
      </div>

      {/* 業種 */}
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <label className="text-sm font-bold text-gray-700">業種</label>
          <span className="text-xs text-red-500">*</span>
        </div>
        <IndustrySelect
          category={industryCategory}
          subcategory={industrySubcategory}
          onCategoryChange={(val) => {
            setIndustryCategory(val)
            setIndustrySubcategory('')
          }}
          onSubcategoryChange={(val) => {
            setIndustrySubcategory(val)
          }}
        />
        {(errors.industryCategory || errors.industrySubcategory) && (
          <p className="mt-1 text-xs text-red-500">
            {errors.industryCategory || errors.industrySubcategory}
          </p>
        )}
      </div>

      {/* 事業内容（構造化入力） */}
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <label className="text-sm font-bold text-gray-700">事業内容</label>
          <span className="text-xs text-red-500">*</span>
        </div>

        <div className="space-y-2">
          {businessDescriptions.map((item, i) => (
            <div key={i} className="rounded-lg border bg-white p-3">
              <div className="mb-2 flex items-center gap-2">
                <Input
                  value={item.title}
                  onChange={(e) => updateBusinessDescription(i, 'title', e.target.value)}
                  placeholder="事業タイトル"
                  className="h-10 flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeBusinessDescription(i)}
                  className="shrink-0 rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <Textarea
                value={item.description}
                onChange={(e) => updateBusinessDescription(i, 'description', e.target.value)}
                placeholder="事業の説明"
                className="min-h-[60px] resize-none"
                rows={2}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement
                  target.style.height = 'auto'
                  target.style.height = target.scrollHeight + 'px'
                }}
              />
            </div>
          ))}

          <button
            type="button"
            onClick={addBusinessDescription}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
          >
            <Plus className="h-3.5 w-3.5" />
            事業内容を追加
          </button>
        </div>

        {errors.businessDescriptions && (
          <p className="mt-1 text-xs text-red-500">{errors.businessDescriptions}</p>
        )}
      </div>

      {/* ターゲット顧客層（構造化入力） */}
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <label className="text-sm font-bold text-gray-700">ターゲット顧客層</label>
          <span className="text-xs text-gray-400">（任意）</span>
        </div>

        <div className="space-y-2">
          {targetSegments.map((ts, i) => (
            <div key={i} className="rounded-lg border bg-white p-3">
              <div className="mb-2 flex items-center gap-2">
                <Input
                  value={ts.name}
                  onChange={(e) => updateTargetSegment(i, 'name', e.target.value)}
                  placeholder="セグメント名（例: 中小企業の経営者）"
                  className="h-10 flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeTargetSegment(i)}
                  className="shrink-0 rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <Textarea
                value={ts.description}
                onChange={(e) => updateTargetSegment(i, 'description', e.target.value)}
                placeholder="セグメントの説明"
                className="min-h-[60px] resize-none"
                rows={2}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement
                  target.style.height = 'auto'
                  target.style.height = target.scrollHeight + 'px'
                }}
              />
            </div>
          ))}

          {targetSegments.length < 10 && (
            <button
              type="button"
              onClick={addTargetSegment}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              ターゲットを追加
            </button>
          )}
        </div>
      </div>

      {/* 競合企業 */}
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <label className="text-sm font-bold text-gray-700">競合企業</label>
          <span className="text-xs text-gray-400">（任意）</span>
        </div>

        <div className="space-y-3">
          {competitors.map((comp, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border bg-white p-3">
              <Input
                value={comp.name}
                onChange={(e) => updateCompetitor(i, 'name', e.target.value)}
                placeholder="企業名"
                className="h-8 max-w-[160px] text-sm"
              />
              <Input
                value={comp.url}
                onChange={(e) => updateCompetitor(i, 'url', e.target.value)}
                placeholder="https://..."
                className="h-8 flex-1 text-sm"
              />
              <button
                type="button"
                onClick={() => removeCompetitor(i)}
                className="shrink-0 text-gray-400 hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          {competitors.length < 10 && (
            <button
              type="button"
              onClick={addCompetitor}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              競合企業を追加（最大10社）
            </button>
          )}
        </div>
      </div>

      {/* フッターナビゲーション */}
      <div className="flex items-center justify-between border-t pt-6">
        <div />

        <Button
          onClick={handleNext}
          disabled={saving || !isValid}
          className="gap-1"
        >
          {saving ? '保存中...' : '次へ：セグメンテーション'}
          {!saving && <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
