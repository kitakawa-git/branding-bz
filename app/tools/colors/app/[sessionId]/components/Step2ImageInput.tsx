'use client'

// Step 2: イメージ入力
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { KeywordSelector } from '../../components/KeywordSelector'
import { MoodboardPairSelector } from '../../components/MoodboardPair'
import { ColorPicker } from '../../components/ColorPicker'
import type {
  BrandColorProject,
  ApproachType,
  KeywordSelection,
  MoodboardChoice,
} from '@/lib/types/color-tool'

interface Step2Props {
  project: BrandColorProject
  onNext: (data: Record<string, unknown>) => Promise<boolean>
  onBack: () => Promise<boolean>
  onSaveField: (data: Record<string, unknown>) => Promise<void>
}

export function Step2ImageInput({ project, onNext, onBack, onSaveField }: Step2Props) {
  const [approach, setApproach] = useState<ApproachType | null>(
    project.approach_type || null
  )
  const [keywords, setKeywords] = useState<KeywordSelection[]>(
    project.keywords || []
  )
  const [moodboardChoices, setMoodboardChoices] = useState<MoodboardChoice[]>(
    project.moodboard_choices || []
  )
  const [avoidColors, setAvoidColors] = useState<string[]>(
    project.avoid_colors || []
  )
  const [referenceBrands, setReferenceBrands] = useState<string[]>(
    project.reference_brands || []
  )
  const [showAdditional, setShowAdditional] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!approach) {
      newErrors.approach = 'アプローチを選択してください'
      setErrors(newErrors)
      return false
    }

    if (approach === 'keyword' && keywords.length < 3) {
      newErrors.keywords = 'キーワードを3つ以上選択してください'
    }

    if (approach === 'moodboard' && moodboardChoices.length < 5) {
      newErrors.moodboard = '5問以上回答してください'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = async () => {
    if (!validate()) return

    setSaving(true)
    const data: Record<string, unknown> = {
      approach_type: approach,
      keywords: approach === 'keyword' ? keywords : [],
      moodboard_choices: approach === 'moodboard' ? moodboardChoices : [],
      avoid_colors: avoidColors.filter(c => c),
      reference_brands: referenceBrands.filter(b => b.trim()),
    }

    const success = await onNext(data)
    if (!success) setSaving(false)
  }

  // 避けたい色の操作
  const addAvoidColor = () => {
    if (avoidColors.length >= 3) return
    setAvoidColors([...avoidColors, '#ff0000'])
  }

  const removeAvoidColor = (index: number) => {
    setAvoidColors(avoidColors.filter((_, i) => i !== index))
  }

  const updateAvoidColor = (index: number, hex: string) => {
    const updated = [...avoidColors]
    updated[index] = hex
    setAvoidColors(updated)
  }

  // 参考ブランドの操作
  const addReferenceBrand = () => {
    if (referenceBrands.length >= 3) return
    setReferenceBrands([...referenceBrands, ''])
  }

  const removeReferenceBrand = (index: number) => {
    setReferenceBrands(referenceBrands.filter((_, i) => i !== index))
  }

  const updateReferenceBrand = (index: number, value: string) => {
    const updated = [...referenceBrands]
    updated[index] = value
    setReferenceBrands(updated)
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-gray-900">イメージ入力</h2>
        <p className="mt-1 text-sm text-gray-500">
          ブランドのイメージに近い方向性を選んでください
        </p>
      </div>

      {/* アプローチ選択 */}
      {!approach && (
        <div className="grid gap-4 md:grid-cols-2">
          <button
            onClick={() => setApproach('keyword')}
            className="rounded-xl border-2 border-gray-200 bg-white p-6 text-left transition-all hover:border-blue-300 hover:shadow-md"
          >
            <div className="mb-2 text-2xl">🏷️</div>
            <h3 className="mb-1 text-base font-bold text-gray-900">キーワードで選ぶ</h3>
            <p className="text-sm text-gray-500">
              ブランドの印象に近いキーワードを3〜5個選んでください
            </p>
          </button>
          <button
            onClick={() => setApproach('moodboard')}
            className="rounded-xl border-2 border-gray-200 bg-white p-6 text-left transition-all hover:border-blue-300 hover:shadow-md"
          >
            <div className="mb-2 text-2xl">🎨</div>
            <h3 className="mb-1 text-base font-bold text-gray-900">直感で選ぶ</h3>
            <p className="text-sm text-gray-500">
              2つの雰囲気からブランドに近い方を直感的に選んでください
            </p>
          </button>
        </div>
      )}

      {/* アプローチ選択済みの場合のヘッダー */}
      {approach && (
        <div className="flex items-center gap-2">
          <span className={cn(
            'rounded-full px-3 py-1 text-xs font-medium',
            approach === 'keyword'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-purple-100 text-purple-700'
          )}>
            {approach === 'keyword' ? 'キーワード' : 'ムードボード'}
          </span>
          <button
            onClick={() => { setApproach(null); setErrors({}) }}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            変更する
          </button>
        </div>
      )}

      {/* キーワードモード */}
      {approach === 'keyword' && (
        <div>
          <KeywordSelector value={keywords} onChange={setKeywords} />
          {errors.keywords && (
            <p className="mt-2 text-xs text-red-500">{errors.keywords}</p>
          )}
          {keywords.length >= 3 && !showAdditional && (
            <div className="mt-6">
              <button
                onClick={() => setShowAdditional(true)}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                追加の質問に答える（任意）→
              </button>
            </div>
          )}
        </div>
      )}

      {/* ムードボードモード */}
      {approach === 'moodboard' && (
        <div>
          <MoodboardPairSelector
            value={moodboardChoices}
            onChange={setMoodboardChoices}
            onComplete={() => setShowAdditional(true)}
          />
          {errors.moodboard && (
            <p className="mt-2 text-xs text-red-500">{errors.moodboard}</p>
          )}
        </div>
      )}

      {/* 共通の追加質問 */}
      {showAdditional && (
        <div className="space-y-6 rounded-xl border bg-white p-6">
          <h3 className="text-sm font-bold text-gray-900">追加の質問（任意）</h3>

          {/* 避けたい色 */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              避けたい色はありますか？
            </label>
            <div className="space-y-2">
              {avoidColors.map((color, i) => (
                <div key={i} className="flex items-center gap-2">
                  <ColorPicker
                    value={color}
                    onChange={(hex) => updateAvoidColor(i, hex)}
                  />
                  <button
                    onClick={() => removeAvoidColor(i)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {avoidColors.length < 3 && (
                <button
                  onClick={addAvoidColor}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  色を追加（最大3色）
                </button>
              )}
            </div>
          </div>

          {/* 参考ブランド */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              参考にしたいブランドがあれば教えてください
            </label>
            <div className="space-y-2">
              {referenceBrands.map((brand, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={brand}
                    onChange={(e) => updateReferenceBrand(i, e.target.value)}
                    placeholder="ブランド名"
                    className="h-8 text-sm"
                  />
                  <button
                    onClick={() => removeReferenceBrand(i)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {referenceBrands.length < 3 && (
                <button
                  onClick={addReferenceBrand}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  ブランドを追加（最大3件）
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ナビゲーション */}
      <div className="flex gap-3 pt-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          戻る
        </Button>
        {((approach === 'keyword' && keywords.length >= 3) ||
          (approach === 'moodboard' && moodboardChoices.length >= 5)) && (
          <Button
            onClick={handleNext}
            disabled={saving}
            className="font-bold"
          >
            {saving ? '保存中...' : '次へ：AI提案を受ける'}
          </Button>
        )}
      </div>
    </div>
  )
}
