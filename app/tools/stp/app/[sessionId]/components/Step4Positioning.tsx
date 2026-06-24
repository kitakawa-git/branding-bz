'use client'

// Step 4: ポジショニング（マップ + スライダー編集）
import { useState, useCallback, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Skeleton } from '@/components/ui/skeleton'
import { InteractivePositioningMap } from '@/components/InteractivePositioningMap'
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
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  ArrowLeftRight,
  ArrowUpDown,
} from 'lucide-react'
import { AIButton } from '@/components/shared/AIButton'

// 型定義
interface PositioningItem {
  name: string
  x: number
  y: number
  color: string
  is_self: boolean
}

interface PositioningData {
  x_axis: { left: string; right: string }
  y_axis: { bottom: string; top: string }
  items: PositioningItem[]
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

interface TargetingData {
  main_target: string
  sub_targets: string[]
  target_description: string
  buying_factors?: string[]
  strengths?: string
  competitor_traits?: string  // 後方互換
  competitors_analysis?: Array<{ name: string; traits: string }>
}

interface Step4Props {
  positioning: PositioningData
  basicInfo: BasicInfo
  targeting: TargetingData
  onNext: (data: PositioningData) => Promise<boolean>
  onBack: () => void
  onSaveField: (data: PositioningData) => Promise<void>
}

// ランダムカラー生成（被りにくい色）
const PRESET_COLORS = [
  '#EF4444', '#F97316', '#10B981', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F59E0B', '#6366F1',
]

function getRandomColor(existingColors: string[]): string {
  const available = PRESET_COLORS.filter((c) => !existingColors.includes(c))
  if (available.length > 0) {
    return available[Math.floor(Math.random() * available.length)]
  }
  // フォールバック: ランダムHex
  return '#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0')
}

export function Step4Positioning({
  positioning,
  basicInfo,
  targeting,
  onNext,
  onBack,
  onSaveField,
}: Step4Props) {
  const hasInitialData =
    positioning.items?.length > 0 &&
    (positioning.x_axis?.left || positioning.x_axis?.right)

  const [xAxis, setXAxis] = useState(positioning.x_axis || { left: '', right: '' })
  const [yAxis, setYAxis] = useState(positioning.y_axis || { bottom: '', top: '' })
  const [items, setItems] = useState<PositioningItem[]>(positioning.items || [])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [saving, setSaving] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aiRequestedRef = useRef(false)

  // 現在のデータ
  const getCurrentData = useCallback((): PositioningData => ({
    x_axis: xAxis,
    y_axis: yAxis,
    items,
  }), [xAxis, yAxis, items])

  // オートセーブ（1秒デバウンス）
  const triggerAutoSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onSaveField(getCurrentData())
    }, 1000)
  }, [getCurrentData, onSaveField])

  // 値変更時にオートセーブ
  useEffect(() => {
    if (items.length > 0 || xAxis.left || xAxis.right || yAxis.top || yAxis.bottom) {
      triggerAutoSave()
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xAxis, yAxis, items])

  // AI提案取得
  const fetchAISuggestion = useCallback(async () => {
    setAiLoading(true)
    setAiError('')
    try {
      const res = await fetch('/api/tools/stp/suggest-positioning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ basic_info: basicInfo, targeting }),
      })
      if (!res.ok) {
        const data = await res.json()
        setAiError(data.error || 'AI提案の取得に失敗しました')
        return
      }
      const data = await res.json()
      setXAxis(data.x_axis)
      setYAxis(data.y_axis)
      setItems(data.items)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setAiLoading(false)
    }
  }, [basicInfo, targeting])

  // 初回自動リクエスト（データなしの場合のみ）
  useEffect(() => {
    if (!hasInitialData && !aiRequestedRef.current) {
      aiRequestedRef.current = true
      fetchAISuggestion()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 再提案
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleRegenerate = () => {
    if (items.length > 0) {
      setConfirmOpen(true)
      return
    }
    fetchAISuggestion()
  }

  // --- 要素操作 ---
  const addItem = () => {
    const existingColors = items.map((i) => i.color)
    setItems((prev) => [
      ...prev,
      {
        name: '',
        x: 50,
        y: 50,
        color: getRandomColor(existingColors),
        is_self: false,
      },
    ])
  }

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, patch: Partial<PositioningItem>) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    )
  }

  // 選択中の要素（チャート/リスト/詳細スライダーで連動）
  const [selectedIdx, setSelectedIdx] = useState<number | null>(items.length > 0 ? 0 : null)
  // 要素削除やAI再生成で選択が範囲外になったら補正
  useEffect(() => {
    if (selectedIdx !== null && selectedIdx >= items.length) {
      setSelectedIdx(items.length > 0 ? 0 : null)
    }
  }, [items.length, selectedIdx])

  const handleItemMove = useCallback((idx: number, x: number, y: number) => {
    updateItem(idx, { x, y })
  }, [])

  // バリデーション
  const isValid =
    xAxis.left.trim() !== '' &&
    xAxis.right.trim() !== '' &&
    yAxis.bottom.trim() !== '' &&
    yAxis.top.trim() !== '' &&
    items.length >= 2

  const handleNext = async () => {
    setSaving(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const success = await onNext(getCurrentData())
    if (!success) setSaving(false)
  }

  return (
    <div>
      {/* ヘッダー（AIボタンは見出し直下・左寄せ） */}
      <h1 className="text-2xl font-bold text-foreground mb-2">Step 4: ポジショニング</h1>
      <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">2軸で競合と自社の立ち位置を可視化するマップ。点を<b className="font-medium text-foreground">ドラッグ</b>か<b className="font-medium text-foreground">スライダー</b>で配置できます。</p>
      {!aiLoading && (
        <div className="mb-4 flex justify-start">
          <AIButton size="s" onClick={handleRegenerate} className="shrink-0">
            AIで提案生成
          </AIButton>
        </div>
      )}

      {/* AIエラー */}
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

      {/* ローディング */}
      {aiLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="aspect-[4/3] w-full rounded-xl" />
          <p className="text-center text-sm text-gray-400">
            AIがポジショニングを分析中...
          </p>
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border border-border bg-[hsl(0_0%_97%)] p-4">
          {/* 1. 要素リスト（2カラム）：まず要素を確認・命名 */}
          <div>
            <div className="mb-2 text-xs font-semibold text-muted-foreground">
              要素（{items.length}社）
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {items.map((item, index) => (
                <div
                  key={index}
                  onClick={() => setSelectedIdx(index)}
                  className={`flex items-center gap-2 rounded-lg border p-2.5 transition-all cursor-pointer ${
                    selectedIdx === index
                      ? 'border-ds-app-accent bg-ds-app-accent/5 ring-1 ring-ds-app-accent'
                      : 'border-border bg-card hover:border-muted-foreground'
                  }`}
                >
                  <input
                    type="color"
                    value={item.color}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateItem(index, { color: e.target.value })}
                    className="h-5 w-5 shrink-0 cursor-pointer rounded border border-gray-200 p-0.5"
                  />
                  <Input
                    value={item.name}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateItem(index, { name: e.target.value })}
                    placeholder="項目名"
                    className="h-7 min-w-0 flex-1 text-xs"
                  />
                  <span className="whitespace-nowrap font-mono text-[10px] text-muted-foreground">x:{item.x} y:{item.y}</span>
                  {item.is_self && (
                    <span className="shrink-0 rounded bg-ds-app-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-ds-app-accent">自社</span>
                  )}
                  {items.length > 2 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeItem(index) }}
                      className="shrink-0 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <Button variant="outline" onClick={addItem} className="mt-2 w-full gap-2">
              <Plus className="h-4 w-4" />
              要素を追加
            </Button>
          </div>

          {/* 2. 選択中要素の詳細スライダー（要素のすぐ下・選択中のみ） */}
          {selectedIdx !== null && items[selectedIdx] && (
            <div className="space-y-3 rounded-lg border border-ds-app-accent bg-ds-app-accent/5 p-3">
              <div className="text-xs font-bold text-ds-app-accent">編集中: {items[selectedIdx].name || `要素${selectedIdx + 1}`}</div>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>{xAxis.left || 'X左'}</span><span>{xAxis.right || 'X右'}</span>
                </div>
                <Slider value={[items[selectedIdx].x]} onValueChange={([v]) => updateItem(selectedIdx, { x: v })} min={0} max={100} step={1} />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>{yAxis.bottom || 'Y下'}</span><span>{yAxis.top || 'Y上'}</span>
                </div>
                <Slider value={[items[selectedIdx].y]} onValueChange={([v]) => updateItem(selectedIdx, { y: v })} min={0} max={100} step={1} />
              </div>
            </div>
          )}

          {/* 3. チャート＋軸設定オーバーレイ（全幅・ドラッグで配置） */}
          <div className="relative rounded-lg border border-border bg-card p-3">
            {/* 軸設定オーバーレイ */}
            <div className="absolute left-3 right-3 top-3 z-10 space-y-1.5 rounded-md border border-border bg-white/95 p-2 text-xs shadow-sm">
              <div className="flex items-center gap-1.5">
                <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <Input value={xAxis.left} onChange={(e) => setXAxis((prev) => ({ ...prev, left: e.target.value }))} placeholder="左端" className="h-7 min-w-0 flex-1 text-xs" />
                <span className="text-muted-foreground">↔</span>
                <Input value={xAxis.right} onChange={(e) => setXAxis((prev) => ({ ...prev, right: e.target.value }))} placeholder="右端" className="h-7 min-w-0 flex-1 text-xs" />
              </div>
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <Input value={yAxis.bottom} onChange={(e) => setYAxis((prev) => ({ ...prev, bottom: e.target.value }))} placeholder="下端" className="h-7 min-w-0 flex-1 text-xs" />
                <span className="text-muted-foreground">↕</span>
                <Input value={yAxis.top} onChange={(e) => setYAxis((prev) => ({ ...prev, top: e.target.value }))} placeholder="上端" className="h-7 min-w-0 flex-1 text-xs" />
              </div>
            </div>

            <InteractivePositioningMap
              items={items}
              axes={{ x_axis: xAxis, y_axis: yAxis }}
              selectedIdx={selectedIdx}
              onItemMove={handleItemMove}
              onItemSelect={setSelectedIdx}
              className="mt-[68px]"
            />
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
          disabled={saving || !isValid || aiLoading}
          className="h-14 gap-2 px-6 text-base font-bold"
        >
          {saving ? '保存中...' : '確認・出力へ'}
          {!saving && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>

      {/* AI再提案の確認ダイアログ */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認</AlertDialogTitle>
            <AlertDialogDescription>
              現在の軸と配置が上書きされます。よろしいですか？
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
