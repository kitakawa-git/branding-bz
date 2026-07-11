'use client'

// Step 1: 基本情報フォーム（企業情報）＋フレームワーク選択
// 他ミニアプリと同じ構造化データ（business_descriptions）＋ shared-profile プリフィル
import { useState, useCallback, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { IndustrySelect } from '@/components/shared/IndustrySelect'
import { FieldHeading } from '@/components/shared/FieldHeading'
import { TitleDescriptionList } from '@/components/shared/TitleDescriptionList'
import { supabase } from '@/lib/supabase'
import { ArrowRight, Radar, Drama, Check } from 'lucide-react'
import type { FrameworkKey } from '../../../lib/questions'

interface BusinessDescription {
  title: string
  description: string
}

interface BasicInfo {
  company_name: string
  industry_category: string
  industry_subcategory: string
  business_descriptions: BusinessDescription[]
}

interface Step1Props {
  basicInfo: Partial<BasicInfo>
  framework: FrameworkKey | ''
  onNext: (data: BasicInfo, framework: FrameworkKey) => Promise<boolean>
  onSaveField: (data: BasicInfo, framework: FrameworkKey | '') => Promise<void>
}

const FRAMEWORKS: Array<{
  key: FrameworkKey
  Icon: typeof Radar
  title: string
  subtitle: string
  description: string
}> = [
  {
    key: 'aaker',
    Icon: Radar,
    title: 'スコアで診断する',
    subtitle: 'Aaker 5次元',
    description: '誠実・刺激・能力・洗練・素朴の5次元をスコア化し、レーダーチャートで表示。分析的に把握したい人向け。',
  },
  {
    key: 'archetype',
    Icon: Drama,
    title: 'タイプで診断する',
    subtitle: '12アーキタイプ',
    description: '12の性格タイプから主人格と副人格を判定。「うちは賢者×援助者」と直感的に掴みたい人向け。',
  },
]

export function Step1BasicInfo({ basicInfo, framework, onNext, onSaveField }: Step1Props) {
  const [companyName, setCompanyName] = useState(basicInfo.company_name || '')
  const [industryCategory, setIndustryCategory] = useState(basicInfo.industry_category || '')
  const [industrySubcategory, setIndustrySubcategory] = useState(basicInfo.industry_subcategory || '')
  const [businessDescriptions, setBusinessDescriptions] = useState<BusinessDescription[]>(
    basicInfo.business_descriptions || []
  )
  const [selectedFramework, setSelectedFramework] = useState<FrameworkKey | ''>(framework)
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
  }), [companyName, industryCategory, industrySubcategory, businessDescriptions])

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
      }),
    }).catch(() => {})
  }, [])

  // 1秒デバウンスのオートセーブ（セッション + companies同期）
  const triggerAutoSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const data = getCurrentData()
      onSaveField(data, selectedFramework)
      syncToCompany(data)
    }, 1000)
  }, [getCurrentData, onSaveField, syncToCompany, selectedFramework])

  useEffect(() => {
    const hasData = companyName || industryCategory || businessDescriptions.length > 0 || selectedFramework
    if (hasData) triggerAutoSave()
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [companyName, industryCategory, industrySubcategory, businessDescriptions, selectedFramework]) // eslint-disable-line react-hooks/exhaustive-deps

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!companyName.trim()) newErrors.companyName = '企業名またはブランド名を入力してください'
    if (!industryCategory) newErrors.industryCategory = '業種を選択してください'
    const validDescriptions = businessDescriptions.filter(b => b.title.trim())
    if (validDescriptions.length === 0) newErrors.businessDescriptions = '事業内容を1つ以上入力してください'
    if (!selectedFramework) newErrors.framework = '診断タイプを選択してください'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = async () => {
    if (!validate() || !selectedFramework) return
    setSaving(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const data = getCurrentData()
    syncToCompany(data)
    const success = await onNext(data, selectedFramework)
    if (!success) setSaving(false)
  }

  const isValid =
    companyName.trim() !== '' &&
    industryCategory !== '' &&
    businessDescriptions.some(b => b.title.trim() !== '') &&
    selectedFramework !== ''

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Step 1: 基本情報</h1>
      <p className="mb-5 text-[13px] text-muted-foreground">
        企業情報と診断タイプを選び、AIに正しく文脈を渡すための土台を整えます
      </p>

      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">
          {/* 企業名 */}
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
        </CardContent>
      </Card>

      {/* フレームワーク選択 */}
      <div className="mt-6">
        <FieldHeading required className="mb-0">診断タイプ</FieldHeading>
        <p className="text-xs text-muted-foreground mb-3">
          質問は共通の10問。診断後、もう一方の見せ方にも切り替えられます。
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {FRAMEWORKS.map(({ key, Icon, title, subtitle, description }) => {
            const isSelected = selectedFramework === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedFramework(key)}
                className={`relative rounded-xl border-2 p-5 text-left transition-all hover:shadow-md ${
                  isSelected ? 'border-ds-app-accent bg-blue-50/50' : 'border-border bg-background'
                }`}
              >
                {isSelected && (
                  <span className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-ds-app-accent text-white">
                    <Check className="h-4 w-4" />
                  </span>
                )}
                <Icon size={28} strokeWidth={1.5} className={isSelected ? 'text-ds-app-accent' : 'text-foreground'} />
                <h3 className="mt-3 text-base font-bold text-foreground">{title}</h3>
                <p className="text-xs font-semibold text-muted-foreground mt-0.5">{subtitle}</p>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{description}</p>
              </button>
            )
          })}
        </div>
        {errors.framework && <p className="mt-2 text-xs text-red-500">{errors.framework}</p>}
      </div>

      {/* フッターナビゲーション */}
      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-4 flex justify-end">
        <Button onClick={handleNext} disabled={saving || !isValid} className="h-14 gap-2 px-6 text-base font-bold">
          {saving ? '保存中...' : '診断質問へ'}
          {!saving && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
