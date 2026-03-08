'use client'

// Step 4: ポジショニング（マップ + スライダー編集）
import { useState, useCallback, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Skeleton } from '@/components/ui/skeleton'
import { PositioningMap } from '@/components/PositioningMap'
import type { PositioningMapData } from '@/lib/types/positioning-map'
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
  Sparkles,
  ArrowLeftRight,
  ArrowUpDown,
} from 'lucide-react'

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
  competitor_traits?: string
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

// STPデータ → PositioningMapData への変換
function toMapData(data: PositioningData): PositioningMapData {
  return {
    x_axis: data.x_axis,
    y_axis: data.y_axis,
    items: data.items.map((item) => ({
      name: item.name,
      color: item.color,
      x: item.x,
      y: item.y,
      size: item.is_self ? 'lg' as const : 'md' as const,
    })),
  }
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

  const updateItem = (index: number, field: keyof PositioningItem, value: string | number | boolean) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    )
  }

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
      {/* ヘッダー */}
      <div className="mb-6 flex items-start justify-between">
        <h1 className="text-2xl font-bold text-foreground">Step 4: ポジショニング</h1>
        {!aiLoading && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            className="shrink-0 gap-1.5 text-xs"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AIに提案してもらう
          </Button>
        )}
      </div>

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
        <div className="grid gap-6 lg:grid-cols-2">
          {/* 左: フォーム */}
          <div className="space-y-5">
            {/* 軸設定 */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-bold mb-3">軸の設定</h2>

              {/* X軸 */}
              <div className="mb-3">
                <div className="mb-1.5 flex items-center gap-1 text-xs text-gray-500">
                  <ArrowLeftRight className="h-3 w-3" />
                  X軸
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={xAxis.left}
                    onChange={(e) => setXAxis((prev) => ({ ...prev, left: e.target.value }))}
                    placeholder="左端（例: 低価格）"
                    className="h-8 flex-1 text-xs"
                  />
                  <span className="text-xs text-gray-400">←→</span>
                  <Input
                    value={xAxis.right}
                    onChange={(e) => setXAxis((prev) => ({ ...prev, right: e.target.value }))}
                    placeholder="右端（例: 高価格）"
                    className="h-8 flex-1 text-xs"
                  />
                </div>
              </div>

              {/* Y軸 */}
              <div>
                <div className="mb-1.5 flex items-center gap-1 text-xs text-gray-500">
                  <ArrowUpDown className="h-3 w-3" />
                  Y軸
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={yAxis.bottom}
                    onChange={(e) => setYAxis((prev) => ({ ...prev, bottom: e.target.value }))}
                    placeholder="下端（例: 機能重視）"
                    className="h-8 flex-1 text-xs"
                  />
                  <span className="text-xs text-gray-400">↑↓</span>
                  <Input
                    value={yAxis.top}
                    onChange={(e) => setYAxis((prev) => ({ ...prev, top: e.target.value }))}
                    placeholder="上端（例: デザイン重視）"
                    className="h-8 flex-1 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* 要素リスト */}
            <div className="space-y-3">
              <h2 className="text-sm font-bold mb-3">要素の配置</h2>

              {items.map((item, index) => (
                <div key={index} className="rounded-lg border border-gray-200 bg-white p-4">
                  {/* 項目名・色・削除 */}
                  <div className="mb-3 flex items-center gap-2">
                    <input
                      type="color"
                      value={item.color}
                      onChange={(e) => updateItem(index, 'color', e.target.value)}
                      className="h-7 w-7 shrink-0 cursor-pointer rounded border border-gray-200 p-0.5"
                    />
                    <Input
                      value={item.name}
                      onChange={(e) => updateItem(index, 'name', e.target.value)}
                      placeholder="項目名"
                      className="h-8 flex-1 text-sm font-medium"
                    />
                    {item.is_self && (
                      <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                        自社
                      </span>
                    )}
                    {items.length > 2 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                        className="shrink-0 h-8 w-8 p-0 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  {/* X位置スライダー */}
                  <div className="mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-16 truncate text-[10px] text-gray-400 text-right">
                        {xAxis.left || 'X左'}
                      </span>
                      <Slider
                        value={[item.x]}
                        onValueChange={([val]) => updateItem(index, 'x', val)}
                        min={0}
                        max={100}
                        step={1}
                        className="flex-1"
                      />
                      <span className="w-16 truncate text-[10px] text-gray-400">
                        {xAxis.right || 'X右'}
                      </span>
                    </div>
                  </div>

                  {/* Y位置スライダー */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-16 truncate text-[10px] text-gray-400 text-right">
                        {yAxis.bottom || 'Y下'}
                      </span>
                      <Slider
                        value={[item.y]}
                        onValueChange={([val]) => updateItem(index, 'y', val)}
                        min={0}
                        max={100}
                        step={1}
                        className="flex-1"
                      />
                      <span className="w-16 truncate text-[10px] text-gray-400">
                        {yAxis.top || 'Y上'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {/* 要素追加ボタン */}
              <button
                type="button"
                onClick={addItem}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-200 py-3 text-sm text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
              >
                <Plus className="h-4 w-4" />
                要素を追加
              </button>
            </div>
          </div>

          {/* 右: マッププレビュー */}
          <div className="lg:sticky lg:top-20">
            <h2 className="text-sm font-bold mb-3">プレビュー</h2>
            <div className="rounded-lg border border-gray-200 bg-white p-3" style={{ minHeight: 300 }}>
              <PositioningMap data={toMapData(getCurrentData())} />
            </div>
          </div>
        </div>
      )}

      {/* フッターナビゲーション */}
      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-3 flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          戻る
        </Button>

        <Button
          onClick={handleNext}
          disabled={saving || !isValid || aiLoading}
          className="gap-1"
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
