'use client'

// Step 1: 基本情報フォーム
import { useState, useCallback, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { IndustrySelect } from '@/components/shared/IndustrySelect'
import { ColorPicker } from '../../components/ColorPicker'
import { Plus, Trash2, HelpCircle } from 'lucide-react'
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
  const [brandStage, setBrandStage] = useState<BrandStage | ''>(project.brand_stage || '')
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
  const [showPrefilledBanner, setShowPrefilledBanner] = useState(false)

  // プリフィル: 初回表示時に本体 or 過去セッションからデータを読み込み
  useEffect(() => {
    // 既にフォームにデータがある場合はスキップ
    if (project.brand_name || project.industry_category) return

    const fetchProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const res = await fetch(`/api/tools/shared-profile?userId=${user.id}`)
        if (!res.ok) return

        const result = await res.json()
        if (result.source === 'none' || !result.data) return

        const d = result.data
        if (d.brand_name && !brandName) setBrandName(d.brand_name)
        if (d.industry_category && !industryCategory) {
          setIndustryCategory(d.industry_category)
          // 自動保存
          onSaveField({ industry_category: d.industry_category })
        }
        if (d.industry_subcategory && !industrySubcategory) {
          setIndustrySubcategory(d.industry_subcategory)
          onSaveField({ industry_subcategory: d.industry_subcategory })
        }
        if (d.brand_stage && !brandStage) {
          setBrandStage(d.brand_stage)
          onSaveField({ brand_stage: d.brand_stage })
        }
        if (d.competitor_colors?.length && competitorColors.length === 0) {
          setCompetitorColors(d.competitor_colors)
          onSaveField({ competitor_colors: d.competitor_colors })
        }
        if (d.brand_name) {
          onSaveField({ brand_name: d.brand_name })
        }

        setPrefilled(true)
        setShowPrefilledBanner(true)
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
    <TooltipProvider>
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-bold text-gray-900">基本情報</h2>
          <p className="mt-1 text-sm text-gray-500">
            ブランドの基本情報を入力してください
          </p>
        </div>

        {/* プリフィルバナー */}
        {showPrefilledBanner && (
          <div className="rounded-md bg-blue-50 px-4 py-2 text-sm text-blue-600 transition-opacity duration-500"
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
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">会社名またはブランド名を入力してください</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            onBlur={() => autoSave('brand_name', brandName.trim())}
            placeholder="例: branding.bz"
            maxLength={100}
            className={errors.brandName ? 'border-red-400' : ''}
          />
          {errors.brandName && (
            <p className="mt-1 text-xs text-red-500">{errors.brandName}</p>
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
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <label className="text-sm font-bold text-gray-700">ブランドステージ</label>
            <span className="text-xs text-red-500">*</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">現在のブランドの状況を選んでください</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex flex-wrap gap-3">
            {[
              { value: 'new' as BrandStage, label: '新規ブランド', desc: 'カラーをゼロから決める' },
              { value: 'rebrand' as BrandStage, label: 'リブランド', desc: '既存カラーを大幅に刷新' },
              { value: 'refinement' as BrandStage, label: '微調整', desc: '既存カラーを少し改善' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setBrandStage(option.value)
                  autoSave('brand_stage', option.value)
                }}
                className={`flex-1 rounded-lg border px-4 py-3 text-left transition-colors ${
                  brandStage === option.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="text-sm font-medium text-gray-900">{option.label}</div>
                <div className="text-xs text-gray-500">{option.desc}</div>
              </button>
            ))}
          </div>
          {errors.brandStage && (
            <p className="mt-1 text-xs text-red-500">{errors.brandStage}</p>
          )}
        </div>

        {/* 既存カラー */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <label className="text-sm font-bold text-gray-700">既存のブランドカラーがある</label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3.5 w-3.5 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">現在使用中のカラーがあれば入力してください</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Switch
              checked={hasExistingColors}
              onCheckedChange={setHasExistingColors}
            />
          </div>

          {hasExistingColors && (
            <div className="space-y-2 rounded-lg border bg-white p-4">
              {existingColors.map((color, i) => (
                <div key={i} className="flex items-center gap-2">
                  <ColorPicker
                    value={color.hex}
                    onChange={(hex) => updateExistingColor(i, hex)}
                  />
                  {existingColors.length > 1 && (
                    <button
                      onClick={() => removeExistingColor(i)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              {existingColors.length < 5 && (
                <button
                  onClick={addExistingColor}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  色を追加（最大5色）
                </button>
              )}
              {errors.existingColors && (
                <p className="text-xs text-red-500">{errors.existingColors}</p>
              )}
            </div>
          )}
        </div>

        {/* 競合カラー */}
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <label className="text-sm font-bold text-gray-700">競合ブランドのカラー</label>
            <span className="text-xs text-gray-400">（任意）</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">競合と差別化するために参考にします</p>
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="space-y-3">
            {competitorColors.map((comp, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border bg-white p-3">
                <Input
                  value={comp.name}
                  onChange={(e) => updateCompetitor(i, 'name', e.target.value)}
                  placeholder="ブランド名"
                  className="h-8 max-w-[160px] text-sm"
                />
                <ColorPicker
                  value={comp.hex}
                  onChange={(hex) => updateCompetitor(i, 'hex', hex)}
                />
                <button
                  onClick={() => removeCompetitor(i)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            {competitorColors.length < 3 && (
              <button
                onClick={addCompetitor}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
              >
                <Plus className="h-3.5 w-3.5" />
                競合を追加（最大3社）
              </button>
            )}
          </div>
        </div>

        {/* 次へボタン */}
        <div className="pt-4">
          <Button
            onClick={handleNext}
            disabled={saving}
            className="h-11 w-full text-base font-bold md:w-auto md:px-12"
          >
            {saving ? '保存中...' : '次へ：イメージ入力'}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  )
}
