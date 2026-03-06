'use client'

// Step 3: ターゲティング（セグメント評価 → メイン/サブターゲット選択）
import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

// 型定義
interface SegmentSource {
  name: string
  description: string
  size_hint: '大' | '中' | '小'
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

interface Evaluation {
  segment_name: string
  attractiveness: number
  competitiveness: number
  priority: '高' | '中' | '低'
}

interface TargetingData {
  evaluations: Evaluation[]
  main_target: string
  sub_targets: string[]
  target_description: string
}

interface Step3Props {
  segmentation: SegmentationData
  targeting: TargetingData
  onNext: (data: TargetingData) => Promise<boolean>
  onBack: () => void
  onSaveField: (data: TargetingData) => Promise<void>
}

// 優先度バッジ
const PRIORITIES: Array<{ value: '高' | '中' | '低'; color: string }> = [
  { value: '高', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: '中', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: '低', color: 'bg-gray-100 text-gray-500 border-gray-200' },
]

// Step2からselected=trueのセグメントを抽出
function extractSelectedSegments(segmentation: SegmentationData): Array<{ name: string; description: string }> {
  const segments: Array<{ name: string; description: string }> = []
  for (const variable of segmentation.variables || []) {
    for (const seg of variable.segments || []) {
      if (seg.selected && seg.name.trim()) {
        segments.push({ name: seg.name, description: seg.description })
      }
    }
  }
  return segments
}

// 既存evaluationsとselectedセグメントを整合（クリーンアップ + 新規追加）
function reconcileEvaluations(
  existing: Evaluation[],
  selectedSegments: Array<{ name: string }>
): Evaluation[] {
  const selectedNames = new Set(selectedSegments.map((s) => s.name))
  // 存在するセグメントだけ残す
  const kept = existing.filter((e) => selectedNames.has(e.segment_name))
  const keptNames = new Set(kept.map((e) => e.segment_name))
  // 新規セグメントにデフォルト評価を追加
  const added = selectedSegments
    .filter((s) => !keptNames.has(s.name))
    .map((s) => ({
      segment_name: s.name,
      attractiveness: 3,
      competitiveness: 3,
      priority: '中' as const,
    }))
  return [...kept, ...added]
}

export function Step3Targeting({
  segmentation,
  targeting,
  onNext,
  onBack,
  onSaveField,
}: Step3Props) {
  // Step2から選択済みセグメントを抽出
  const selectedSegments = useMemo(
    () => extractSelectedSegments(segmentation),
    [segmentation]
  )

  // 評価データ（整合性チェック済み）
  const [evaluations, setEvaluations] = useState<Evaluation[]>(() =>
    reconcileEvaluations(targeting.evaluations || [], selectedSegments)
  )
  const [mainTarget, setMainTarget] = useState(targeting.main_target || '')
  const [subTargets, setSubTargets] = useState<string[]>(targeting.sub_targets || [])
  const [targetDescription, setTargetDescription] = useState(targeting.target_description || '')
  const [saving, setSaving] = useState(false)

  // デバウンス
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 現在のデータ
  const getCurrentData = useCallback((): TargetingData => ({
    evaluations,
    main_target: mainTarget,
    sub_targets: subTargets,
    target_description: targetDescription,
  }), [evaluations, mainTarget, subTargets, targetDescription])

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
  }, [evaluations, mainTarget, subTargets, targetDescription])

  // mainTarget / subTargets が現在のセグメントに存在するかチェック
  useEffect(() => {
    const segNames = new Set(selectedSegments.map((s) => s.name))
    if (mainTarget && !segNames.has(mainTarget)) {
      setMainTarget('')
    }
    setSubTargets((prev) => prev.filter((s) => segNames.has(s)))
  }, [selectedSegments, mainTarget])

  // スコア順ソート
  const sortedEvaluations = useMemo(() => {
    return [...evaluations].sort(
      (a, b) =>
        b.attractiveness * b.competitiveness - a.attractiveness * a.competitiveness
    )
  }, [evaluations])

  // セグメント説明を名前で引く
  const segDescMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of selectedSegments) map.set(s.name, s.description)
    return map
  }, [selectedSegments])

  // 評価更新
  const updateEval = (segmentName: string, field: keyof Evaluation, value: number | string) => {
    setEvaluations((prev) =>
      prev.map((e) =>
        e.segment_name === segmentName ? { ...e, [field]: value } : e
      )
    )
  }

  // サブターゲット切替
  const toggleSubTarget = (name: string) => {
    setSubTargets((prev) => {
      if (prev.includes(name)) {
        return prev.filter((s) => s !== name)
      }
      if (prev.length >= 2) {
        toast.error('サブターゲットは2つまでです')
        return prev
      }
      return [...prev, name]
    })
  }

  const handleNext = async () => {
    setSaving(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const success = await onNext(getCurrentData())
    if (!success) setSaving(false)
  }

  // セグメントが0個の場合
  if (selectedSegments.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">ターゲティング</h2>
        </div>
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white">
          <p className="text-sm text-gray-500">
            Step2でセグメントを1つ以上選択してください
          </p>
          <Button variant="outline" onClick={onBack} className="mt-4 gap-1">
            <ChevronLeft className="h-4 w-4" />
            Step2に戻る
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* ヘッダー */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">ターゲティング</h2>
        <p className="mt-1 text-sm text-gray-500">
          各セグメントを評価し、狙うべきターゲットを決めましょう
        </p>
      </div>

      {/* セグメント評価テーブル */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-gray-700">セグメント評価</h3>
        <div className="space-y-3">
          {sortedEvaluations.map((ev) => (
            <div
              key={ev.segment_name}
              className="rounded-xl border bg-white p-4"
            >
              {/* セグメント名・説明 */}
              <div className="mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">
                    {ev.segment_name}
                  </span>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                    {ev.attractiveness * ev.competitiveness}pt
                  </span>
                </div>
                {segDescMap.get(ev.segment_name) && (
                  <p className="mt-0.5 text-xs text-gray-500">
                    {segDescMap.get(ev.segment_name)}
                  </p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {/* 市場の魅力度 */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">市場の魅力度</span>
                    <span className="text-xs font-bold text-gray-900">{ev.attractiveness}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400">低い</span>
                    <Slider
                      value={[ev.attractiveness]}
                      onValueChange={([val]) => updateEval(ev.segment_name, 'attractiveness', val)}
                      min={1}
                      max={5}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-[10px] text-gray-400">高い</span>
                  </div>
                </div>

                {/* 自社の競争力 */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">自社の競争力</span>
                    <span className="text-xs font-bold text-gray-900">{ev.competitiveness}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400">弱い</span>
                    <Slider
                      value={[ev.competitiveness]}
                      onValueChange={([val]) => updateEval(ev.segment_name, 'competitiveness', val)}
                      min={1}
                      max={5}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-[10px] text-gray-400">強い</span>
                  </div>
                </div>
              </div>

              {/* 優先度バッジ */}
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs font-medium text-gray-600">優先度:</span>
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => updateEval(ev.segment_name, 'priority', p.value)}
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                      ev.priority === p.value
                        ? p.color
                        : 'border-gray-100 bg-gray-50 text-gray-300'
                    }`}
                  >
                    {p.value}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ターゲット選択 */}
      <div className="space-y-6 border-t pt-6">
        {/* メインターゲット */}
        <div>
          <h3 className="text-sm font-bold text-gray-700">メインターゲット</h3>
          <p className="mt-1 text-xs text-gray-500">
            最も注力するセグメントを1つ選んでください
          </p>
          <div className="mt-3 space-y-2">
            {sortedEvaluations.map((ev) => (
              <button
                key={ev.segment_name}
                type="button"
                onClick={() => setMainTarget(ev.segment_name)}
                className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                  mainTarget === ev.segment_name
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                    mainTarget === ev.segment_name
                      ? 'border-blue-500'
                      : 'border-gray-300'
                  }`}
                >
                  {mainTarget === ev.segment_name && (
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                  )}
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900">
                    {ev.segment_name}
                  </span>
                  {segDescMap.get(ev.segment_name) && (
                    <p className="text-xs text-gray-500">
                      {segDescMap.get(ev.segment_name)}
                    </p>
                  )}
                </div>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                  {ev.attractiveness * ev.competitiveness}pt
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* サブターゲット */}
        <div>
          <h3 className="text-sm font-bold text-gray-700">サブターゲット</h3>
          <p className="mt-1 text-xs text-gray-500">
            補助的に狙うセグメントを選んでください（任意、最大2つ）
          </p>
          <div className="mt-3 space-y-2">
            {sortedEvaluations
              .filter((ev) => ev.segment_name !== mainTarget)
              .map((ev) => (
                <button
                  key={ev.segment_name}
                  type="button"
                  onClick={() => toggleSubTarget(ev.segment_name)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                    subTargets.includes(ev.segment_name)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <Checkbox
                    checked={subTargets.includes(ev.segment_name)}
                    onCheckedChange={() => toggleSubTarget(ev.segment_name)}
                    className="pointer-events-none"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900">
                      {ev.segment_name}
                    </span>
                    {segDescMap.get(ev.segment_name) && (
                      <p className="text-xs text-gray-500">
                        {segDescMap.get(ev.segment_name)}
                      </p>
                    )}
                  </div>
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* ターゲット定義テキスト */}
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <label className="text-sm font-bold text-gray-700">ターゲットの詳細定義</label>
          <span className="text-xs text-gray-400">（任意）</span>
        </div>
        <Textarea
          value={targetDescription}
          onChange={(e) => setTargetDescription(e.target.value)}
          placeholder="例: 従業員50〜200名の中小製造業で、ブランディングに課題を感じているが、コンサルに頼む予算がない経営者・経営企画担当者"
          rows={4}
          maxLength={500}
        />
      </div>

      {/* フッターナビゲーション */}
      <div className="flex items-center justify-between border-t pt-6">
        <Button variant="outline" onClick={onBack} className="gap-1">
          <ChevronLeft className="h-4 w-4" />
          戻る
        </Button>

        <Button
          onClick={handleNext}
          disabled={saving || !mainTarget}
          className="gap-1"
        >
          {saving ? '保存中...' : '次へ：ポジショニング'}
          {!saving && <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
