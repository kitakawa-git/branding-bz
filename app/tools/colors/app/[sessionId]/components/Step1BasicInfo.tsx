'use client'

// Step 1: 基本情報フォーム
import { useState, useCallback, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { IndustrySelect } from '@/components/shared/IndustrySelect'
import { ColorPicker } from '../../components/ColorPicker'
import { Plus, Trash2 } from 'lucide-react'
import {
  type BrandStage,
  type CompetitorColor,
  type BrandColorProject,
} from '@/lib/types/color-tool'
import { supabase } from '@/lib/supabase'

interface Step1Props {
  project: BrandColorProject
  onNext: (data: Record<string, unknown>) => Promise<boolean>
  onSaveField: (data: Record<string, unknown>) => Promise<void>
}

export function Step1BasicInfo({ project, onNext, onSaveField }: Step1Props) {
  const [brandName, setBrandName] = useState(project.brand_name || '')
  const [industryCategory, setIndustryCategory] = useState(project.industry_category || '')
  const [industrySubcategory, setIndustrySubcategory] = useState(project.industry_subcategory || '')
  const [brandStage, setBrandStage] = useState<BrandStage | ''>(
    // 廃止された値は 'rebrand' にフォールバック
    (project.brand_stage === ('refinement' as string) || project.brand_stage === ('refine' as string))
      ? 'rebrand' : (project.brand_stage || '')
  )
  const [hasExistingColors, setHasExistingColors] = useState(
    (project.existing_colors?.length ?? 0) > 0
  )
  const [existingColors, setExistingColors] = useState<{ hex: string }[]>(
    project.existing_colors?.length ? project.existing_colors : [{ hex: '#1a1a1a' }]
  )
  const [competitorColors, setCompetitorColors] = useState<CompetitorColor[]>(
    project.competitor_colors?.length ? project.competitor_colors : []
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [prefilled, setPrefilled] = useState(false)

  // プリフィル: 初回表示時に本体 or 過去セッションからデータを読み込み
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
        const updates: Record<string, unknown> = {}

        if (d.brand_name && (isCompany || !brandName)) {
          setBrandName(d.brand_name)
          updates.brand_name = d.brand_name
        }
        if (d.industry_category && (isCompany || !industryCategory)) {
          setIndustryCategory(d.industry_category)
          updates.industry_category = d.industry_category
          // 大分類が変わったら中分類もリセットしてから適用
          if (isCompany && d.industry_category !== industryCategory) {
            setIndustrySubcategory(d.industry_subcategory || '')
            updates.industry_subcategory = d.industry_subcategory || ''
          }
        }
        if (d.industry_subcategory && (isCompany || !industrySubcategory)) {
          setIndustrySubcategory(d.industry_subcategory)
          updates.industry_subcategory = d.industry_subcategory
        }
        if (d.brand_stage && (isCompany || !brandStage)) {
          setBrandStage(d.brand_stage)
          updates.brand_stage = d.brand_stage
        }
        if (d.competitor_colors?.length && (isCompany || competitorColors.length === 0)) {
          setCompetitorColors(d.competitor_colors)
          updates.competitor_colors = d.competitor_colors
        }

        // 変更があればセッションに一括保存
        if (Object.keys(updates).length > 0) {
          onSaveField(updates)
        }

        setPrefilled(true)
      } catch {
        // プリフィル失敗は無視
      }
    }

    fetchProfile()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 自動保存（onBlur）
  const autoSave = useCallback((field: string, value: unknown) => {
    onSaveField({ [field]: value })
  }, [onSaveField])

  // バリデーション
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!brandName.trim()) {
      newErrors.brandName = '企業名・ブランド名を入力してください'
    } else if (brandName.length > 100) {
      newErrors.brandName = '企業名・ブランド名は100文字以内で入力してください'
    }

    if (!industryCategory) {
      newErrors.industryCategory = '業種（大分類）を選択してください'
    }

    if (!industrySubcategory) {
      newErrors.industrySubcategory = '業種（中分類）を選択してください'
    }

    if (!brandStage) {
      newErrors.brandStage = 'ブランドステージを選択してください'
    }

    if (hasExistingColors && existingColors.length === 0) {
      newErrors.existingColors = '既存カラーを1色以上入力してください'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = async () => {
    if (!validate()) return

    setSaving(true)
    const data: Record<string, unknown> = {
      brand_name: brandName.trim(),
      industry_category: industryCategory,
      industry_subcategory: industrySubcategory,
      brand_stage: brandStage,
      existing_colors: hasExistingColors ? existingColors : [],
      competitor_colors: competitorColors.filter(c => c.name.trim()),
    }

    const success = await onNext(data)
    if (!success) setSaving(false)
  }

  // 既存カラー操作
  const addExistingColor = () => {
    if (existingColors.length >= 5) return
    setExistingColors([...existingColors, { hex: '#888888' }])
  }

  const removeExistingColor = (index: number) => {
    setExistingColors(existingColors.filter((_, i) => i !== index))
  }

  const updateExistingColor = (index: number, hex: string) => {
    const updated = [...existingColors]
    updated[index] = { hex }
    setExistingColors(updated)
  }

  // 競合カラー操作
  const addCompetitor = () => {
    if (competitorColors.length >= 3) return
    setCompetitorColors([...competitorColors, { name: '', hex: '#888888' }])
  }

  const removeCompetitor = (index: number) => {
    setCompetitorColors(competitorColors.filter((_, i) => i !== index))
  }

  const updateCompetitor = (index: number, field: 'name' | 'hex', value: string) => {
    const updated = [...competitorColors]
    updated[index] = { ...updated[index], [field]: value }
    setCompetitorColors(updated)
  }

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
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              onBlur={() => autoSave('brand_name', brandName.trim())}
              placeholder="例: branding.bz"
              maxLength={100}
              className={`h-10 ${errors.brandName ? 'border-red-400' : ''}`}
            />
            <p className="text-[13px] text-muted-foreground mt-1.5">
              会社名またはブランド名を入力してください
            </p>
            {errors.brandName && (
              <p className="mt-1 text-xs text-red-500">{errors.brandName}</p>
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
                autoSave('industry_category', val)
              }}
              onSubcategoryChange={(val) => {
                setIndustrySubcategory(val)
                autoSave('industry_subcategory', val)
              }}
            />
            {(errors.industryCategory || errors.industrySubcategory) && (
              <p className="mt-1 text-xs text-red-500">
                {errors.industryCategory || errors.industrySubcategory}
              </p>
            )}
          </div>

          {/* ブランドステージ */}
          <div className="mb-5">
            <h2 className="text-sm font-bold mb-3">
              ブランドステージ <span className="text-xs text-red-500 font-normal">*</span>
            </h2>
            <Select
              value={brandStage || ''}
              onValueChange={(val) => {
                setBrandStage(val as BrandStage)
                autoSave('brand_stage', val)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="選択してください" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">新規ブランド</SelectItem>
                <SelectItem value="rebrand">リブランド</SelectItem>
              </SelectContent>
            </Select>
            {errors.brandStage && (
              <p className="mt-1 text-xs text-red-500">{errors.brandStage}</p>
            )}
          </div>

          {/* 既存カラー */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold">既存のブランドカラーがある</h2>
              <Switch
                checked={hasExistingColors}
                onCheckedChange={setHasExistingColors}
              />
            </div>

            {hasExistingColors && (
              <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
                {existingColors.map((color, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <ColorPicker
                      value={color.hex}
                      onChange={(hex) => updateExistingColor(i, hex)}
                    />
                    {existingColors.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeExistingColor(i)}
                        className="shrink-0 h-9 w-9 p-0 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {existingColors.length < 5 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addExistingColor}
                    className="text-sm"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    色を追加（最大5色）
                  </Button>
                )}
                {errors.existingColors && (
                  <p className="text-xs text-red-500">{errors.existingColors}</p>
                )}
              </div>
            )}
          </div>

          {/* 競合カラー */}
          <div className="mb-5">
            <h2 className="text-sm font-bold mb-3">
              競合ブランドのカラー <span className="text-xs text-gray-400 font-normal">（任意）</span>
            </h2>
            {competitorColors.length > 0 && (
              <div className="space-y-3 mb-3">
                {competitorColors.map((comp, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-3">
                    <Input
                      value={comp.name}
                      onChange={(e) => updateCompetitor(i, 'name', e.target.value)}
                      placeholder="ブランド名"
                      className="h-10 max-w-[160px] text-sm"
                    />
                    <ColorPicker
                      value={comp.hex}
                      onChange={(hex) => updateCompetitor(i, 'hex', hex)}
                    />
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
            {competitorColors.length < 3 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCompetitor}
                className="text-sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                競合を追加（最大3社）
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 次へボタン（スティッキー） */}
      <div className="sticky bottom-0 mt-6 -mx-4 bg-background/80 backdrop-blur px-4 py-3 flex justify-end">
        <Button
          onClick={handleNext}
          disabled={saving}
        >
          {saving ? '保存中...' : 'イメージ入力へ'}
        </Button>
      </div>
    </div>
  )
}
