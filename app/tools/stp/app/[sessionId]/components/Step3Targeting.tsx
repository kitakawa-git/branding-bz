'use client'

// Step 3: ターゲティング（カードクリックでメイン/サブ選択、メインカード内に深掘り展開）
import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import { ArrowLeft, ArrowRight, X, Sparkles, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// 型定義
interface SegmentSource {
  name: string
  description: string
  size_hint: '大' | '中' | '小'
  priorities?: string
  selected: boolean
}

interface VariableSource {
  name: string
  segments: SegmentSource[]
}

interface SegmentationData {
  mode: 'ai' | 'manual'
  variables: VariableSource[]
}

// 後方互換のため evaluations フィールドは残す（UIからは使わない）
interface TargetingData {
  evaluations: Array<{ segment_name: string; attractiveness: number; competitiveness: number; priority: string }>
  main_target: string
  sub_targets: string[]
  target_description: string
  buying_factors?: string[]
  strengths?: string
  competitor_traits?: string
}

interface BasicInfo {
  company_name: string
  industry_category: string
  industry_subcategory: string
  business_descriptions: Array<{ title: string; description: string }>
  target_segments: Array<{ name: string; description: string }>
  competitors: Array<{ name: string; url: string }>
  industry?: string
  industry_other?: string
  products?: string
  current_customers?: string
}

interface Step3Props {
  basicInfo: BasicInfo
  segmentation: SegmentationData
  targeting: TargetingData
  onNext: (data: TargetingData) => Promise<boolean>
  onBack: () => void
  onSaveField: (data: TargetingData) => Promise<void>
}

// Step2から全セグメントを抽出（名前があるもののみ）
function extractSegments(
  segmentation: SegmentationData
): Array<{ name: string; description: string }> {
  const segments: Array<{ name: string; description: string }> = []
  for (const variable of segmentation.variables || []) {
    for (const seg of variable.segments || []) {
      if (seg.name.trim()) {
        segments.push({
          name: seg.name,
          description: seg.description,
        })
      }
    }
  }
  return segments
}

export function Step3Targeting({
  basicInfo,
  segmentation,
  targeting,
  onNext,
  onBack,
  onSaveField,
}: Step3Props) {
  // Step2から選択済みセグメントを抽出
  const allSegments = useMemo(
    () => extractSegments(segmentation),
    [segmentation]
  )

  const [mainTarget, setMainTarget] = useState(targeting.main_target || '')
  const [subTargets, setSubTargets] = useState<string[]>(targeting.sub_targets || [])
  const [targetDescription, setTargetDescription] = useState(targeting.target_description || '')
  const [buyingFactors, setBuyingFactors] = useState<string[]>(targeting.buying_factors || [])
  const [strengths, setStrengths] = useState(targeting.strengths || '')
  const [competitorTraits, setCompetitorTraits] = useState(targeting.competitor_traits || '')
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)

  // デバウンス
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 現在のデータ
  const getCurrentData = useCallback(
    (): TargetingData => ({
      evaluations: [],
      main_target: mainTarget,
      sub_targets: subTargets,
      target_description: targetDescription,
      buying_factors: buyingFactors,
      strengths,
      competitor_traits: competitorTraits,
    }),
    [mainTarget, subTargets, targetDescription, buyingFactors, strengths, competitorTraits]
  )

  // オートセーブ（1秒デバウンス）
  const triggerAutoSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onSaveField(getCurrentData())
    }, 1000)
  }, [getCurrentData, onSaveField])

  // 値変更時にオートセーブ
  useEffect(() => {
    triggerAutoSave()
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainTarget, subTargets, targetDescription, buyingFactors, strengths, competitorTraits])

  // mainTarget / subTargets が現在のセグメントに存在するかチェック
  useEffect(() => {
    const segNames = new Set(allSegments.map((s) => s.name))
    if (mainTarget && !segNames.has(mainTarget)) {
      setMainTarget('')
    }
    setSubTargets((prev) => prev.filter((s) => segNames.has(s)))
  }, [allSegments, mainTarget])


  // カードクリック動作
  const handleCardClick = (name: string) => {
    if (mainTarget === name) {
      // メインクリック → メイン解除
      setMainTarget('')
    } else if (subTargets.includes(name)) {
      // サブクリック → サブ解除
      setSubTargets((prev) => prev.filter((s) => s !== name))
    } else if (!mainTarget) {
      // メインが未設定 → メインに
      setMainTarget(name)
    } else {
      // メインが既にある → サブに（最大2つ）
      if (subTargets.length >= 2) {
        toast.error('サブターゲットは2つまでです')
        return
      }
      setSubTargets((prev) => [...prev, name])
    }
  }

  // タグ入力ハンドラ
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault()
      const newTag = tagInput.trim().replace(/,/g, '')
      if (newTag && !buyingFactors.includes(newTag)) {
        setBuyingFactors((prev) => [...prev, newTag])
      }
      setTagInput('')
    } else if (e.key === 'Backspace' && !tagInput && buyingFactors.length > 0) {
      setBuyingFactors((prev) => prev.slice(0, -1))
    }
  }

  const removeTag = (index: number) => {
    setBuyingFactors((prev) => prev.filter((_, i) => i !== index))
  }

  const handleNext = async () => {
    setSaving(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const success = await onNext(getCurrentData())
    if (!success) setSaving(false)
  }

  // AI提案取得
  const [confirmOpen, setConfirmOpen] = useState(false)

  const hasExistingInput =
    buyingFactors.length > 0 ||
    strengths.trim() !== '' ||
    competitorTraits.trim() !== '' ||
    targetDescription.trim() !== ''

  const handleAISuggestClick = () => {
    if (hasExistingInput) {
      setConfirmOpen(true)
      return
    }
    fetchAISuggestion()
  }

  const fetchAISuggestion = useCallback(async () => {
    // メインターゲットの情報を取得
    const mainSeg = allSegments.find((s) => s.name === mainTarget)
    if (!mainSeg) return

    setAiLoading(true)
    try {
      // 60秒タイムアウト
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)

      const res = await fetch('/api/tools/stp/suggest-target-detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basic_info: basicInfo,
          segmentation,
          main_target: { name: mainSeg.name, description: mainSeg.description },
        }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error((data as { error?: string }).error || 'AI提案の取得に失敗しました')
        return
      }
      const data = await res.json()
      if (data.buying_factors) setBuyingFactors(data.buying_factors)
      if (data.strengths) setStrengths(data.strengths)
      if (data.competitor_traits) setCompetitorTraits(data.competitor_traits)
      if (data.target_description) setTargetDescription(data.target_description)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        toast.error('リクエストがタイムアウトしました。再度お試しください。')
      } else {
        toast.error(err instanceof Error ? err.message : 'エラーが発生しました')
      }
    } finally {
      setAiLoading(false)
    }
  }, [mainTarget, allSegments, basicInfo, segmentation])

  // セグメントが0個の場合
  if (allSegments.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-6">Step 3: ターゲティング</h1>
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-white">
          <p className="text-sm text-gray-500">
            Step 2でグループを1つ以上選択してください
          </p>
          <Button variant="outline" onClick={onBack} className="mt-4 gap-1">
            <ArrowLeft className="h-4 w-4" />
            Step2に戻る
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Step 3: ターゲティング</h1>
      <p className="mb-5 text-[13px] text-muted-foreground">
        狙う市場を選び、ターゲットの特徴を深掘りします
      </p>

      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">

          {/* グループ一覧（カードクリックで選択） */}
          <p className="mb-3 text-xs text-gray-500">
            カードをクリックしてメインターゲット（1つ）とサブターゲット（最大2つ）を選んでください
          </p>
          <div className="space-y-3">
            {allSegments.map((seg) => {
              const isMain = mainTarget === seg.name
              const isSub = subTargets.includes(seg.name)
              return (
                <div
                  key={seg.name}
                  className={`relative rounded-lg border transition-all ${
                    isMain
                      ? 'border-blue-500 bg-blue-50/50'
                      : isSub
                        ? 'border-blue-300 bg-blue-50/30'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  {/* クリック可能なヘッダー部分 */}
                  <button
                    type="button"
                    onClick={() => handleCardClick(seg.name)}
                    className="relative w-full p-4 text-left cursor-pointer"
                  >
                    {/* 選択状態バッジ */}
                    {isMain && (
                      <span className="absolute top-3 right-3 rounded-full bg-blue-500 px-2.5 py-0.5 text-[10px] font-bold text-white">
                        メインターゲット
                      </span>
                    )}
                    {isSub && (
                      <span className="absolute top-3 right-3 rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-blue-700">
                        サブターゲット
                      </span>
                    )}

                    <span className="text-sm font-bold text-gray-900">{seg.name}</span>
                    {seg.description && (
                      <p className="mt-1 text-sm text-gray-600">{seg.description}</p>
                    )}
                  </button>

                  {/* メインターゲット深掘り（カード内展開） */}
                  <div
                    className="grid transition-[grid-template-rows] duration-300 ease-in-out"
                    style={{ gridTemplateRows: isMain ? '1fr' : '0fr' }}
                  >
                    <div className="overflow-hidden">
                      <div className="border-t border-blue-200 mx-4 mb-4 pt-4 space-y-4">

                        {/* AI提案ボタン */}
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleAISuggestClick}
                            disabled={aiLoading}
                            className="gap-1.5 text-xs"
                          >
                            {aiLoading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="h-3.5 w-3.5" />
                            )}
                            {aiLoading ? 'AI分析中...' : 'AIに提案してもらう'}
                          </Button>
                        </div>

                        {/* 購買決定要因（タグ入力） */}
                        <div>
                          <label className="text-[11px] text-gray-500 mb-1 block">購買決定要因</label>
                          <div className="flex flex-wrap gap-1.5 rounded-md border border-gray-200 bg-white p-2 min-h-[36px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1">
                            {buyingFactors.map((tag, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700"
                              >
                                {tag}
                                <button
                                  type="button"
                                  onClick={() => removeTag(i)}
                                  className="hover:text-blue-900"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                            <input
                              value={tagInput}
                              onChange={(e) => setTagInput(e.target.value)}
                              onKeyDown={handleTagKeyDown}
                              placeholder={buyingFactors.length === 0 ? '例: 価格、品質、サポート（Enterで追加）' : 'Enterで追加'}
                              className="flex-1 min-w-[120px] border-none outline-none text-xs bg-transparent"
                            />
                          </div>
                        </div>

                        {/* 自社の強み */}
                        <div>
                          <label className="text-[11px] text-gray-500 mb-1 block">自社の強み</label>
                          <AutoResizeTextarea
                            value={strengths}
                            onChange={(e) => setStrengths(e.target.value)}
                            placeholder="例: 中小企業の現場を知り尽くした実践的なノウハウ、低コストで始められる仕組み"
                            className="min-h-[60px]"
                            maxLength={300}
                          />
                        </div>

                        {/* 競合の特徴（任意） */}
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <label className="text-[11px] text-gray-500">競合の特徴</label>
                            <span className="text-[10px] text-gray-400">（任意）</span>
                          </div>
                          <AutoResizeTextarea
                            value={competitorTraits}
                            onChange={(e) => setCompetitorTraits(e.target.value)}
                            placeholder="例: 大手コンサル会社は高額で大企業向け、フリーランスはデザイン中心で戦略支援が弱い"
                            className="min-h-[60px]"
                            maxLength={300}
                          />
                        </div>

                        {/* ターゲットの詳細定義（任意） */}
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <label className="text-[11px] text-gray-500">ターゲットの詳細定義</label>
                            <span className="text-[10px] text-gray-400">（任意）</span>
                          </div>
                          <AutoResizeTextarea
                            value={targetDescription}
                            onChange={(e) => setTargetDescription(e.target.value)}
                            placeholder="例: 従業員50〜200名の中小製造業で、ブランディングに課題を感じているが、コンサルに頼む予算がない経営者"
                            className="min-h-[60px]"
                            maxLength={500}
                          />
                        </div>

                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

        </CardContent>
      </Card>

      {/* フッターナビゲーション */}
      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-3 flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          戻る
        </Button>

        <Button
          onClick={handleNext}
          disabled={saving || !mainTarget}
          className="gap-1"
        >
          {saving ? '保存中...' : 'ポジショニングへ'}
          {!saving && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>

      {/* AI提案の確認ダイアログ */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認</AlertDialogTitle>
            <AlertDialogDescription>
              入力済みの内容が上書きされます。よろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={() => fetchAISuggestion()}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
