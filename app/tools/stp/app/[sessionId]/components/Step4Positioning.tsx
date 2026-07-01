'use client'

// Step 4: ポジショニング（マップ + スライダー編集）
import { useState, useCallback, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { StepProgressPanel } from '@/components/stp/StepProgressLoader'
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
  X,
  Loader2,
} from 'lucide-react'
import { AIButton } from '@/components/shared/AIButton'
import { FieldHeading, FieldSubLabel } from '@/components/shared/FieldHeading'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import type { BrandStanceStatement } from '../page'

// 型定義
interface PositioningItem {
  name: string
  x: number
  y: number
  color: string
  is_self: boolean
  reasoning?: string  // AIによる配置根拠（1文）
  confidence?: 'high' | 'medium' | 'low'  // 配置の確からしさ
}

interface PositioningData {
  x_axis: { left: string; right: string }
  y_axis: { bottom: string; top: string }
  items: PositioningItem[]
  axis_rationale?: string  // なぜこの2軸を選んだか（1〜2文）
}

// セグメンテーション（Step2 / Step3Targeting と同型。軸選定ヒントとして positioning へ渡す）
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
  sessionId: string
  positioning: PositioningData
  basicInfo: BasicInfo
  targeting: TargetingData
  segmentation: SegmentationData
  brandStance?: BrandStanceStatement[]
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
  sessionId,
  positioning,
  basicInfo,
  targeting,
  segmentation,
  brandStance: initialBrandStance,
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
  const [axisRationale, setAxisRationale] = useState(positioning.axis_rationale || '')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [saving, setSaving] = useState(false)

  // 自社の立ち位置（ターゲット別ポジショニング文）。Step4で生成し、Step5は表示のみ。
  const [brandStance, setBrandStance] = useState<BrandStanceStatement[]>(initialBrandStance || [])
  const [stanceLoading, setStanceLoading] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aiRequestedRef = useRef(false)
  const stanceRequestedRef = useRef(false)

  // 現在のデータ
  const getCurrentData = useCallback((): PositioningData => ({
    x_axis: xAxis,
    y_axis: yAxis,
    items,
    axis_rationale: axisRationale || undefined,
  }), [xAxis, yAxis, items, axisRationale])

  // 自社の立ち位置を生成（現在のポジショニングを踏まえる）。セッションへ保存し、Step5で表示される。
  const generateBrandStance = useCallback(async () => {
    if (!targeting.main_target) return
    setStanceLoading(true)
    try {
      const res = await fetch('/api/tools/stp/suggest-brand-stance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ basic_info: basicInfo, targeting, positioning: getCurrentData() }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error((d as { error?: string }).error || '自社の立ち位置の生成に失敗しました')
        return
      }
      const data = await res.json()
      const statements: BrandStanceStatement[] = data.statements || []
      setBrandStance(statements)
      // セッションへ保存（Step5の表示・連携時に読まれる）
      await fetch(`/api/tools/stp/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionData: { brand_stance_statements: { statements } } }),
      }).catch(() => {})
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '生成中にエラーが発生しました')
    } finally {
      setStanceLoading(false)
    }
  }, [sessionId, basicInfo, targeting, getCurrentData])

  // Step4表示時の自動生成: ポジショニングが揃い、未生成なら一度だけ自動生成
  useEffect(() => {
    const positioningReady = items.length >= 2 && !!xAxis.left && !!yAxis.top
    if (
      positioningReady &&
      brandStance.length === 0 &&
      !!targeting.main_target &&
      !stanceRequestedRef.current &&
      !aiLoading &&
      !stanceLoading
    ) {
      stanceRequestedRef.current = true
      generateBrandStance()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, xAxis.left, yAxis.top, aiLoading])

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
        body: JSON.stringify({ basic_info: basicInfo, targeting, segmentation }),
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
      setAxisRationale(data.axis_rationale || '')
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setAiLoading(false)
    }
  }, [basicInfo, targeting, segmentation])

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
      <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">競合と自社を2軸上に並べ、自社だけの独自ポジションを見つけます。AIの軸と配置を確認し、点を動かして調整しましょう。</p>

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

      {/* ローディング（共通のステップ進捗パネル） */}
      {aiLoading ? (
        <StepProgressPanel
          steps={[
            { label: '軸を選定' },
            { label: '競合の特徴を分析' },
            { label: '配置を決定' },
            { label: '配置根拠を生成' },
          ]}
          stepDuration={1500}
          done={false}
        />
      ) : (
        <div className="space-y-4 rounded-lg border border-border bg-[hsl(0_0%_97%)] p-4">
          <div className="flex items-center justify-between gap-2">
            <FieldHeading className="mb-0">自社・競合の一覧</FieldHeading>
            <AIButton size="sm" onClick={handleRegenerate} className="shrink-0">
              AIで提案生成
            </AIButton>
          </div>
          {/* 1. 要素リスト（2カラム）：まず要素を確認・命名。背景白のカードで括る */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <FieldSubLabel>要素（{items.length}社）</FieldSubLabel>
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
                    className="h-5 w-5 shrink-0 cursor-pointer rounded-full border border-gray-200 p-0.5"
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
                  {item.confidence === 'low' && (
                    <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                      データ不足
                    </span>
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
            <Button variant="outline" onClick={addItem} className="mt-3 w-full gap-2">
              <Plus className="h-4 w-4" />
              競合を追加
            </Button>
          </div>

          {/* ポジショニングマップ：見出し＋チャートを背景白のカードで括る */}
          <div className="!mt-6 rounded-lg border border-gray-200 bg-white p-4">
          <FieldHeading className="mb-3">ポジショニングマップ</FieldHeading>
          {/* 3. チャート＋軸設定オーバーレイ（全幅・ドラッグで配置）。
              padding は外側の白カード(p-4)と二重になるため付けない。flex-col でフレックス子のマージン相殺を防ぎ、根拠文の mt-[90px]（オーバーレイ回避）を効かせる。 */}
          <div className="relative flex flex-col">
            {/* 軸設定オーバーレイ */}
            <div className="absolute left-0 right-0 top-0 z-10 space-y-1.5 rounded-md border border-border bg-white/95 p-2 text-xs shadow-sm">
              {/* grid-cols-[1fr_auto_1fr] で中央の矢印をカード中心に固定（先頭アイコンは左セル内に格納） */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
                <div className="flex min-w-0 items-center gap-1.5">
                  <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <Input value={xAxis.left} onChange={(e) => setXAxis((prev) => ({ ...prev, left: e.target.value }))} placeholder="左端" className="h-7 min-w-0 flex-1 text-xs" />
                </div>
                <span className="text-muted-foreground">↔</span>
                <Input value={xAxis.right} onChange={(e) => setXAxis((prev) => ({ ...prev, right: e.target.value }))} placeholder="右端" className="h-7 min-w-0 text-xs" />
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
                <div className="flex min-w-0 items-center gap-1.5">
                  <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <Input value={yAxis.bottom} onChange={(e) => setYAxis((prev) => ({ ...prev, bottom: e.target.value }))} placeholder="下端" className="h-7 min-w-0 flex-1 text-xs" />
                </div>
                <span className="text-muted-foreground">↕</span>
                <Input value={yAxis.top} onChange={(e) => setYAxis((prev) => ({ ...prev, top: e.target.value }))} placeholder="上端" className="h-7 min-w-0 text-xs" />
              </div>
            </div>

            {/* 軸選定の根拠（AI生成・軸設定オーバーレイの下、マップの上）。
                オーバーレイは absolute(top-3, 高さ~78px) なので mt-[90px] でその下に流す。 */}
            {axisRationale && (
              <div className="mt-[80px] rounded-md bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                軸選定の根拠: {axisRationale}
              </div>
            )}

            {/* relativeラッパーはSVGと同寸（width100%・aspect4/3）なので、%指定でSVG座標と一致する。 */}
            <div className={`relative ${axisRationale ? 'mt-3' : 'mt-[80px]'}`}>
              <InteractivePositioningMap
                items={items}
                axes={{ x_axis: xAxis, y_axis: yAxis }}
                selectedIdx={selectedIdx}
                onItemMove={handleItemMove}
                onItemSelect={setSelectedIdx}
              />

              {/* 選択中要素の編集フローティングウインドウ（マップ上・選択点の隣に表示） */}
              {selectedIdx !== null && items[selectedIdx] && (() => {
                const sel = items[selectedIdx]
                // InteractivePositioningMap の定数（WIDTH700 HEIGHT525 PAD16）と一致させて点の位置を%換算
                const leftPct = (16 + (sel.x / 100) * 668) / 700 * 100
                const topPct = Math.min(85, Math.max(15, (16 + ((100 - sel.y) / 100) * 493) / 525 * 100))
                const toLeft = sel.x > 55  // 点が右寄りならパネルは点の左側へ
                return (
                  <div
                    className="absolute z-20 w-60 max-w-[72%] space-y-2.5 rounded-lg border border-ds-app-accent bg-white p-3 shadow-lg"
                    style={{
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      transform: `translate(${toLeft ? 'calc(-100% - 32px)' : '32px'}, -50%)`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs font-bold text-ds-app-accent">{sel.name || `要素${selectedIdx + 1}`}</div>
                      <button
                        type="button"
                        onClick={() => setSelectedIdx(null)}
                        className="shrink-0 text-gray-400 hover:text-gray-600"
                        aria-label="閉じる"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {sel.reasoning && (
                      <div className="text-[11px] leading-relaxed text-muted-foreground">
                        AIの配置根拠: {sel.reasoning}
                      </div>
                    )}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>{xAxis.left || 'X左'}</span><span>{xAxis.right || 'X右'}</span>
                      </div>
                      <Slider value={[sel.x]} onValueChange={([v]) => updateItem(selectedIdx, { x: v })} min={0} max={100} step={1} />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>{yAxis.bottom || 'Y下'}</span><span>{yAxis.top || 'Y上'}</span>
                      </div>
                      <Slider value={[sel.y]} onValueChange={([v]) => updateItem(selectedIdx, { y: v })} min={0} max={100} step={1} />
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
          </div>

          {/* 自社の立ち位置（ターゲット別×N。Step4で生成→Step5は表示のみ）。背景白のカードで括る。上余白は space-y を !important で上書きして1段階広げる */}
          <div className="!mt-6 rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <FieldHeading className="mb-0">自社の立ち位置</FieldHeading>
          <AIButton
            size="sm"
            onClick={generateBrandStance}
            disabled={stanceLoading || !targeting.main_target || !isValid}
            icon={stanceLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}
          >
            {stanceLoading ? '生成中…' : brandStance.length > 0 ? 'AIで再生成' : 'AIで自社の立ち位置を生成'}
          </AIButton>
        </div>
        <p className="mb-3 text-[13px] leading-relaxed text-muted-foreground">
          このポジショニングをもとに、各ターゲットに対して自社が何者として刺さるかを言語化します（確認・出力ステップに反映されます）。
        </p>
        {stanceLoading && brandStance.length === 0 ? (
          <StepProgressPanel
            steps={[
              { label: 'ターゲットを整理' },
              { label: '立ち位置を言語化' },
              { label: '根拠をまとめる' },
            ]}
            stepDuration={1500}
            done={false}
            minHeight={160}
          />
        ) : brandStance.length === 0 ? (
          <p className="text-xs text-muted-foreground">ポジショニングが整うと、ターゲット別の立ち位置を自動生成します。</p>
        ) : (
          <div className="mt-3 space-y-3.5">
            {brandStance.map((s, i) => {
              const isMain = s.target_role === 'main'
              return (
                <div
                  key={i}
                  className={`relative rounded-lg px-3 py-2.5 ${
                    isMain
                      ? 'border border-ds-app-accent-soft bg-blue-50/50'
                      : 'border border-blue-300 bg-blue-50/30'
                  }`}
                >
                  {isMain ? (
                    <Badge className="absolute -top-[9px] left-[6px] rounded-full px-1.5 py-0 text-[10px] bg-ds-app-accent text-white hover:bg-ds-app-accent-hover">メインターゲット</Badge>
                  ) : (
                    <Badge variant="outline" className="absolute -top-[9px] left-[6px] rounded-full px-1.5 py-0 text-[10px] border-blue-300 bg-white text-blue-300">サブターゲット</Badge>
                  )}
                  <p className={`text-sm font-bold ${isMain ? 'text-gray-900' : 'text-gray-700'}`}>{s.target_name}</p>
                  <p className="mt-1 text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">{s.statement}</p>
                  {s.rationale && (
                    <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">なぜなら: {s.rationale}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
          </div>
        </div>
      )}

      {/* フッターナビゲーション（軸設定オーバーレイ z-10 より前面に。z-20） */}
      <div className="sticky bottom-0 z-20 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-4 flex items-center justify-between">
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
