'use client'

// Step 2: セグメンテーション（AI提案 / 手動入力）
import { useState, useCallback, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { ChevronLeft, ChevronRight, Plus, Trash2, Sparkles, RefreshCw } from 'lucide-react'

// 型定義
interface Segment {
  name: string
  description: string
  size_hint: '大' | '中' | '小'
  selected: boolean
}

interface Variable {
  name: string
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

// 市場規模感バッジ
const SIZE_HINTS: Array<{ value: '大' | '中' | '小'; color: string }> = [
  { value: '大', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: '中', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: '小', color: 'bg-gray-100 text-gray-500 border-gray-200' },
]

function SizeHintBadge({
  value,
  onClick,
}: {
  value: '大' | '中' | '小'
  onClick: () => void
}) {
  const hint = SIZE_HINTS.find((h) => h.value === value) || SIZE_HINTS[2]
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors hover:opacity-80 ${hint.color}`}
      title="クリックで切替"
    >
      {value}
    </button>
  )
}

export function Step2Segmentation({
  segmentation,
  basicInfo,
  onNext,
  onBack,
  onSaveField,
}: Step2Props) {
  // 既存データがあればそれを使い、なければ空
  const [mode, setMode] = useState<'ai' | 'manual'>(segmentation.mode || 'ai')
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
        (v: { name: string; segments: Array<{ name: string; description: string; size_hint: string }> }) => ({
          name: v.name,
          segments: v.segments.map(
            (s: { name: string; description: string; size_hint: string }) => ({
              ...s,
              size_hint: s.size_hint || '中',
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

  // AIモードで初回マウント時、データがなければ自動リクエスト
  useEffect(() => {
    if (mode === 'ai' && variables.length === 0 && !aiRequestedRef.current) {
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
  const handleRegenerate = () => {
    if (variables.length > 0) {
      const ok = window.confirm('現在の内容が上書きされます。よろしいですか？')
      if (!ok) return
    }
    fetchAISuggestion()
  }

  // モード切替
  const handleModeChange = (newMode: 'ai' | 'manual') => {
    setMode(newMode)
    // モード変更時にオートセーブ
    if (debounceRef.current) clearTimeout(debounceRef.current)
    onSaveField({ mode: newMode, variables })
  }

  // --- 変数操作 ---
  const addVariable = () => {
    updateVariables((prev) => [
      ...prev,
      { name: '', segments: [{ name: '', description: '', size_hint: '中', selected: true }] },
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
                { name: '', description: '', size_hint: '中' as const, selected: true },
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

  const cycleSizeHint = (varIndex: number, segIndex: number) => {
    const current = variables[varIndex].segments[segIndex].size_hint
    const order: Array<'大' | '中' | '小'> = ['大', '中', '小']
    const nextIdx = (order.indexOf(current) + 1) % order.length
    updateSegment(varIndex, segIndex, 'size_hint', order[nextIdx])
  }

  // バリデーション: selected=true のセグメントが1つ以上
  const hasSelectedSegment = variables.some((v) =>
    v.segments.some((s) => s.selected)
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
      <h1 className="text-2xl font-bold text-foreground mb-6">Step 2: セグメンテーション</h1>

      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">
          <p className="mb-5 text-[13px] text-muted-foreground">
            市場をどのような切り口で分けるか定義しましょう
          </p>

          {/* モード切替タブ */}
      <div className="flex rounded-lg border bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => handleModeChange('ai')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            mode === 'ai'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          AIに提案してもらう
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('manual')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            mode === 'manual'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          自分で入力する
        </button>
      </div>

      {/* AI再提案ボタン（AIモード時） */}
      {mode === 'ai' && !aiLoading && variables.length > 0 && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            AIに再提案してもらう
          </Button>
        </div>
      )}

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
            AIがセグメンテーションを分析中...
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
                  <div className="mb-4 flex items-center gap-2">
                    <Input
                      value={variable.name}
                      onChange={(e) => updateVariableName(varIndex, e.target.value)}
                      placeholder="変数名（例: 購買動機）"
                      className="h-10 flex-1 text-sm font-bold"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeVariable(varIndex)}
                      className="shrink-0 h-9 w-9 p-0 text-gray-400 hover:text-red-500"
                      title="変数を削除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

              {/* セグメントカード一覧 */}
              <div className="space-y-3">
                {variable.segments.map((segment, segIndex) => (
                  <div
                    key={segIndex}
                    className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                      segment.selected
                        ? 'border-gray-200 bg-white'
                        : 'border-gray-100 bg-gray-50 opacity-60'
                    }`}
                  >
                    {/* チェックボックス */}
                    <div className="pt-1">
                      <Checkbox
                        checked={segment.selected}
                        onCheckedChange={(checked) =>
                          updateSegment(varIndex, segIndex, 'selected', !!checked)
                        }
                      />
                    </div>

                    {/* セグメント内容 */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={segment.name}
                          onChange={(e) =>
                            updateSegment(varIndex, segIndex, 'name', e.target.value)
                          }
                          placeholder="セグメント名"
                          className="h-8 flex-1 text-sm font-medium"
                        />
                        <SizeHintBadge
                          value={segment.size_hint}
                          onClick={() => cycleSizeHint(varIndex, segIndex)}
                        />
                      </div>
                      <Input
                        value={segment.description}
                        onChange={(e) =>
                          updateSegment(varIndex, segIndex, 'description', e.target.value)
                        }
                        placeholder="説明（50字以内）"
                        maxLength={50}
                        className="h-8 text-xs text-gray-600"
                      />
                    </div>

                    {/* 削除ボタン */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSegment(varIndex, segIndex)}
                      className="shrink-0 h-8 w-8 p-0 text-gray-400 hover:text-red-500"
                      title="セグメントを削除"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
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
                      セグメントを追加
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
                  変数を追加
                </button>
              )}
            </div>
          )}

        </CardContent>
      </Card>

      {/* フッターナビゲーション */}
      <div className="mt-6 flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="gap-1">
          <ChevronLeft className="h-4 w-4" />
          戻る
        </Button>

        <Button
          onClick={handleNext}
          disabled={saving || !hasSelectedSegment || aiLoading}
          className="gap-1"
        >
          {saving ? '保存中...' : '次へ：ターゲティング'}
          {!saving && <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
