'use client'

// Step 3: ターゲティング（カードクリックでメイン/サブ選択、メインカード内に深掘り展開）
import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import { Slider } from '@/components/ui/slider'
import { ArrowLeft, ArrowRight, X, Loader2 } from 'lucide-react'
import { AIButton } from '@/components/shared/AIButton'
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

interface CompetitorAnalysis {
  name: string
  traits: string
}

// ターゲット適合マップ（顧客側軸＋ターゲット点＋自社カバー範囲楕円）
interface TargetFitMap {
  x_axis: { left: string; right: string }
  y_axis: { bottom: string; top: string }
  axis_rationale: string
  coverage: {
    center_x: number
    center_y: number
    width: number
    height: number
    rationale: string
  }
  targets: Array<{
    name: string
    role: 'main' | 'sub'
    x: number
    y: number
    in_coverage: boolean
  }>
  consistency_status: 'green' | 'yellow' | 'red'
}

// 後方互換のため evaluations フィールドは残す（UIからは使わない）
interface TargetingData {
  evaluations: Array<{ segment_name: string; attractiveness: number; competitiveness: number; priority: string }>
  main_target: string
  sub_targets: string[]
  target_description: string
  buying_factors?: string[]
  strengths?: string
  competitor_traits?: string  // 後方互換（旧フィールド）
  competitors_analysis?: CompetitorAnalysis[]
  target_fit_map?: TargetFitMap | null
}

interface BasicInfo {
  company_name: string
  industry_category: string
  industry_subcategory: string
  business_descriptions: Array<{ title: string; description: string }>
  target_segments: Array<{ name: string; description: string }>
  competitors: Array<{ name: string; url: string; notes?: string }>
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
  const [buyingFactors, setBuyingFactors] = useState<string[]>(targeting.buying_factors || [])
  const [strengths, setStrengths] = useState(targeting.strengths || '')

  // ターゲット適合マップ（顧客側軸・自社カバー範囲楕円）
  const [fitMap, setFitMap] = useState<TargetFitMap | null>(targeting.target_fit_map || null)
  const [fitMapLoading, setFitMapLoading] = useState(false)
  const fitMapDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fitMapInitRef = useRef(false)

  // 競合分析: セッションから復元 or 空で初期化
  const [competitorsAnalysis, setCompetitorsAnalysis] = useState<CompetitorAnalysis[]>(() => {
    const saved = targeting.competitors_analysis
    if (saved && saved.length > 0) return saved
    // 後方互換: 旧 competitor_traits がある場合は最初の競合に入れる
    return []
  })

  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)

  // Step1の競合企業からカードリストを構築（competitors_analysis と同期）
  const competitorCards = useMemo(() => {
    const comps = (basicInfo.competitors || []).filter(c => c.name?.trim())
    return comps.map(c => {
      const existing = competitorsAnalysis.find(
        ca => ca.name.trim().toLowerCase() === c.name.trim().toLowerCase()
      )
      return {
        name: c.name.trim(),
        notes: (c.notes || '').trim(),
        traits: existing?.traits || '',
      }
    })
  }, [basicInfo.competitors, competitorsAnalysis])

  // 競合カードの traits 更新
  const updateCompetitorTraits = (name: string, traits: string) => {
    setCompetitorsAnalysis(prev => {
      const idx = prev.findIndex(ca => ca.name.trim().toLowerCase() === name.trim().toLowerCase())
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = { ...updated[idx], traits }
        return updated
      }
      return [...prev, { name, traits }]
    })
  }

  // デバウンス
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // メインターゲットのセグメント説明をtarget_descriptionとして利用
  const mainSegDescription = useMemo(() => {
    if (!mainTarget) return ''
    const seg = allSegments.find(s => s.name === mainTarget)
    return seg?.description || ''
  }, [mainTarget, allSegments])

  // 現在のデータ
  const getCurrentData = useCallback(
    (): TargetingData => ({
      evaluations: [],
      main_target: mainTarget,
      sub_targets: subTargets,
      target_description: mainSegDescription,
      buying_factors: buyingFactors,
      strengths,
      competitors_analysis: competitorsAnalysis,
      target_fit_map: fitMap,
    }),
    [mainTarget, subTargets, mainSegDescription, buyingFactors, strengths, competitorsAnalysis, fitMap]
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
  }, [mainTarget, subTargets, mainSegDescription, buyingFactors, strengths, competitorsAnalysis, fitMap])

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
    // バリデーション
    if (buyingFactors.length === 0) {
      toast.error('購買決定要因を1つ以上入力してください')
      return
    }
    if (!strengths.trim()) {
      toast.error('自社の強みを入力してください')
      return
    }
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
    competitorsAnalysis.some(ca => ca.traits.trim() !== '')

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
      if (data.competitors_analysis && Array.isArray(data.competitors_analysis)) {
        setCompetitorsAnalysis(data.competitors_analysis)
      }
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

  // ターゲット適合マップを生成（ターゲット選定が変わるたびに自動再生成）
  const fetchTargetFitMap = useCallback(async () => {
    if (!mainTarget) return
    setFitMapLoading(true)
    try {
      const res = await fetch('/api/tools/stp/suggest-target-fit-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basic_info: basicInfo,
          segmentation,
          targeting: {
            main_target: mainTarget,
            sub_targets: subTargets,
            target_description: mainSegDescription,
            strengths,
            buying_factors: buyingFactors,
          },
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error((d as { error?: string }).error || 'マップの生成に失敗しました')
        return
      }
      const data = await res.json()
      setFitMap(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'マップの生成中にエラーが発生しました')
    } finally {
      setFitMapLoading(false)
    }
  }, [mainTarget, subTargets, mainSegDescription, strengths, buyingFactors, basicInfo, segmentation])

  // ターゲット選定が変わるたびに 1.5秒 debounce で自動再生成。初回はマップ未生成のときのみ。
  useEffect(() => {
    if (!mainTarget) return
    if (!fitMapInitRef.current) {
      fitMapInitRef.current = true
      if (!fitMap) fetchTargetFitMap()
      return
    }
    if (fitMapDebounceRef.current) clearTimeout(fitMapDebounceRef.current)
    fitMapDebounceRef.current = setTimeout(() => { fetchTargetFitMap() }, 1500)
    return () => { if (fitMapDebounceRef.current) clearTimeout(fitMapDebounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainTarget, subTargets.join('|')])

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
      <p className="mb-4 text-[13px] text-muted-foreground">
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
                      ? 'border-ds-app-accent-soft bg-blue-50/50'
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
                    {/* 選択状態バッジ（デザインシステムのBadgeに統一） */}
                    {isMain && (
                      <Badge className="absolute top-3 right-3 bg-ds-app-accent text-white hover:bg-ds-app-accent-hover">メインターゲット</Badge>
                    )}
                    {isSub && (
                      <Badge variant="outline" className="absolute top-3 right-3 border-blue-300 bg-transparent text-blue-300">サブターゲット</Badge>
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

                        {/* AI提案ボタン（見出し直下・左寄せ） */}
                        <div className="flex justify-start">
                          <AIButton
                            size="s"
                            onClick={handleAISuggestClick}
                            disabled={aiLoading}
                            icon={aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}
                          >
                            {aiLoading ? '提案中…' : 'AIで提案生成'}
                          </AIButton>
                        </div>

                        {/* 1. 購買決定要因（タグ入力） */}
                        <div>
                          <label className="text-[11px] text-gray-500 mb-1 block">購買決定要因 <span className="text-red-500">*</span></label>
                          <div className="flex flex-wrap gap-1.5 rounded-md border border-gray-200 bg-white p-2 min-h-[36px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1">
                            {buyingFactors.map((tag, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-ds-app-accent-hover"
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

                        {/* 2. 自社の強み */}
                        <div>
                          <label className="text-[11px] text-gray-500 mb-1 block">自社の強み <span className="text-red-500">*</span></label>
                          <AutoResizeTextarea
                            value={strengths}
                            onChange={(e) => setStrengths(e.target.value)}
                            placeholder="例: 中小企業の現場を知り尽くした実践的なノウハウ、低コストで始められる仕組み"
                            className="min-h-[60px]"
                            maxLength={300}
                          />
                        </div>

                        {/* 3. 競合分析（任意） — 競合ごとの個別カード */}
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <label className="text-[11px] text-gray-500">競合分析</label>
                            <span className="text-[10px] text-gray-400">（任意）</span>
                          </div>
                          {competitorCards.length > 0 ? (
                            <div className="space-y-2">
                              {competitorCards.map((comp) => (
                                <div key={comp.name} className="rounded-md border border-gray-200 bg-white p-3">
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <span className="text-xs font-bold text-gray-900">{comp.name}</span>
                                    {comp.notes && (
                                      <span className="text-[10px] text-gray-400">{comp.notes}</span>
                                    )}
                                  </div>
                                  <AutoResizeTextarea
                                    value={comp.traits}
                                    onChange={(e) => updateCompetitorTraits(comp.name, e.target.value)}
                                    placeholder="例: 高額だが大手実績が豊富。フルサポート型で柔軟性は低い"
                                    className="min-h-[40px]"
                                    maxLength={300}
                                  />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 rounded-md border border-dashed border-gray-200 bg-white p-3">
                              Step 1で競合企業・サービスを入力すると、ここに競合ごとの分析欄が表示されます
                            </p>
                          )}
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

      {/* ② ターゲット適合マップ */}
      {mainTarget && (
        <div className="mb-6 mt-6">
          <div className="mb-2 flex items-center gap-2 flex-wrap">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-xs font-medium text-background">2</span>
            <h3 className="text-sm font-medium">狙いの妥当性を確認する</h3>
            <span className="text-xs text-muted-foreground">— 選んだターゲットが自社のカバー範囲に入っているかを自動チェック</span>
          </div>
          {/* 整合性ステータスバー */}
          <ConsistencyStatusBar
            status={fitMap?.consistency_status || 'green'}
            targetCount={1 + subTargets.length}
            outCount={fitMap ? fitMap.targets.filter(t => !t.in_coverage).length : 0}
          />
          {/* マップ本体 */}
          {fitMapLoading && !fitMap && (
            <div className="mt-3 flex h-[200px] items-center justify-center rounded-lg border border-dashed border-border bg-white text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ターゲット適合マップを生成中...
            </div>
          )}
          {fitMap && (
            <TargetFitMapView
              fitMap={fitMap}
              onCoverageChange={(coverage) => setFitMap({ ...fitMap, coverage })}
            />
          )}
          {/* AI再生成ボタン */}
          <div className="mt-3 flex justify-start">
            <AIButton
              size="sm"
              onClick={fetchTargetFitMap}
              disabled={fitMapLoading}
              icon={fitMapLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}
            >
              {fitMapLoading ? '生成中…' : fitMap ? 'マップを再生成' : 'AIでマップを生成'}
            </AIButton>
          </div>
        </div>
      )}

      {/* フッターナビゲーション */}
      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-4 flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="h-14 gap-2 px-6 text-base font-bold">
          <ArrowLeft className="h-4 w-4" />
          戻る
        </Button>

        <Button
          onClick={handleNext}
          disabled={saving || !mainTarget}
          className="h-14 gap-2 px-6 text-base font-bold"
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
              現在の入力内容が上書きされます。よろしいですか？
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

// 整合性ステータスバー（緑/黄/赤）
function ConsistencyStatusBar({ status, targetCount, outCount }: {
  status: 'green' | 'yellow' | 'red'
  targetCount: number
  outCount: number
}) {
  const conf = {
    green: { bar: 'bg-emerald-500', wrap: 'bg-emerald-50 border-emerald-200 text-emerald-700', text: `✓ ${targetCount} ターゲット全員がカバー範囲内` },
    yellow: { bar: 'bg-amber-500', wrap: 'bg-amber-50 border-amber-200 text-amber-700', text: '⚠ 一部のターゲットがカバー範囲の端に位置' },
    red: { bar: 'bg-red-500', wrap: 'bg-red-50 border-red-200 text-red-700', text: `✗ ${outCount} 個のターゲットがカバー範囲外（要再検討）` },
  }[status]
  return (
    <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium ${conf.wrap}`}>
      <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${conf.bar}`} />
      {conf.text}
    </div>
  )
}

// ターゲット適合マップ描画（自社カバー範囲＝楕円、ターゲット＝色付き点）。横幅・縦幅はスライダーで調整。
const FIT_PAD = 44
const FIT_W = 500
const FIT_H = 300
const FIT_MAP_W = FIT_W - FIT_PAD * 2
const FIT_MAP_H = FIT_H - FIT_PAD * 2
const TARGET_COLORS = ['#10B981', '#8B5CF6', '#F59E0B'] // サブ用（メインは青固定）

function TargetFitMapView({ fitMap, onCoverageChange }: {
  fitMap: TargetFitMap
  onCoverageChange: (coverage: TargetFitMap['coverage']) => void
}) {
  const toX = (x: number) => FIT_PAD + (x / 100) * FIT_MAP_W
  const toY = (y: number) => FIT_PAD + ((100 - y) / 100) * FIT_MAP_H
  const cov = fitMap.coverage
  const cx = toX(cov.center_x)
  const cy = toY(cov.center_y)
  const rx = (cov.width / 100) * FIT_MAP_W / 2
  const ry = (cov.height / 100) * FIT_MAP_H / 2
  let subIdx = -1
  return (
    <div className="mt-3 rounded-lg border border-border bg-white p-3">
      <svg viewBox={`0 0 ${FIT_W} ${FIT_H}`} width="100%" className="rounded-lg" style={{ aspectRatio: '5 / 3' }}>
        {/* XY軸 */}
        <line x1={FIT_PAD + FIT_MAP_W / 2} y1={FIT_PAD} x2={FIT_PAD + FIT_MAP_W / 2} y2={FIT_PAD + FIT_MAP_H} stroke="#e5e7eb" strokeWidth={1} />
        <line x1={FIT_PAD} y1={FIT_PAD + FIT_MAP_H / 2} x2={FIT_PAD + FIT_MAP_W} y2={FIT_PAD + FIT_MAP_H / 2} stroke="#e5e7eb" strokeWidth={1} />
        {/* 自社カバー範囲（破線・半透明） */}
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#3B82F6" fillOpacity={0.08} stroke="#3B82F6" strokeOpacity={0.5} strokeWidth={1.5} strokeDasharray="6 4" />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="#3B82F6" fillOpacity={0.7}>自社カバー範囲</text>
        {/* 軸ラベル */}
        <text x={FIT_PAD - 6} y={FIT_PAD + FIT_MAP_H / 2} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="#6b7280">{fitMap.x_axis.left}</text>
        <text x={FIT_PAD + FIT_MAP_W + 6} y={FIT_PAD + FIT_MAP_H / 2} textAnchor="start" dominantBaseline="middle" fontSize="11" fill="#6b7280">{fitMap.x_axis.right}</text>
        <text x={FIT_PAD + FIT_MAP_W / 2} y={FIT_PAD - 12} textAnchor="middle" fontSize="11" fill="#6b7280">{fitMap.y_axis.top}</text>
        <text x={FIT_PAD + FIT_MAP_W / 2} y={FIT_PAD + FIT_MAP_H + 20} textAnchor="middle" fontSize="11" fill="#6b7280">{fitMap.y_axis.bottom}</text>
        {/* ターゲット点 */}
        {fitMap.targets.map((t, i) => {
          const color = t.role === 'main' ? '#3B82F6' : TARGET_COLORS[(subIdx = subIdx + 1) % TARGET_COLORS.length]
          const px = toX(t.x)
          const py = toY(t.y)
          return (
            <g key={i}>
              <circle cx={px} cy={py} r={6} fill={color} stroke="#fff" strokeWidth={2} opacity={t.in_coverage ? 1 : 0.95} />
              {!t.in_coverage && <circle cx={px} cy={py} r={10} fill="none" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="3 2" />}
              <text x={px + 9} y={py + 4} fontSize="11" fill="#0f172a" fontWeight={t.role === 'main' ? 700 : 400}>{t.name}</text>
            </g>
          )
        })}
      </svg>
      {fitMap.axis_rationale && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">軸選定の根拠: {fitMap.axis_rationale}</p>
      )}
      {/* カバー範囲スライダー（横幅・縦幅） */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground"><span>カバー範囲の横幅</span><span>{cov.width}</span></div>
          <Slider value={[cov.width]} min={20} max={100} step={1} onValueChange={([v]) => onCoverageChange({ ...cov, width: v })} />
        </div>
        <div>
          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground"><span>カバー範囲の縦幅</span><span>{cov.height}</span></div>
          <Slider value={[cov.height]} min={20} max={100} step={1} onValueChange={([v]) => onCoverageChange({ ...cov, height: v })} />
        </div>
      </div>
    </div>
  )
}
