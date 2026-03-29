'use client'

// Step 1: 基本情報フォーム（企業情報＋ターゲット概要）
import { useState, useCallback, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { IndustrySelect } from '@/components/shared/IndustrySelect'
import { supabase } from '@/lib/supabase'
import { ArrowRight } from 'lucide-react'

interface BasicInfo {
  company_name: string
  industry_category: string
  industry_subcategory: string
  products: string
  target_description: string
}

interface Step1Props {
  basicInfo: BasicInfo
  onNext: (data: BasicInfo) => Promise<boolean>
  onSaveField: (data: BasicInfo) => Promise<void>
}

export function Step1BasicInfo({ basicInfo, onNext, onSaveField }: Step1Props) {
  const [companyName, setCompanyName] = useState(basicInfo.company_name || '')
  const [industryCategory, setIndustryCategory] = useState(basicInfo.industry_category || '')
  const [industrySubcategory, setIndustrySubcategory] = useState(basicInfo.industry_subcategory || '')
  const [products, setProducts] = useState(basicInfo.products || '')
  const [targetDescription, setTargetDescription] = useState(basicInfo.target_description || '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        if (d.business_descriptions?.length > 0 && (isCompany || !products)) {
          const text = d.business_descriptions
            .filter((b: { title: string }) => b.title?.trim())
            .map((b: { title: string; description: string }) => b.description ? `${b.title}: ${b.description}` : b.title)
            .join('\n')
          setProducts(text)
        }
        if (d.target_segments?.length > 0 && (isCompany || !targetDescription)) {
          const text = d.target_segments
            .filter((ts: { name: string }) => ts.name?.trim())
            .map((ts: { name: string; description: string }) => ts.description ? `${ts.name}: ${ts.description}` : ts.name)
            .join('\n')
          setTargetDescription(text)
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
    products: products.trim(),
    target_description: targetDescription.trim(),
  }), [companyName, industryCategory, industrySubcategory, products, targetDescription])

  // 1秒デバウンスのオートセーブ
  const triggerAutoSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onSaveField(getCurrentData())
    }, 1000)
  }, [getCurrentData, onSaveField])

  useEffect(() => {
    const hasData = companyName || industryCategory || products || targetDescription
    if (hasData) triggerAutoSave()
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [companyName, industryCategory, industrySubcategory, products, targetDescription]) // eslint-disable-line react-hooks/exhaustive-deps

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!companyName.trim()) newErrors.companyName = '企業名・ブランド名を入力してください'
    if (!industryCategory) newErrors.industryCategory = '業種を選択してください'
    if (!products.trim()) newErrors.products = '事業内容を入力してください'
    if (!targetDescription.trim()) newErrors.targetDescription = 'ターゲット概要を入力してください'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = async () => {
    if (!validate()) return
    setSaving(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const success = await onNext(getCurrentData())
    if (!success) setSaving(false)
  }

  const isValid = companyName.trim() && industryCategory && products.trim() && targetDescription.trim()

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Step 1: 基本情報</h1>

      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">
          {/* 企業名 */}
          <div className="mb-5">
            <h2 className="text-sm font-bold mb-3">
              企業名・ブランド名 <span className="text-xs text-red-500 font-normal">*</span>
            </h2>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="例: 株式会社○○"
              maxLength={100}
              className={`h-10 ${errors.companyName ? 'border-red-400' : ''}`}
            />
            {errors.companyName && <p className="mt-1 text-xs text-red-500">{errors.companyName}</p>}
          </div>

          {/* 業種 */}
          <div className="mb-5">
            <h2 className="text-sm font-bold mb-3">
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

          {/* 事業内容 */}
          <div className="mb-5">
            <h2 className="text-sm font-bold mb-3">
              事業内容 <span className="text-xs text-red-500 font-normal">*</span>
            </h2>
            <Textarea
              value={products}
              onChange={(e) => setProducts(e.target.value)}
              placeholder="例: 中小企業向けブランディングコンサルティング、Web制作、CI/VI設計"
              rows={3}
              className={errors.products ? 'border-red-400' : ''}
            />
            <p className="text-[13px] text-muted-foreground mt-1.5">
              主な商品・サービスを簡潔に記述してください
            </p>
            {errors.products && <p className="mt-1 text-xs text-red-500">{errors.products}</p>}
          </div>

          {/* ターゲット概要 */}
          <div className="mb-5">
            <h2 className="text-sm font-bold mb-3">
              ターゲット概要 <span className="text-xs text-red-500 font-normal">*</span>
            </h2>
            <Textarea
              value={targetDescription}
              onChange={(e) => setTargetDescription(e.target.value)}
              placeholder="例: 従業員30〜100名の中小企業の経営者・マーケティング担当者。自社ブランドの確立に課題を感じている。"
              rows={3}
              className={errors.targetDescription ? 'border-red-400' : ''}
            />
            <p className="text-[13px] text-muted-foreground mt-1.5">
              ペルソナの元となるターゲット層の概要を記述してください。AIがこの情報をもとにペルソナを提案します。
            </p>
            {errors.targetDescription && <p className="mt-1 text-xs text-red-500">{errors.targetDescription}</p>}
          </div>
        </CardContent>
      </Card>

      {/* フッターナビゲーション */}
      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-3 flex justify-end">
        <Button onClick={handleNext} disabled={saving || !isValid} className="gap-1">
          {saving ? '保存中...' : 'デモグラフィックへ'}
          {!saving && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
