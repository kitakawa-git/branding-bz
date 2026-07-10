'use client'

// Step 3: ターゲティング（カードクリックでメイン/サブ選択、メインカード内に深掘り展開）
import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import { Slider } from '@/components/ui/slider'
import { ArrowLeft, ArrowRight, Loader2, Lock, Unlock } from 'lucide-react'
import { AIButton } from '@/components/shared/AIButton'
import { TagInput } from '@/components/shared/TagInput'
import { FieldHeading, FieldSubLabel } from '@/components/shared/FieldHeading'
import { StepProgressPanel } from '@/components/stp/StepProgressLoader'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  reason?: string
  axis_type?: 'ordinal' | 'categorical'  // 順序型/カテゴリ型（適合マップの軸候補フィルタに使用）
  axis_endpoints?: { low_label: string; high_label: string } | null  // 順序型の軸両端ラベル
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

// 軸選定方針（C案: 推奨を即生成、他は遅延生成＋キャッシュ）
type StrategyType = 'strategic_vs_dispersion' | 'strengths_vs_dispersion' | 'dispersion_only'

const STRATEGY_LABELS: Record<StrategyType, string> = {
  strategic_vs_dispersion: '戦略 × 分散',
  strengths_vs_dispersion: '強み × 分散',
  dispersion_only: '分散 × 分散',
}
const STRATEGY_DESCRIPTIONS: Record<StrategyType, string> = {
  strategic_vs_dispersion: 'X軸=購買決定要因 / Y軸=ターゲット分離',
  strengths_vs_dispersion: 'X軸=自社の強み / Y軸=ターゲット分離',
  dispersion_only: 'X軸=ターゲット分離 / Y軸=ターゲット分離',
}
const ALL_STRATEGIES: StrategyType[] = ['strategic_vs_dispersion', 'strengths_vs_dispersion', 'dispersion_only']

// ターゲット適合マップ（顧客側軸＋ターゲット点＋自社カバー範囲楕円）
interface TargetFitMapSegment {
  name: string
  variable_name: string
  x: number
  y: number
}

interface TargetFitMapAlternative {
  name: string
  variable_name: string
  replaces: string
  x_estimate: number
  y_estimate: number
  fit_reason: string
}

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
  strategy_type: StrategyType
  label: string
  recommended: boolean
  alternative_suggestions?: TargetFitMapAlternative[]
  all_segments?: TargetFitMapSegment[]
  axes_locked?: boolean
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
  target_fit_map_cache?: Partial<Record<StrategyType, TargetFitMap>> | null
  target_fit_map_selected_strategy?: StrategyType
  target_fit_map?: TargetFitMap | null  // 後方互換: 選択中のコピー
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
): Array<{ name: string; description: string; size_hint: '大' | '中' | '小' }> {
  const segments: Array<{ name: string; description: string; size_hint: '大' | '中' | '小' }> = []
  for (const variable of segmentation.variables || []) {
    for (const seg of variable.segments || []) {
      if (seg.name.trim()) {
        segments.push({
          name: seg.name,
          description: seg.description,
          size_hint: seg.size_hint || '中',
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

  // ターゲット適合マップ（C案）: 推奨を即生成、他はユーザー操作で遅延生成＋キャッシュ。
  // 後方互換: 旧 target_fit_map 単体は、その strategy（無ければ推奨）のキャッシュとして取り込む。
  const [cache, setCache] = useState<Partial<Record<StrategyType, TargetFitMap>>>(() => {
    if (targeting.target_fit_map_cache && Object.keys(targeting.target_fit_map_cache).length > 0) {
      return targeting.target_fit_map_cache
    }
    if (targeting.target_fit_map) {
      const t = targeting.target_fit_map
      const s = t.strategy_type || 'strategic_vs_dispersion'
      return { [s]: { ...t, strategy_type: s, label: t.label || STRATEGY_LABELS[s], recommended: t.recommended ?? (s === 'strategic_vs_dispersion') } }
    }
    return {}
  })
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyType>(
    targeting.target_fit_map_selected_strategy ?? 'strategic_vs_dispersion'
  )
  const fitMap: TargetFitMap | null = cache[selectedStrategy] ?? null
  const [fitMapLoading, setFitMapLoading] = useState(false)   // API fetch中
  const [fitMapPending, setFitMapPending] = useState(false)    // ターゲット変更〜1.5sのdebounce待機中
  const fitMapDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // ターゲットの実値を追跡（remountや新配列での spurious 再生成を防ぐ）
  const lastTargetsRef = useRef<string | null>(null)

  // 選択中マップの coverage を更新（スライダー用）
  const updateSelectedCoverage = useCallback((coverage: TargetFitMap['coverage']) => {
    setCache((prev) => {
      const cur = prev[selectedStrategy]
      if (!cur) return prev
      return { ...prev, [selectedStrategy]: { ...cur, coverage } }
    })
  }, [selectedStrategy])

  // 競合分析: セッションから復元 or 空で初期化
  const [competitorsAnalysis, setCompetitorsAnalysis] = useState<CompetitorAnalysis[]>(() => {
    const saved = targeting.competitors_analysis
    if (saved && saved.length > 0) return saved
    // 後方互換: 旧 competitor_traits がある場合は最初の競合に入れる
    return []
  })

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
      target_fit_map_cache: cache,
      target_fit_map_selected_strategy: selectedStrategy,
      target_fit_map: fitMap,  // 後方互換: 選択中のコピー
    }),
    [mainTarget, subTargets, mainSegDescription, buyingFactors, strengths, competitorsAnalysis, cache, selectedStrategy, fitMap]
  )

  // 生成中（cacheが一時的に空になり得る）かどうかを最新値で参照するref
  const fitMapBusyRef = useRef(false)
  fitMapBusyRef.current = fitMapLoading || fitMapPending

  // オートセーブ（1秒デバウンス）
  const triggerAutoSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      // 生成中は cache が空の瞬間があるため保存しない（生成結果は fetchStrategy の即保存で永続化される）
      if (fitMapBusyRef.current) return
      onSaveField(getCurrentData())
    }, 1000)
  }, [getCurrentData, onSaveField])

  // 値変更時にオートセーブ。初回マウントはスキップ（DBと同内容＝空キャッシュを書き込む隙を作らない）。
  const autosaveMountedRef = useRef(false)
  useEffect(() => {
    if (!autosaveMountedRef.current) {
      autosaveMountedRef.current = true
      return
    }
    triggerAutoSave()
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainTarget, subTargets, mainSegDescription, buyingFactors, strengths, competitorsAnalysis, cache, selectedStrategy])

  // アンマウント時に保留中のオートセーブを即時 flush（離脱時の取りこぼし＝戻る→再生成の原因を防ぐ）。
  // 最新の onSaveField / getCurrentData を ref 経由で参照（空deps effect の stale closure 回避）。
  const flushSaveRef = useRef<() => void>(() => {})
  flushSaveRef.current = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
      onSaveField(getCurrentData())
    }
  }
  useEffect(() => () => flushSaveRef.current(), [])

  // mainTarget / subTargets が現在のセグメントに存在するかチェック
  useEffect(() => {
    const segNames = new Set(allSegments.map((s) => s.name))
    if (mainTarget && !segNames.has(mainTarget)) {
      setMainTarget('')
    }
    // 内容が変わらない場合は同一参照を返す（新配列で無駄な再レンダ→空キャッシュのオートセーブが走るのを防ぐ）
    setSubTargets((prev) => {
      const filtered = prev.filter((s) => segNames.has(s))
      return filtered.length === prev.length ? prev : filtered
    })
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

  // 代替候補で範囲外ターゲットを差し替え（→ lastTargetsRef検知で1.5秒後に自動再生成）
  const handleReplaceTarget = (alt: TargetFitMapAlternative) => {
    const targetToRemove = alt.replaces
    // メインターゲットが範囲外 → メインを置換
    if (mainTarget === targetToRemove) {
      setMainTarget(alt.name)
      return
    }
    // サブターゲットが範囲外 → 同じ位置で入れ替え
    if (subTargets.includes(targetToRemove)) {
      setSubTargets((prev) => prev.map((s) => (s === targetToRemove ? alt.name : s)))
      return
    }
    // 想定外: replaces 名が見つからない
    toast.error('置き換え対象のターゲットが見つかりませんでした')
  }

  // マップのグレーセグメントをクリック → サブを置換/追加（メインは変更しない）
  const handleSegmentClick = useCallback((segmentName: string) => {
    // メインは絶対変えない / 既にサブなら何もしない
    if (mainTarget === segmentName) return
    if (subTargets.includes(segmentName)) return
    // サブが2個未満なら単純追加
    if (subTargets.length < 2) {
      setSubTargets((prev) => [...prev, segmentName])
      return
    }
    // サブ満タン: クリック位置から最も遠い（戦略から外れた）サブを置換
    const clicked = fitMap?.all_segments?.find((s) => s.name === segmentName)
    if (!clicked) {
      toast.error('セグメント座標が取得できませんでした')
      return
    }
    const subWithDistance = subTargets.map((subName) => {
      const sub = fitMap?.targets.find((t) => t.name === subName)
      if (!sub) return { name: subName, distance: Infinity }
      const dx = sub.x - clicked.x
      const dy = sub.y - clicked.y
      return { name: subName, distance: Math.sqrt(dx * dx + dy * dy) }
    })
    // 最も遠い（戦略から外れている）サブを置換する（近いサブは既に合致しているため）
    const farthest = subWithDistance.reduce((max, cur) => (cur.distance > max.distance ? cur : max))
    setSubTargets((prev) => prev.map((s) => (s === farthest.name ? segmentName : s)))
    toast.success(`${farthest.name} → ${segmentName} に置き換え`)
  }, [mainTarget, subTargets, fitMap])

  // 戻る: 保留中の autosave を確定し、現在の targeting（生成済みマップ含む）を保存してから戻る。
  // これがないと「戻る→Step3」で未保存のままになり再生成される。
  const handleBack = () => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null }
    onSaveField(getCurrentData())
    onBack()
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

  // 指定方針のマップを生成（既にキャッシュ済みなら fetch せず即切替）。
  // replaceAll=true: 既存キャッシュを破棄して新マップ1件のみに（ターゲット変更時の総入れ替え用）。
  const fetchStrategy = useCallback(async (strategy: StrategyType, force = false, replaceAll = false) => {
    if (!mainTarget) return
    if (!force && cache[strategy]) {
      setSelectedStrategy(strategy)  // キャッシュ済み → 即切替（API呼出なし）
      return
    }
    setSelectedStrategy(strategy)
    setFitMapLoading(true)
    try {
      // 既存マップがロック中なら軸を固定して再計算（座標・カバー範囲のみ更新）
      const existing = cache[strategy]
      const lockedAxes = existing?.axes_locked
        ? { x_axis: existing.x_axis, y_axis: existing.y_axis }
        : null
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
          strategy_type: strategy,
          locked_axes: lockedAxes,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error((d as { error?: string }).error || 'マップの生成に失敗しました')
        return
      }
      const data = await res.json() as TargetFitMap
      // ロック状態はクライアント保持（API応答に含まれないため、固定継続なら付与）
      if (existing?.axes_locked) data.axes_locked = true
      const newCache: Partial<Record<StrategyType, TargetFitMap>> = replaceAll ? { [strategy]: data } : { ...cache, [strategy]: data }
      setCache(newCache)
      // 生成完了時は debounce を待たず即保存（リロード前の取りこぼし＝再生成バグを防ぐ）。
      // getCurrentData() は生成前 state を返すため、マップ関連3フィールドだけ最新値で上書き。
      onSaveField({
        ...getCurrentData(),
        target_fit_map_cache: newCache,
        target_fit_map_selected_strategy: strategy,
        target_fit_map: data,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'マップの生成中にエラーが発生しました')
    } finally {
      setFitMapLoading(false)
    }
  }, [cache, mainTarget, subTargets, mainSegDescription, strengths, buyingFactors, basicInfo, segmentation, getCurrentData, onSaveField])

  // 軸ロックの切替（per-strategy。cache変更→既存autosaveでsession永続化）
  const toggleAxisLock = useCallback(() => {
    if (!fitMap) return
    setCache((prev) => {
      const cur = prev[selectedStrategy]
      if (!cur) return prev
      return { ...prev, [selectedStrategy]: { ...cur, axes_locked: !cur.axes_locked } }
    })
  }, [fitMap, selectedStrategy])

  // ターゲットの「実値」が変わった時だけ再生成。マウント直後やremount・新配列での再発火は無視。
  useEffect(() => {
    if (!mainTarget) return
    const currentTargets = `${mainTarget}|${[...subTargets].sort().join('|')}`
    // 初回（基準セット）: 再生成しない。キャッシュが無ければAI推奨のみ生成。
    if (lastTargetsRef.current === null) {
      lastTargetsRef.current = currentTargets
      if (!cache.strategic_vs_dispersion) fetchStrategy('strategic_vs_dispersion')
      return
    }
    // 実値が同じ＝spurious再発火 → 何もしない
    if (lastTargetsRef.current === currentTargets) return
    lastTargetsRef.current = currentTargets
    // 実際にターゲットが変わった → 即座に「変更を反映中」表示。1.5s後に推奨をキャッシュ総入れ替え再生成。
    setFitMapPending(true)
    if (fitMapDebounceRef.current) clearTimeout(fitMapDebounceRef.current)
    fitMapDebounceRef.current = setTimeout(() => {
      setFitMapPending(false)
      setSelectedStrategy('strategic_vs_dispersion')
      fetchStrategy('strategic_vs_dispersion', true, true)
    }, 1500)
    return () => { if (fitMapDebounceRef.current) clearTimeout(fitMapDebounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainTarget, subTargets])

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
        前ステップの市場候補から、狙うべきターゲットを見極めます。カードでメイン1つ・サブ最大2つを選びましょう。
      </p>

      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">

          <FieldHeading className="mb-3">ターゲット市場候補</FieldHeading>
          {/* グループ一覧（カードクリックで選択・2カラム／メインは全幅展開） */}
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            {allSegments.map((seg) => {
              const isMain = mainTarget === seg.name
              const isSub = subTargets.includes(seg.name)
              return (
                <div
                  key={seg.name}
                  className={`relative rounded-lg border transition-all duration-300 ease-in-out ${
                    isMain
                      ? 'border-ds-app-accent-soft bg-blue-50/50 md:col-span-2'
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
                      <Badge className="absolute -top-[9px] left-[6px] rounded-full px-1.5 py-0 !text-[10px] !leading-[16px] bg-ds-app-accent text-white hover:bg-ds-app-accent-hover">メインターゲット</Badge>
                    )}
                    {isSub && (
                      <Badge variant="outline" className="absolute -top-[9px] left-[6px] rounded-full px-1.5 py-0 !text-[10px] !leading-[16px] border-blue-300 bg-white text-blue-300">サブターゲット</Badge>
                    )}

                    <div className={`flex items-center gap-2 ${isMain ? 'pr-24' : ''}`}>
                      <span className={`font-bold text-gray-900 ${isMain || isSub ? 'text-lg' : 'text-sm'}`}>{seg.name}</span>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          seg.size_hint === '大'
                            ? 'bg-emerald-100 text-emerald-700'
                            : seg.size_hint === '中'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        規模: {seg.size_hint}
                      </span>
                    </div>
                    {seg.description && (
                      <p className="mt-1 text-sm text-gray-600">{seg.description}</p>
                    )}
                  </button>

                  {/* AI提案ボタン（メインカード右上）。AIButtonは内部relativeのためdivで絶対配置 */}
                  {isMain && (
                    <div className="absolute top-3 right-3 z-10">
                      <AIButton
                        size="sm"
                        onClick={handleAISuggestClick}
                        disabled={aiLoading}
                        icon={aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}
                      >
                        {aiLoading ? '提案中…' : 'AIで提案生成'}
                      </AIButton>
                    </div>
                  )}

                  {/* メインターゲット深掘り（カード内展開） */}
                  <div
                    className="grid transition-[grid-template-rows] duration-300 ease-in-out"
                    style={{ gridTemplateRows: isMain ? '1fr' : '0fr' }}
                  >
                    <div className="overflow-hidden">
                      <div className="border-t border-blue-200 mx-4 mb-4 pt-4 space-y-4 max-w-3xl">

                        {/* 1. 購買決定要因（タグ入力） */}
                        <div>
                          <FieldSubLabel>購買決定要因 <span className="text-red-500">*</span></FieldSubLabel>
                          <TagInput
                            value={buyingFactors}
                            onChange={setBuyingFactors}
                            placeholder="例: 価格、品質、サポート（Enterで追加）"
                          />
                        </div>

                        {/* 2. 自社の強み */}
                        <div>
                          <FieldSubLabel>自社の強み <span className="text-red-500">*</span></FieldSubLabel>
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
                            <FieldSubLabel className="mb-0">競合分析</FieldSubLabel>
                            <span className="text-[10px] text-gray-400">（任意）</span>
                          </div>
                          {competitorCards.length > 0 ? (
                            <div className="space-y-2">
                              {competitorCards.map((comp) => (
                                <div key={comp.name} className="rounded-md border border-gray-200 bg-white px-3 py-2.5">
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
        <Card className="mb-6 mt-6 bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <FieldHeading className="mb-0">ターゲット適合マップ</FieldHeading>
              <p className="mt-1 text-[13px] text-muted-foreground">選んだターゲットが自社のカバー範囲に入っているかを自動チェックします。</p>
            </div>
            <AIButton
              size="sm"
              onClick={() => fetchStrategy(selectedStrategy, true)}
              disabled={fitMapLoading || fitMapPending}
              icon={(fitMapLoading || fitMapPending) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}
              className="shrink-0"
            >
              {fitMapLoading ? '更新中…' : fitMapPending ? '反映待機中…' : fitMap ? 'マップを再生成' : 'AIでマップを生成'}
            </AIButton>
          </div>
          {/* 整合性ステータスバー（更新中は過去状態として薄く） */}
          <div className={`transition-opacity ${(fitMapPending || fitMapLoading) ? 'opacity-50' : 'opacity-100'}`}>
            <ConsistencyStatusBar
              status={fitMap?.consistency_status || 'green'}
              targetCount={1 + subTargets.length}
              outCount={fitMap ? fitMap.targets.filter(t => !t.in_coverage).length : 0}
              edgeTargets={fitMap ? fitMap.targets.filter(t => {
                const c = fitMap.coverage
                const ndx = c.width ? (t.x - c.center_x) / (c.width / 2) : 0
                const ndy = c.height ? (t.y - c.center_y) / (c.height / 2) : 0
                return t.in_coverage && Math.sqrt(ndx * ndx + ndy * ndy) > 0.85
              }).map(t => t.name) : []}
            />
            {/* 代替候補（red時のみ・カバー範囲内に合うターゲットを提案→クリックで差し替え） */}
            {!fitMapPending && !fitMapLoading &&
              fitMap?.consistency_status === 'red' &&
              fitMap.alternative_suggestions &&
              fitMap.alternative_suggestions.length > 0 && (
              <div className="mt-2 rounded-lg border border-red-200 bg-red-50/50 p-3">
                <div className="mb-2 text-xs font-medium text-red-700">
                  代替候補（カバー範囲内に合うターゲット）
                </div>
                <div className="space-y-1.5">
                  {fitMap.alternative_suggestions.map((alt, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 rounded-md border border-red-100 bg-white p-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">{alt.name}</span>
                          <span className="text-[10px] text-gray-500">{alt.replaces} の代替</span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground leading-relaxed">
                          {alt.fit_reason}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleReplaceTarget(alt)}
                        className="shrink-0 rounded-md bg-ds-app-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-ds-app-accent-hover"
                      >
                        差し替え
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* マップ本体（生成・更新中はステップ進捗ローダーでマップごと隠す） */}
          {(fitMapPending || fitMapLoading) ? (
            <StepProgressPanel
              className="mt-3"
              steps={[
                { label: '軸を選定' },
                { label: 'ターゲット位置を判定中' },
                { label: 'カバー範囲を計算' },
                { label: '整合性を判定' },
              ]}
              stepDuration={1500}
              done={false}
            />
          ) : fitMap ? (
            <div className="relative mt-3">
              {fitMap.axes_locked && (
                <div className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700 shadow-sm">
                  <Lock className="h-3 w-3" />
                  軸固定中
                </div>
              )}
              <TargetFitMapView
                fitMap={fitMap}
                onCoverageChange={updateSelectedCoverage}
                onSegmentClick={handleSegmentClick}
                mainTarget={mainTarget}
                subTargets={subTargets}
              />
            </div>
          ) : null}
          {/* 軸の選び方セレクター（マップ表示時のみ・コンパクト）。他方針は遅延生成＋キャッシュで即切替 */}
          {fitMap && !fitMapLoading && !fitMapPending && (
            <div className="mt-3 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-muted-foreground">軸の選び方:</span>
                <span className="font-medium text-foreground">{STRATEGY_LABELS[selectedStrategy]}</span>
                {selectedStrategy === 'strategic_vs_dispersion' && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">★AI推奨</span>
                )}
                {fitMap.axes_locked && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                    <Lock className="h-3 w-3" />
                    軸固定中
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleAxisLock}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    fitMap.axes_locked
                      ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title={fitMap.axes_locked ? 'ロック解除' : '軸を確定（以後の再生成で軸が変わらなくなる）'}
                >
                  {fitMap.axes_locked ? (
                    <><Unlock className="h-3 w-3" />ロック解除</>
                  ) : (
                    <><Lock className="h-3 w-3" />軸を確定</>
                  )}
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="font-medium text-ds-app-accent hover:underline">他の軸も試す</button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72">
                    {ALL_STRATEGIES.map((s) => (
                      <DropdownMenuItem
                        key={s}
                        disabled={s === selectedStrategy || (!!fitMap.axes_locked && s !== selectedStrategy)}
                        onClick={() => fetchStrategy(s)}
                        className="cursor-pointer"
                      >
                        <div className="flex w-full items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{STRATEGY_LABELS[s]}</div>
                            <div className="text-[11px] text-muted-foreground">{STRATEGY_DESCRIPTIONS[s]}</div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {fitMap.axes_locked && s !== selectedStrategy ? (
                              <span className="text-[10px] text-amber-600">軸ロック中・解除が必要</span>
                            ) : (
                              <>
                                {s === 'strategic_vs_dispersion' && <span className="text-[10px] font-bold text-emerald-600">★</span>}
                                {cache[s]
                                  ? <span className="text-[10px] text-emerald-600">⚡ 即切替</span>
                                  : <span className="text-[10px] text-muted-foreground">⏱ 生成</span>}
                              </>
                            )}
                          </div>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}
          </CardContent>
        </Card>
      )}

      {/* フッターナビゲーション */}
      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-4 flex items-center justify-between">
        <Button variant="outline" onClick={handleBack} className="h-14 gap-2 px-6 text-base font-bold">
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
function ConsistencyStatusBar({ status, targetCount, outCount, edgeTargets = [] }: {
  status: 'green' | 'yellow' | 'red'
  targetCount: number
  outCount: number
  edgeTargets?: string[]
}) {
  const conf = {
    green: { bar: 'bg-emerald-500', wrap: 'bg-emerald-50 border-emerald-200 text-emerald-700', text: `${targetCount} ターゲット全員がカバー範囲内` },
    yellow: { bar: 'bg-amber-500', wrap: 'bg-amber-50 border-amber-200 text-amber-700', text: edgeTargets.length > 0 ? `⚠ ${edgeTargets.join('・')} がカバー範囲の端に近いです` : '⚠ 一部のターゲットがカバー範囲の端に位置' },
    red: { bar: 'bg-red-500', wrap: 'bg-red-50 border-red-200 text-red-700', text: `${outCount} 個のターゲットがカバー範囲外（要再検討）` },
  }[status]
  return (
    <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium ${conf.wrap}`}>
      <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${conf.bar}`} />
      {conf.text}
    </div>
  )
}

// ターゲット適合マップ描画（自社カバー範囲＝楕円、ターゲット＝色付き点）。横幅・縦幅はスライダーで調整。
const FIT_PAD = 16 // PositioningMapと同じ（軸ラベルを内側に置くため余白を最小化）
// ビューボックスはPositioningMapと同じ尺度（幅700）に合わせる＝同じfontSize/ドット径が同じ見た目になる。
// アスペクト比は5:3を維持（700:420 = 500:300 = 5/3）。
const FIT_W = 700
const FIT_H = 420
const FIT_MAP_W = FIT_W - FIT_PAD * 2
const FIT_MAP_H = FIT_H - FIT_PAD * 2
const TARGET_COLORS = ['#10B981', '#8B5CF6', '#F59E0B'] // サブ用（メインは青固定）

function TargetFitMapView({ fitMap, onCoverageChange, onSegmentClick, mainTarget, subTargets }: {
  fitMap: TargetFitMap
  onCoverageChange: (coverage: TargetFitMap['coverage']) => void
  onSegmentClick?: (segmentName: string) => void
  mainTarget: string
  subTargets: string[]
}) {
  const toX = (x: number) => FIT_PAD + (x / 100) * FIT_MAP_W
  const toY = (y: number) => FIT_PAD + ((100 - y) / 100) * FIT_MAP_H
  const cov = fitMap.coverage
  const cx = toX(cov.center_x)
  const cy = toY(cov.center_y)
  const rx = (cov.width / 100) * FIT_MAP_W / 2
  const ry = (cov.height / 100) * FIT_MAP_H / 2
  // プロット中心（軸・目盛り・軸ラベル用）。PositioningMapと同じ装飾に合わせる
  const plotCx = FIT_PAD + FIT_MAP_W / 2
  const plotCy = FIT_PAD + FIT_MAP_H / 2
  let subIdx = -1
  return (
    <div className="mt-3 rounded-lg border border-border bg-white p-3">
      <svg viewBox={`0 0 ${FIT_W} ${FIT_H}`} width="100%" className="rounded-lg" style={{ aspectRatio: '5 / 3' }}>
        {/* XY軸（PositioningMapと同色） */}
        <line x1={plotCx} y1={FIT_PAD} x2={plotCx} y2={FIT_PAD + FIT_MAP_H} stroke="#d1d5db" strokeWidth={1} />
        <line x1={FIT_PAD} y1={plotCy} x2={FIT_PAD + FIT_MAP_W} y2={plotCy} stroke="#d1d5db" strokeWidth={1} />
        {/* 目盛り（細め・短め） */}
        {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100].map((val) => {
          const t = val % 10 === 0 ? 4 : 2
          return (
            <g key={`tick-${val}`}>
              <line x1={toX(val)} y1={plotCy - t} x2={toX(val)} y2={plotCy + t} stroke="#d1d5db" strokeWidth={0.75} />
              <line x1={plotCx - t} y1={toY(val)} x2={plotCx + t} y2={toY(val)} stroke="#d1d5db" strokeWidth={0.75} />
            </g>
          )
        })}
        {/* 自社カバー範囲（破線・半透明）— 適合マップ固有 */}
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#3B82F6" fillOpacity={0.08} stroke="#3B82F6" strokeOpacity={0.5} strokeWidth={1.5} strokeDasharray="6 4" />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="13" fill="#3B82F6" fillOpacity={0.7}>自社カバー範囲</text>
        {/* 軸ラベル（PositioningMapと同位置・同色・fontSize12。プロット内側に配置） */}
        {fitMap.x_axis.left && (
          <text x={FIT_PAD + 4} y={plotCy - 8} textAnchor="start" fontSize="12" fill="#9ca3af">{fitMap.x_axis.left}</text>
        )}
        {fitMap.x_axis.right && (
          <text x={FIT_PAD + FIT_MAP_W - 4} y={plotCy - 8} textAnchor="end" fontSize="12" fill="#9ca3af">{fitMap.x_axis.right}</text>
        )}
        {fitMap.y_axis.top && (
          <text x={plotCx + 8} y={FIT_PAD + 14} textAnchor="start" fontSize="12" fill="#9ca3af">{fitMap.y_axis.top}</text>
        )}
        {fitMap.y_axis.bottom && (
          <text x={plotCx + 8} y={FIT_PAD + FIT_MAP_H - 14} textAnchor="start" fontSize="12" fill="#9ca3af">{fitMap.y_axis.bottom}</text>
        )}
        {/* 未選択セグメント（背景・グレー・クリックでサブ置換）。ホバーで名前表示 */}
        {fitMap.all_segments
          ?.filter((seg) => seg.name !== mainTarget && !subTargets.includes(seg.name))
          .map((seg, i) => (
            <g
              key={`gray-${i}`}
              className="group"
              onClick={() => onSegmentClick?.(seg.name)}
              style={{ cursor: 'pointer' }}
            >
              {/* 透明ヒット領域（タップ精度確保） */}
              <circle cx={toX(seg.x)} cy={toY(seg.y)} r={14} fill="transparent" />
              {/* 見える点 */}
              <circle
                cx={toX(seg.x)}
                cy={toY(seg.y)}
                r={5}
                fill="#9ca3af"
                stroke="#fff"
                strokeWidth={1.5}
                pointerEvents="none"
                className="opacity-50 transition-opacity group-hover:opacity-90"
              />
              {/* ホバー時のラベル */}
              <text
                x={toX(seg.x)}
                y={toY(seg.y) + 18}
                textAnchor="middle"
                fontSize="10"
                fill="#6b7280"
                pointerEvents="none"
                className="opacity-0 transition-opacity group-hover:opacity-100"
              >
                {seg.name}
              </text>
            </g>
          ))}
        {/* ターゲット点（PositioningMap準拠：r8・opacity0.85・白縁2px。メイン＝右にボールド濃色、サブ＝下中央にドット色） */}
        {fitMap.targets.map((t, i) => {
          const isMain = t.role === 'main'
          // メイン点はメインターゲットのバッジ背景色（--ds-app-accent）に合わせる
          const color = isMain ? '#2563eb' : TARGET_COLORS[(subIdx = subIdx + 1) % TARGET_COLORS.length]
          const px = toX(t.x)
          const py = toY(t.y)
          return (
            <g key={i}>
              <circle cx={px} cy={py} r={8} fill={color} opacity={0.85} stroke="#fff" strokeWidth={2} />
              {!t.in_coverage && <circle cx={px} cy={py} r={12} fill="none" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="3 2" />}
              {isMain ? (
                <text x={px + 13} y={py + 5} textAnchor="start" fontSize="14" fill="#0f172a" fontWeight={700}>{t.name}</text>
              ) : (
                <text x={px} y={py + 20} textAnchor="middle" fontSize="11" fill={color} fontWeight={600}>{t.name}</text>
              )}
            </g>
          )
        })}
      </svg>
      {fitMap.axis_rationale && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">軸選定の根拠: {fitMap.axis_rationale}</p>
      )}
      {fitMap.all_segments?.some((s) => s.name !== mainTarget && !subTargets.includes(s.name)) && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          💡 グレーのセグメントをクリックすると、最も近いサブターゲットと置き換わります
        </p>
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
