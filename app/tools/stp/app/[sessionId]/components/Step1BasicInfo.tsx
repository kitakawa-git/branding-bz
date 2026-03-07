'use client'

// Step 1: 基本情報フォーム（会社名・業種・事業内容・顧客・競合）
import { useState, useCallback, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { IndustrySelect } from '@/components/shared/IndustrySelect'
import { TitleDescriptionList } from '@/components/shared/TitleDescriptionList'
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

  // デバウンス用タイマー
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // プリフィル: 本体(companies/brand_guidelines)の最新データを取得
  // セッションに古い形式のデータがある場合でも、本体の構造化データで上書きする
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
        // source === 'company': 管理画面（companies）のデータを常に最新として優先
        // source === 'session': 過去セッションのデータは空フィールドのみ補完
        const isCompany = result.source === 'company'

        // スカラー値
        if (d.brand_name && (isCompany || !companyName)) {
          setCompanyName(d.brand_name)
        }
        if (d.industry_category && (isCompany || !industryCategory)) {
          setIndustryCategory(d.industry_category)
          // 大分類が変わったら中分類もリセットしてから適用
          if (isCompany && d.industry_category !== industryCategory) {
            setIndustrySubcategory(d.industry_subcategory || '')
          }
        }
        if (d.industry_subcategory && (isCompany || !industrySubcategory)) {
          setIndustrySubcategory(d.industry_subcategory)
        }

        // 構造化データ: company なら常に上書き、session なら項目数が多い場合のみ
        if (d.business_descriptions?.length > 0 &&
            (isCompany || d.business_descriptions.length > businessDescriptions.length)) {
          setBusinessDescriptions(d.business_descriptions)
        }
        if (d.target_segments?.length > 0 &&
            (isCompany || d.target_segments.length > targetSegments.length)) {
          setTargetSegments(d.target_segments)
        }
        if (d.competitors?.length > 0 &&
            (isCompany || d.competitors.length > competitors.length)) {
          setCompetitors(d.competitors)
        }
      } catch {
        // プリフィル失敗は無視
      }
    }

    fetchProfile()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Step 1: 基本情報</h1>

      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">
          {/* 企業名・ブランド名 */}
          <div className="mb-5">
            <h2 className="text-sm font-bold mb-3">
              企業名・ブランド名 <span className="text-xs text-red-500 font-normal">*</span>
            </h2>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="例: 株式会社○○ / ブランド名"
              maxLength={100}
              className={`h-10 ${errors.companyName ? 'border-red-400' : ''}`}
            />
            <p className="text-[13px] text-muted-foreground mt-1.5">
              企業名・サービス名・個人名など、ブランディングの対象となる名称を入力してください
            </p>
            {errors.companyName && (
              <p className="mt-1 text-xs text-red-500">{errors.companyName}</p>
            )}
          </div>

          {/* 業種 */}
          <div className="mb-5">
            <h2 className="text-sm font-bold mb-3">
              業種 <span className="text-xs text-red-500 font-normal">*</span>
            </h2>
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
          <div className="mb-5">
            <TitleDescriptionList
              label="事業内容"
              items={businessDescriptions}
              onChange={setBusinessDescriptions}
              addButtonLabel="事業内容を追加"
              titlePlaceholder="事業タイトル"
              descriptionPlaceholder="事業の説明"
              required
              error={errors.businessDescriptions}
            />
          </div>

          {/* ターゲット顧客層（構造化入力） */}
          <div className="mb-5">
            <TitleDescriptionList
              label="ターゲット顧客層"
              items={targetSegments.map(ts => ({ title: ts.name, description: ts.description }))}
              onChange={(newItems) => {
                setTargetSegments(newItems.map(item => ({ name: item.title, description: item.description })))
              }}
              addButtonLabel="ターゲットを追加"
              titlePlaceholder="セグメント名（例: 中小企業の経営者）"
              descriptionPlaceholder="セグメントの説明"
            />
          </div>

          {/* 競合企業 */}
          <div className="mb-5">
            <h2 className="text-sm font-bold mb-3">
              競合企業 <span className="text-xs text-gray-400 font-normal">（任意）</span>
            </h2>
            {competitors.length > 0 && (
              <div className="space-y-3 mb-3">
                {competitors.map((comp, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Input
                          value={comp.name}
                          onChange={(e) => updateCompetitor(i, 'name', e.target.value)}
                          placeholder="企業名（必須）"
                          className="h-10 text-sm"
                        />
                        <Input
                          value={comp.url}
                          onChange={(e) => updateCompetitor(i, 'url', e.target.value)}
                          placeholder="https://..."
                          className="h-10 text-sm"
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCompetitor(i)}
                      className="shrink-0 h-9 w-9 p-0 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {competitors.length < 10 && (
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
            )}
          </div>
        </CardContent>
      </Card>

      {/* 次へボタン */}
      <div className="mt-6">
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
