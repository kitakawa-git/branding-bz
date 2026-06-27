'use client'

// Step 2: セグメンテーション
import { useState, useCallback, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, ArrowRight, Plus, Trash2, Lightbulb, MapPin, Users, Heart, Activity } from 'lucide-react'
import { AIButton } from '@/components/shared/AIButton'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
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
interface Segment {
  name: string
  description: string
  size_hint: '大' | '中' | '小'
  priorities?: string
  selected: boolean
}

interface Variable {
  name: string
  reason?: string
  axis_type?: 'ordinal' | 'categorical'  // 順序型/カテゴリ型（適合マップの軸候補フィルタに使用）
  segments: Segment[]
}

interface SegmentationData {
  mode: 'ai' | 'manual'
  variables: Variable[]
}

interface BasicInfo {
  company_name: string
  industry_category: string
  industry_subcategory: string
  business_descriptions: Array<{ title: string; description: string }>
  target_segments: Array<{ name: string; description: string }>
  competitors: Array<{ name: string; url: string }>
  // 旧フィールド（後方互換）
  industry?: string
  industry_other?: string
  products?: string
  current_customers?: string
}

interface Step2Props {
  segmentation: SegmentationData
  basicInfo: BasicInfo
  onNext: (data: SegmentationData) => Promise<boolean>
  onBack: () => void
  onSaveField: (data: SegmentationData) => Promise<void>
}

// 切り口（A/B/C/D）の番号バッジ配色。5つ目以降はグレー
const VAR_BADGE_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
]

export function Step2Segmentation({
  segmentation,
  basicInfo,
  onNext,
  onBack,
  onSaveField,
}: Step2Props) {
  // 後方互換のためmodeは保持（UIからの切替は廃止）
  const mode = segmentation.mode || 'ai'
  const [variables, setVariables] = useState<Variable[]>(
    segmentation.variables?.length > 0 ? segmentation.variables : []
  )
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [saving, setSaving] = useState(false)

  // デバウンス用タイマー
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // AI提案済みフラグ（初回自動リクエスト制御用）
  const aiRequestedRef = useRef(false)

  // オートセーブ（1秒デバウンス）
  const triggerAutoSave = useCallback(
    (vars: Variable[], currentMode: 'ai' | 'manual') => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onSaveField({ mode: currentMode, variables: vars })
      }, 1000)
    },
    [onSaveField]
  )

  // variables更新用ヘルパー（ステート更新 + オートセーブトリガー）
  const updateVariables = useCallback(
    (updater: (prev: Variable[]) => Variable[]) => {
      setVariables((prev) => {
        const next = updater(prev)
        triggerAutoSave(next, mode)
        return next
      })
    },
    [mode, triggerAutoSave]
  )

  // AI提案を取得
  const fetchAISuggestion = useCallback(async () => {
    setAiLoading(true)
    setAiError('')
    try {
      const res = await fetch('/api/tools/stp/suggest-segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ basic_info: basicInfo }),
      })

      if (!res.ok) {
        const data = await res.json()
        setAiError(data.error || 'AI提案の取得に失敗しました')
        return
      }

      const { variables: suggestedVars } = await res.json()
      // selected: true をデフォルトで付与
      const withSelected: Variable[] = suggestedVars.map(
        (v: { name: string; reason?: string; axis_type?: 'ordinal' | 'categorical'; segments: Array<{ name: string; description: string; size_hint: string; priorities?: string }> }) => ({
          name: v.name,
          reason: v.reason || '',
          axis_type: v.axis_type,
          segments: v.segments.map(
            (s: { name: string; description: string; size_hint: string; priorities?: string }) => ({
              ...s,
              size_hint: s.size_hint || '中',
              priorities: s.priorities || '',
              selected: true,
            })
          ),
        })
      )
      setVariables(withSelected)
      triggerAutoSave(withSelected, 'ai')
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setAiLoading(false)
    }
  }, [basicInfo, triggerAutoSave])

  // 初回マウント時、データがなければ自動でAI提案を実行
  useEffect(() => {
    if (variables.length === 0 && !aiRequestedRef.current) {
      aiRequestedRef.current = true
      fetchAISuggestion()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // 再提案（確認ダイアログ付き）
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleRegenerate = () => {
    if (variables.length > 0) {
      setConfirmOpen(true)
      return
    }
    fetchAISuggestion()
  }

  // --- 変数操作 ---
  const addVariable = () => {
    updateVariables((prev) => [
      ...prev,
      { name: '', segments: [{ name: '', description: '', size_hint: '中', priorities: '', selected: true }] },
    ])
  }

  const removeVariable = (varIndex: number) => {
    updateVariables((prev) => prev.filter((_, i) => i !== varIndex))
  }

  const updateVariableName = (varIndex: number, name: string) => {
    updateVariables((prev) =>
      prev.map((v, i) => (i === varIndex ? { ...v, name } : v))
    )
  }

  // --- セグメント操作 ---
  const addSegment = (varIndex: number) => {
    updateVariables((prev) =>
      prev.map((v, i) =>
        i === varIndex
          ? {
              ...v,
              segments: [
                ...v.segments,
                { name: '', description: '', size_hint: '中' as const, priorities: '', selected: true },
              ],
            }
          : v
      )
    )
  }

  const removeSegment = (varIndex: number, segIndex: number) => {
    updateVariables((prev) =>
      prev.map((v, i) =>
        i === varIndex
          ? { ...v, segments: v.segments.filter((_, si) => si !== segIndex) }
          : v
      )
    )
  }

  const updateSegment = (
    varIndex: number,
    segIndex: number,
    field: keyof Segment,
    value: string | boolean
  ) => {
    updateVariables((prev) =>
      prev.map((v, i) =>
        i === varIndex
          ? {
              ...v,
              segments: v.segments.map((s, si) =>
                si === segIndex ? { ...s, [field]: value } : s
              ),
            }
          : v
      )
    )
  }

  // バリデーション: グループが1つ以上（名前あり）
  const hasSegment = variables.some((v) =>
    v.segments.some((s) => s.name.trim())
  )

  const handleNext = async () => {
    setSaving(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const data: SegmentationData = { mode, variables }
    const success = await onNext(data)
    if (!success) setSaving(false)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Step 2: セグメンテーション</h1>
      <p className="mb-4 text-[13px] text-muted-foreground">
        市場を意味のあるまとまりに分けることで、狙うべき相手を絞り込みやすくします。AIが提案した切り口（分け方の軸）とグループを確認し、必要に応じて編集しながら、各グループの特徴を整理しましょう。
      </p>

      {/* 切り口の選び方ヒント（再提案ボタンの上） */}
      <Accordion type="single" collapsible className="mb-4">
        <AccordionItem value="guide" className="border-none">
          <AccordionTrigger className="py-2 text-sm font-medium text-ds-app-accent hover:no-underline gap-1.5 [&>svg]:h-4 [&>svg]:w-4">
            <span className="flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4 text-ds-app-accent" />
              切り口の選び方ヒント（例で見る）
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <MapPin className="h-4 w-4 text-ds-app-accent" />
                  <span className="text-sm font-semibold text-gray-800">場所で分ける（地理的）</span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">地域・都道府県・都市規模・気候など</p>
                <p className="mt-2 rounded-md bg-blue-100 px-2.5 py-2 text-[12px] leading-relaxed text-blue-700"><span className="font-medium">例：</span>「都心の若手経営者」「地方の老舗メーカー」</p>
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Users className="h-4 w-4 text-ds-app-accent" />
                  <span className="text-sm font-semibold text-gray-800">属性で分ける（デモグラフィック）</span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">年齢・性別・職業・年収・企業規模・業種など</p>
                <p className="mt-2 rounded-md bg-blue-100 px-2.5 py-2 text-[12px] leading-relaxed text-blue-700"><span className="font-medium">例：</span>「従業員50名以下のIT企業」「30代女性経営者」</p>
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Heart className="h-4 w-4 text-ds-app-accent" />
                  <span className="text-sm font-semibold text-gray-800">価値観で分ける（サイコグラフィック）</span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">ライフスタイル・価値観・こだわり・関心ごと</p>
                <p className="mt-2 rounded-md bg-blue-100 px-2.5 py-2 text-[12px] leading-relaxed text-blue-700"><span className="font-medium">例：</span>「デザインに本気の経営者」「効率重視の現場主義」</p>
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Activity className="h-4 w-4 text-ds-app-accent" />
                  <span className="text-sm font-semibold text-gray-800">行動で分ける</span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">購買頻度・利用シーン・ブランドロイヤルティ</p>
                <p className="mt-2 rounded-md bg-blue-100 px-2.5 py-2 text-[12px] leading-relaxed text-blue-700"><span className="font-medium">例：</span>「リピート率の高い既存客」「初回相談の見込み客」</p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">
          {/* 見出し＋AI提案ボタン（同じ行・右端） */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-bold text-gray-800">市場の切り口</h2>
            {!aiLoading && (
              <AIButton size="sm" onClick={handleRegenerate} className="shrink-0">
                {variables.length > 0 ? 'AIで再提案' : 'AIで提案生成'}
              </AIButton>
            )}
          </div>

      {/* AIエラー表示 */}
      {aiError && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {aiError}
          <button
            onClick={fetchAISuggestion}
            className="ml-2 font-medium underline hover:no-underline"
          >
            再試行
          </button>
        </div>
      )}

      {/* ローディング（AIモード） */}
      {aiLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border bg-white p-5">
              <Skeleton className="mb-4 h-5 w-32" />
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          ))}
          <p className="text-center text-sm text-gray-400">
            AIが市場の分け方を分析中...
          </p>
        </div>
      )}

          {/* 変数グループ一覧 */}
          {!aiLoading && (
            <div className="space-y-5">
              {variables.map((variable, varIndex) => (
                <div
                  key={varIndex}
                  className="rounded-lg border border-gray-200 bg-white p-5"
                >
                  {/* 変数名ヘッダー */}
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      aria-hidden
                      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${VAR_BADGE_COLORS[varIndex] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {String.fromCharCode(65 + varIndex)}
                    </span>
                    <Input
                      value={variable.name}
                      onChange={(e) => updateVariableName(varIndex, e.target.value)}
                      placeholder="例: 企業規模、業種、予算規模、課題意識"
                      className="h-10 flex-1 text-sm font-bold"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => removeVariable(varIndex)}
                      className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                      title="切り口を削除"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                  {/* 選定理由（AI提案時） */}
                  {variable.reason && (
                    <p className="mb-4 text-sm text-gray-500 italic pl-1">{variable.reason}</p>
                  )}
                  {!variable.reason && <div className="mb-3" />}

              {/* セグメントカード一覧（2列グリッド） */}
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {variable.segments.map((segment, segIndex) => (
                  <div
                    key={segIndex}
                    className="relative space-y-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5"
                  >
                    {/* 削除ボタン（右上） */}
                    <button
                      type="button"
                      onClick={() => removeSegment(varIndex, segIndex)}
                      className="absolute right-1.5 top-1.5 text-gray-300 hover:text-red-500"
                      title="グループを削除"
                    >
                      <Trash2 size={12} />
                    </button>

                    {/* グループ名＋規模感バッジ */}
                    <div className="flex items-center gap-2 pr-6">
                      <Input
                        value={segment.name}
                        onChange={(e) =>
                          updateSegment(varIndex, segIndex, 'name', e.target.value)
                        }
                        placeholder="グループ名"
                        className="h-8 flex-1 text-sm font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = segment.size_hint === '大' ? '中' : segment.size_hint === '中' ? '小' : '大'
                          updateSegment(varIndex, segIndex, 'size_hint', next)
                        }}
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
                          segment.size_hint === '大'
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : segment.size_hint === '中'
                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        title="規模感（クリックで切替）"
                      >
                        規模: {segment.size_hint}
                      </button>
                    </div>

                    {/* 説明 */}
                    <AutoResizeTextarea
                      value={segment.description}
                      onChange={(e) =>
                        updateSegment(varIndex, segIndex, 'description', e.target.value)
                      }
                      placeholder="説明（50字以内）"
                      maxLength={50}
                      className="text-xs min-h-[34px]"
                    />

                    {/* 重視すること */}
                    <AutoResizeTextarea
                      value={segment.priorities || ''}
                      onChange={(e) =>
                        updateSegment(varIndex, segIndex, 'priorities', e.target.value)
                      }
                      placeholder="重視すること（例: スピード、低コスト）"
                      className="text-[11px] min-h-[34px]"
                    />
                  </div>
                ))}
              </div>

                  {/* セグメント追加ボタン */}
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addSegment(varIndex)}
                      className="text-sm"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      グループを追加
                    </Button>
                  </div>
                </div>
          ))}

              {/* 変数追加ボタン */}
              {!aiLoading && (
                <button
                  type="button"
                  onClick={addVariable}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-200 py-4 text-sm text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
                >
                  <Plus className="h-4 w-4" />
                  切り口を追加
                </button>
              )}
            </div>
          )}

        </CardContent>
      </Card>

      {/* フッターナビゲーション */}
      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-4 flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="h-14 gap-2 px-6 text-base font-bold">
          <ArrowLeft className="h-4 w-4" />
          戻る
        </Button>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleNext}
            disabled={saving || !hasSegment || aiLoading}
            className="h-14 gap-2 px-6 text-base font-bold"
          >
            {saving ? '保存中...' : 'ターゲティングへ'}
            {!saving && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* AI再提案の確認ダイアログ */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認</AlertDialogTitle>
            <AlertDialogDescription>
              現在の内容が上書きされます。よろしいですか？
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
