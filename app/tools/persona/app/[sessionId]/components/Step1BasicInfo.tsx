'use client'

// Step 1: 基本情報フォーム（企業情報＋ターゲット概要）
// STP・カラー定義ツールと同じ構造化データ（business_descriptions / target_segments）を使用
import { useState, useCallback, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { IndustrySelect } from '@/components/shared/IndustrySelect'
import { TitleDescriptionList } from '@/components/shared/TitleDescriptionList'
import { supabase } from '@/lib/supabase'
import { ArrowRight } from 'lucide-react'

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
  // 旧フィールド（後方互換）
  products?: string
  target_description?: string
}

interface Step1Props {
  basicInfo: BasicInfo
  onNext: (data: BasicInfo) => Promise<boolean>
  onSaveField: (data: BasicInfo) => Promise<void>
}

// 旧 products テキストを構造化データに変換
function migrateProducts(basicInfo: BasicInfo): BusinessDescription[] {
  if (basicInfo.business_descriptions?.length > 0) {
    return basicInfo.business_descriptions
  }
  if (basicInfo.products && basicInfo.products.trim()) {
    return [{ title: basicInfo.products.trim(), description: '' }]
  }
  return []
}

// 旧 target_description テキストを構造化データに変換
function migrateTargetSegments(basicInfo: BasicInfo): TargetSegment[] {
  if (basicInfo.target_segments?.length > 0) {
    return basicInfo.target_segments
  }
  if (basicInfo.target_description && basicInfo.target_description.trim()) {
    return [{ name: basicInfo.target_description.trim(), description: '' }]
  }
  return []
}

export function Step1BasicInfo({ basicInfo, onNext, onSaveField }: Step1Props) {
  const [companyName, setCompanyName] = useState(basicInfo.company_name || '')
  const [industryCategory, setIndustryCategory] = useState(basicInfo.industry_category || '')
  const [industrySubcategory, setIndustrySubcategory] = useState(basicInfo.industry_subcategory || '')
  const [businessDescriptions, setBusinessDescriptions] = useState<BusinessDescription[]>(
    migrateProducts(basicInfo)
  )
  const [targetSegments, setTargetSegments] = useState<TargetSegment[]>(
    migrateTargetSegments(basicInfo)
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const userIdRef = useRef<string | null>(null)

  // ユーザーID取得（companies同期用）
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      userIdRef.current = user?.id || null
    })
  }, [])

  // プリフィル: branding.bz本体のデータがあれば取得
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

        if (d.brand_name && (isCompany || !companyName)) setCompanyName(d.brand_name)
        if (d.industry_category && (isCompany || !industryCategory)) {
          setIndustryCategory(d.industry_category)
          if (d.industry_subcategory && (isCompany || !industrySubcategory)) {
            setIndustrySubcategory(d.industry_subcategory)
          }
        }
        if (d.business_descriptions?.length > 0 && (isCompany || businessDescriptions.length === 0)) {
          setBusinessDescriptions(d.business_descriptions)
        }
        if (d.target_segments?.length > 0 && (isCompany || targetSegments.length === 0)) {
          setTargetSegments(d.target_segments)
        }
      } catch {
        // プリフィル失敗は無視
      }
    }
    fetchProfile()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const getCurrentData = useCallback((): BasicInfo => ({
    company_name: companyName.trim(),
    industry_category: industryCategory,
    industry_subcategory: industrySubcategory,
    business_descriptions: businessDescriptions.filter(b => b.title.trim()),
    target_segments: targetSegments.filter(ts => ts.name.trim()),
  }), [companyName, industryCategory, industrySubcategory, businessDescriptions, targetSegments])

  // 本体（companies）へリアルタイム同期（fire and forget）
  const syncToCompany = useCallback((data: BasicInfo) => {
    const userId = userIdRef.current
    if (!userId) return
    fetch('/api/tools/shared-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        company_name: data.company_name,
        industry_category: data.industry_category,
        industry_subcategory: data.industry_subcategory,
        business_descriptions: data.business_descriptions,
        target_segments: data.target_segments,
      }),
    }).catch(() => {})
  }, [])

  // 1秒デバウンスのオートセーブ（セッション + companies同期）
  const triggerAutoSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const data = getCurrentData()
      onSaveField(data)
      syncToCompany(data)
    }, 1000)
  }, [getCurrentData, onSaveField, syncToCompany])

  useEffect(() => {
    const hasData = companyName || industryCategory || businessDescriptions.length > 0 || targetSegments.length > 0
    if (hasData) triggerAutoSave()
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [companyName, industryCategory, industrySubcategory, businessDescriptions, targetSegments]) // eslint-disable-line react-hooks/exhaustive-deps

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!companyName.trim()) newErrors.companyName = '企業名またはブランド名を入力してください'
    if (!industryCategory) newErrors.industryCategory = '業種を選択してください'
    const validDescriptions = businessDescriptions.filter(b => b.title.trim())
    if (validDescriptions.length === 0) newErrors.businessDescriptions = '事業内容を1つ以上入力してください'
    const validSegments = targetSegments.filter(ts => ts.name.trim())
    if (validSegments.length === 0) newErrors.targetSegments = 'ターゲットを1つ以上入力してください'
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

  const isValid =
    companyName.trim() !== '' &&
    industryCategory !== '' &&
    businessDescriptions.some(b => b.title.trim() !== '') &&
    targetSegments.some(ts => ts.name.trim() !== '')

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-4">Step 1: 基本情報</h1>

      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">
          {/* 企業名 */}
          <div className="mb-5">
            <h2 className="text-xs font-bold mb-3">
              企業名またはブランド名 <span className="text-xs text-red-500 font-normal">*</span>
            </h2>
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
            <h2 className="text-xs font-bold mb-3">
              業種 <span className="text-xs text-red-500 font-normal">*</span>
            </h2>
            <IndustrySelect
              category={industryCategory}
              subcategory={industrySubcategory}
              onCategoryChange={(val) => { setIndustryCategory(val); setIndustrySubcategory('') }}
              onSubcategoryChange={setIndustrySubcategory}
            />
            {errors.industryCategory && <p className="mt-1 text-xs text-red-500">{errors.industryCategory}</p>}
          </div>

          {/* 事業内容（構造化入力） */}
          <div className="mb-5">
            <TitleDescriptionList
              label="事業内容"
              items={businessDescriptions}
              onChange={setBusinessDescriptions}
              addButtonLabel="事業内容を追加"
              titlePlaceholder="事業タイトル（例: ブランディングコンサルティング）"
              descriptionPlaceholder="事業の説明（例: 中小企業向けのブランド戦略策定・CI/VI設計）"
              required
              error={errors.businessDescriptions}
            />
          </div>

          {/* ターゲット（構造化入力） */}
          <div className="mb-5">
            <TitleDescriptionList
              label="ターゲット"
              items={targetSegments.map(ts => ({ title: ts.name, description: ts.description }))}
              onChange={(newItems) => {
                setTargetSegments(newItems.map(item => ({ name: item.title, description: item.description })))
              }}
              addButtonLabel="ターゲットを追加"
              titlePlaceholder="セグメント名（例: 中小企業の経営者）"
              descriptionPlaceholder="セグメントの説明（例: 従業員30〜100名、自社ブランド確立に課題）"
              required
              error={errors.targetSegments}
            />
          </div>
        </CardContent>
      </Card>

      {/* フッターナビゲーション */}
      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-4 flex justify-end">
        <Button onClick={handleNext} disabled={saving || !isValid} className="h-14 gap-2 px-6 text-base font-bold">
          {saving ? '保存中...' : 'ペルソナ生成へ'}
          {!saving && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
