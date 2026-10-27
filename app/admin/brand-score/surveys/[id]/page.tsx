'use client'

// サーベイ詳細・設問管理ページ
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAuth } from '../../../components/AdminDataProvider'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ClipboardList,
  Users,
  Target,
  CalendarDays,
  WandSparkles,
  Loader2,
  Plus,
  LayoutTemplate,
  Trash2,
  GripVertical,
  AlertCircle,
  Check,
  RefreshCw,
} from 'lucide-react'
import { Fab, FabButton } from '@/components/ui/fab'
import { SurveyResults } from '@/components/brand-score/SurveyResults'
import {
  STAGE_LABELS,
  type GroupFunnel,
} from '@/lib/brand-score/funnel-stages'
import {
  type Breakdown,
} from '@/lib/brand-score/question-lens'

// 型定義
type Survey = {
  id: string
  title: string
  status: string
  starts_at: string | null
  ends_at: string | null
  target_response_rate: number
  total_members: number
  response_rate: number
  responded_count: number
  created_at: string
  insights: Partial<Record<InsightKey, string>> | null
  insights_generated_at: string | null
}

// カード別のAI考察。キーは API 側と揃える
type InsightKey = 'overview' | 'distribution' | 'stages' | 'funnel'

type Question = {
  id: string
  survey_id: string
  category: string
  question_text: string
  source: string
  sort_order: number
  is_active: boolean
  reference_data: Record<string, unknown>
  created_at: string
}

// インナースコアAPI型定義
type InnerScoreData = {
  survey: { id: string; title: string; status: string; total_members: number }
  response_rate: number
  response_count: number
  scores: {
    total: number | null
    why: number | null
    how: number | null
    what: number | null
  }
  rank: string
  by_department: {
    department: string; count: number
    why: number | null; how: number | null; what: number | null; total: number | null
  }[]
  by_role: {
    role_category: string; count: number
    why: number | null; how: number | null; what: number | null; total: number | null
  }[]
  by_question: {
    question_id: string; question_text: string; category: string
    avg_score: number | null; count: number
  }[]
  /** 設問タイプ・4領域・回答分布の集計 */
  breakdown: Breakdown | null
  /** 浸透段階の集計。段階が解決できないサーベイでは null */
  funnel: {
    pass_threshold: number
    overall: GroupFunnel
    by_department: GroupFunnel[]
  } | null
}

// ステータスバッジ定義
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: '下書き', className: 'bg-gray-100 text-gray-700' },
  active: { label: '実施中', className: 'bg-green-100 text-green-700' },
  closed: { label: '終了', className: 'bg-blue-100 text-ds-app-accent-hover' },
  archived: { label: 'アーカイブ', className: 'bg-gray-100 text-gray-500' },
}

// sourceバッジ定義
const SOURCE_CONFIG: Record<string, { label: string; className: string }> = {
  template: { label: 'テンプレート', className: 'bg-gray-100 text-gray-600' },
  ai_generated: { label: 'AI生成', className: 'bg-purple-100 text-purple-700' },
  custom: { label: 'カスタム', className: 'bg-blue-100 text-ds-app-accent-hover' },
}

// 設問別スコアの表示軸

/**
 * AI考察に渡す集計要約。画面に出ている数字だけを渡し、
 * 生成側が新しい数値を作れないようにする
 */
function buildInsightSummary(data: InnerScoreData) {
  // 段階は画面が5点満点で出しているので、AIにも同じ単位で語らせる。
  // 0〜100 も渡すのは、5点満点だと SP の理解3.54 と行動3.54 のように
  // 別の値が同じに見え、差を語れなくなる行があるため
  const stageRow = (g: GroupFunnel) => ({
    対象: g.department ? departmentLabel(g.department) : '全社',
    回答者数: g.respondentCount,
    段階スコア5点満点: Object.fromEntries(
      g.stageScores.map(s => [STAGE_LABELS[s.stage], s.avg])
    ),
    段階スコア0to100: Object.fromEntries(
      g.stageScores.map(s => [STAGE_LABELS[s.stage], s.score])
    ),
    通過率: Object.fromEntries(
      g.cumulative.map(p => [STAGE_LABELS[p.stage], p.rate])
    ),
  })

  const dist = (d: { avg: number; score: number; positiveRate: number; neutralRate: number; negativeRate: number }) => ({
    平均: d.avg,
    スコア: d.score,
    肯定率: d.positiveRate,
    中立率: d.neutralRate,
    否定率: d.negativeRate,
  })

  return {
    総合スコア: data.scores.total,
    ランク: data.rank,
    回答数: data.response_count,
    回答分布: data.breakdown && {
      全社: dist(data.breakdown.overall),
      部署別: data.breakdown.byDepartment.map(d => ({
        部署: departmentLabel(d.department),
        ...dist(d),
      })),
    },
    浸透段階: data.funnel && {
      通過の基準: `各段階の平均${data.funnel.pass_threshold}点以上`,
      全社: stageRow(data.funnel.overall),
      部署別: data.funnel.by_department.map(stageRow),
    },
    低スコアの設問: [...data.by_question]
      .filter(q => q.avg_score !== null)
      .sort((a, b) => (a.avg_score ?? 0) - (b.avg_score ?? 0))
      .slice(0, 5)
      .map(q => ({ 設問: q.question_text, 平均: q.avg_score, 回答数: q.count })),
  }
}

// カテゴリ表示名
const CATEGORY_LABELS: Record<string, string> = {
  why: '理念浸透（WHY）',
  how: '方針共感（HOW）',
  what: '行動体現（WHAT）',
}

// 部署の表示名。DB の値は取り込み時に指定した文字列なので、
// 画面上の呼び方だけをここで揃える
const DEPARTMENT_LABELS: Record<string, string> = {
  BO本社: 'BO（本社含む）',
}

const departmentLabel = (department: string) =>
  DEPARTMENT_LABELS[department] ?? department

// ── ソート可能な設問行コンポーネント ──
function SortableQuestionRow({
  q,
  isDraft,
  onCategoryChange,
  onDelete,
}: {
  q: Question
  isDraft: boolean
  onCategoryChange: (id: string, category: string) => void
  onDelete: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  const sourceConfig = SOURCE_CONFIG[q.source] || SOURCE_CONFIG.template

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2 px-4 py-3 border-b last:border-b-0">
      {/* ドラッグハンドル（draft時のみ） */}
      {isDraft ? (
        <button {...attributes} {...listeners} className="shrink-0 mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none">
          <GripVertical size={14} />
        </button>
      ) : (
        <span className="text-xs text-muted-foreground font-mono mt-0.5 w-5 shrink-0 text-right">
          {q.sort_order}
        </span>
      )}

      {/* 設問テキスト + メタ情報 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-relaxed">
          {q.question_text}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Badge
            variant="secondary"
            className={`text-[10px] px-1.5 py-0 ${sourceConfig.className}`}
          >
            {sourceConfig.label}
          </Badge>
          {/* カテゴリSelect（draft時のみ） */}
          {isDraft ? (
            <Select value={q.category} onValueChange={v => onCategoryChange(q.id, v)}>
              <SelectTrigger className="h-5 w-auto text-[10px] px-1.5 py-0 border-0 bg-transparent hover:bg-muted/50 gap-0.5 [&>svg]:h-3 [&>svg]:w-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="why">WHY（理念浸透）</SelectItem>
                <SelectItem value="how">HOW（方針共感）</SelectItem>
                <SelectItem value="what">WHAT（行動体現）</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <span className="text-[10px] text-muted-foreground">
              {CATEGORY_LABELS[q.category] || q.category}
            </span>
          )}
          {q.source === 'ai_generated' && q.reference_data?.field != null && (
            <span className="text-[10px] text-muted-foreground">
              参照: {String(q.reference_data.field)}
            </span>
          )}
        </div>
      </div>

      {/* 削除ボタン（draft時のみ） */}
      {isDraft && (
        <Button
          variant="outline"
          size="icon"
          className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onDelete(q.id)}
        >
          <Trash2 size={14} />
        </Button>
      )}
    </div>
  )
}

export default function SurveyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { companyId } = useAuth()
  const surveyId = params.id as string

  const [survey, setSurvey] = useState<Survey | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)

  // インナースコア
  // 設問別スコアの表示軸（浸透段階 / 設問タイプ WHY/HOW/WHAT）。
  // 既定は浸透段階（評価軸を5段階に統一したため）。
  // 段階が解決できないサーベイでは下の effectiveAxis がフォールバックする
  const [innerScore, setInnerScore] = useState<InnerScoreData | null>(null)
  const [innerScoreLoading, setInnerScoreLoading] = useState(false)

  // アクション状態
  const [insertingTemplates, setInsertingTemplates] = useState(false)
  const [generatingAi, setGeneratingAi] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  // 保存ボタン
  const [saving, setSaving] = useState(false)
  const initialTitleRef = useRef('')
  const initialCategoryMapRef = useRef<Map<string, string>>(new Map())
  const initialSortOrderMapRef = useRef<Map<string, number>>(new Map())

  // タイトル編集
  const [editingTitle, setEditingTitle] = useState(false)
  const [savingTitle, setSavingTitle] = useState(false)
  const [generatingInsights, setGeneratingInsights] = useState(false)
  const insightsTriedRef = useRef(false)
  const [titleDraft, setTitleDraft] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)

  // カスタム設問追加フォーム
  const [customCategory, setCustomCategory] = useState('why')
  const [customText, setCustomText] = useState('')
  const [addingCustom, setAddingCustom] = useState(false)

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // データ取得
  const fetchData = useCallback(async () => {
    if (!surveyId) return
    try {
      const res = await fetch(`/api/brand-score/surveys/${surveyId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setSurvey(data.survey)
      const qs: Question[] = data.questions || []
      setQuestions(qs)
      setTitleDraft(data.survey.title)
      // 初期値を保存（変更検知用）
      initialTitleRef.current = data.survey.title
      const categoryMap = new Map<string, string>()
      const sortOrderMap = new Map<string, number>()
      for (const q of qs) {
        categoryMap.set(q.id, q.category)
        sortOrderMap.set(q.id, q.sort_order)
      }
      initialCategoryMapRef.current = categoryMap
      initialSortOrderMapRef.current = sortOrderMap
    } catch (err) {
      console.error('[SurveyDetail] データ取得エラー:', err)
      toast.error('サーベイ情報の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [surveyId])

  // インナースコア取得
  const fetchInnerScore = useCallback(async (sid: string, cid: string) => {
    setInnerScoreLoading(true)
    try {
      const res = await fetch(`/api/brand-score/inner-score?company_id=${cid}&survey_id=${sid}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.score === null && data.message) {
        setInnerScore(null)
      } else {
        setInnerScore(data)
      }
    } catch (err) {
      console.error('[SurveyDetail] インナースコア取得エラー:', err)
    } finally {
      setInnerScoreLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // サーベイ情報取得後にインナースコアを取得（active/closed時のみ）
  useEffect(() => {
    if (survey && companyId && (survey.status === 'active' || survey.status === 'closed')) {
      fetchInnerScore(survey.id, companyId)
    }
  }, [survey?.id, survey?.status, companyId, fetchInnerScore])

  // ── AI考察 ──
  // 生成結果はサーベイに保存されるので、2回目以降の表示では生成しない。
  // 集計が変わったときは「考察を再生成」で作り直す
  const generateInsights = useCallback(async () => {
    if (!innerScore) return
    setGeneratingInsights(true)
    try {
      const res = await fetch(`/api/brand-score/surveys/${surveyId}/insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: buildInsightSummary(innerScore) }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || '考察の生成に失敗しました')
      }
      const data = await res.json()
      setSurvey(prev =>
        prev
          ? { ...prev, insights: data.insights, insights_generated_at: data.insights_generated_at }
          : prev
      )
    } catch (err) {
      console.error('[SurveyDetail] AI考察生成エラー:', err)
      toast.error(err instanceof Error ? err.message : '考察の生成に失敗しました')
    } finally {
      setGeneratingInsights(false)
    }
  }, [innerScore, surveyId])

  // 未生成のときだけ自動で一度走らせる。失敗しても再試行はしない
  useEffect(() => {
    if (!survey || !innerScore || survey.insights) return
    if (insightsTriedRef.current) return
    insightsTriedRef.current = true
    generateInsights()
  }, [survey, innerScore, generateInsights])

  // ── タイトル編集 ──
  // 下書きに限らずどの状態でも直せる。取り込んだサーベイはファイル名が
  // そのままタイトルになるため、公開後に直したい場面のほうが多い
  const handleTitleClick = () => {
    setEditingTitle(true)
    setTimeout(() => titleInputRef.current?.focus(), 50)
  }

  // 確定と同時に保存する。下書きの「保存」ボタンの流れとは独立させ、
  // 保存ボタンが出ない状態でも変更が消えないようにする
  const handleTitleBlur = async () => {
    setEditingTitle(false)
    const next = titleDraft.trim()
    if (!next) {
      setTitleDraft(initialTitleRef.current)
      return
    }
    if (next === initialTitleRef.current) return

    setSavingTitle(true)
    try {
      const res = await fetch(`/api/brand-score/surveys/${surveyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: next }),
      })
      if (!res.ok) throw new Error('タイトルの保存に失敗しました')
      const data = await res.json()
      setSurvey(data.survey)
      initialTitleRef.current = data.survey.title
      setTitleDraft(data.survey.title)
      toast.success('タイトルを更新しました')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'タイトルの保存に失敗しました')
      setTitleDraft(initialTitleRef.current)
    } finally {
      setSavingTitle(false)
    }
  }

  // ── テンプレート設問追加 ──
  const handleInsertTemplates = async () => {
    setInsertingTemplates(true)
    try {
      const res = await fetch(`/api/brand-score/surveys/${surveyId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'insert_templates' }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.skipped) {
        toast.info('テンプレート設問は既に追加済みです')
      } else {
        toast.success(`テンプレート設問を${data.count}問追加しました`)
      }
      await fetchData()
    } catch (err) {
      console.error('[SurveyDetail] テンプレート追加エラー:', err)
      toast.error('テンプレート設問の追加に失敗しました')
    } finally {
      setInsertingTemplates(false)
    }
  }

  // ── AI設問生成 ──
  const handleGenerateAi = async () => {
    setGeneratingAi(true)
    try {
      const res = await fetch(`/api/brand-score/surveys/${surveyId}/generate-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      toast.success(`AI設問を${data.count}問生成しました`)
      await fetchData()
    } catch (err) {
      console.error('[SurveyDetail] AI生成エラー:', err)
      const msg = err instanceof Error ? err.message : 'AI設問の生成に失敗しました'
      toast.error(msg)
    } finally {
      setGeneratingAi(false)
    }
  }

  // ── ステータス変更 ──
  const handleStatusChange = async (newStatus: string) => {
    setUpdatingStatus(true)
    try {
      // 未保存の変更があれば先に保存
      if (hasChanges) {
        await handleSave()
      }
      const res = await fetch(`/api/brand-score/surveys/${surveyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await fetchData()
      if (newStatus === 'active') {
        toast.success('サーベイの配信を開始しました')
      } else if (newStatus === 'closed') {
        toast.success('サーベイを終了しました')
      }
    } catch (err) {
      console.error('[SurveyDetail] ステータス変更エラー:', err)
      toast.error('ステータスの変更に失敗しました')
    } finally {
      setUpdatingStatus(false)
    }
  }

  // ── カテゴリ変更（ローカルのみ） ──
  const handleCategoryChange = (questionId: string, category: string) => {
    setQuestions(prev =>
      prev.map(q => (q.id === questionId ? { ...q, category } : q))
    )
  }

  // ── 設問削除（即API実行） ──
  const handleDeleteQuestion = async (questionId: string) => {
    try {
      const res = await fetch(
        `/api/brand-score/surveys/${surveyId}/questions/${questionId}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      // ローカルステートから除去
      setQuestions(prev => prev.filter(q => q.id !== questionId))
      // 初期値マップからも除去
      initialCategoryMapRef.current.delete(questionId)
      initialSortOrderMapRef.current.delete(questionId)
      toast.success('設問を削除しました')
    } catch (err) {
      console.error('[SurveyDetail] 設問削除エラー:', err)
      const msg = err instanceof Error ? err.message : '設問の削除に失敗しました'
      toast.error(msg)
    }
  }

  // ── ドラッグ&ドロップ ──
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setQuestions(prev => {
      const oldIndex = prev.findIndex(q => q.id === active.id)
      const newIndex = prev.findIndex(q => q.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev

      const reordered = arrayMove(prev, oldIndex, newIndex)
      // sort_orderを連番で振り直す
      return reordered.map((q, i) => ({ ...q, sort_order: i + 1 }))
    })
  }

  // ── 変更検知 ──
  const hasChanges = useMemo(() => {
    // タイトル変更チェック
    if (titleDraft.trim() && titleDraft.trim() !== initialTitleRef.current) return true
    // カテゴリ変更チェック
    for (const q of questions) {
      const initialCat = initialCategoryMapRef.current.get(q.id)
      if (initialCat !== undefined && initialCat !== q.category) return true
    }
    // sort_order変更チェック
    for (const q of questions) {
      const initialOrder = initialSortOrderMapRef.current.get(q.id)
      if (initialOrder !== undefined && initialOrder !== q.sort_order) return true
    }
    return false
  }, [titleDraft, questions])

  // ── 保存 ──
  const handleSave = async () => {
    if (saving) return
    if (!hasChanges) {
      toast.success('保存しました')
      return
    }
    setSaving(true)
    try {
      // 1. タイトル変更があれば保存
      if (titleDraft.trim() && titleDraft.trim() !== initialTitleRef.current) {
        const res = await fetch(`/api/brand-score/surveys/${surveyId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: titleDraft.trim() }),
        })
        if (!res.ok) throw new Error('タイトルの保存に失敗しました')
        const data = await res.json()
        setSurvey(data.survey)
        initialTitleRef.current = data.survey.title
      }

      // 2. category が変更された設問のみ個別に保存
      const categoryChanged = questions.filter(q => {
        const initial = initialCategoryMapRef.current.get(q.id)
        return initial !== undefined && initial !== q.category
      })
      for (const q of categoryChanged) {
        const res = await fetch(
          `/api/brand-score/surveys/${surveyId}/questions/${q.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category: q.category }),
          }
        )
        if (!res.ok) throw new Error('カテゴリの保存に失敗しました')
      }

      // 3. sort_order が変更されていれば一括更新
      const orderChanged = questions.filter(q => {
        const initial = initialSortOrderMapRef.current.get(q.id)
        return initial !== undefined && initial !== q.sort_order
      })
      if (orderChanged.length > 0) {
        const orders = questions.map(q => ({ id: q.id, sort_order: q.sort_order }))
        const res = await fetch(
          `/api/brand-score/surveys/${surveyId}/questions/reorder`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orders }),
          }
        )
        if (!res.ok) throw new Error('並び順の保存に失敗しました')
      }

      // 4. 初期値を現在の値で更新
      const categoryMap = new Map<string, string>()
      const sortOrderMap = new Map<string, number>()
      for (const q of questions) {
        categoryMap.set(q.id, q.category)
        sortOrderMap.set(q.id, q.sort_order)
      }
      initialCategoryMapRef.current = categoryMap
      initialSortOrderMapRef.current = sortOrderMap

      toast.success('保存しました')
    } catch (err) {
      console.error('[SurveyDetail] 保存エラー:', err)
      const msg = err instanceof Error ? err.message : '保存に失敗しました'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  // ── カスタム設問追加 ──
  const handleAddCustom = async () => {
    if (!customText.trim()) return
    setAddingCustom(true)
    try {
      const res = await fetch(`/api/brand-score/surveys/${surveyId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_custom',
          category: customCategory,
          question_text: customText.trim(),
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success('カスタム設問を追加しました')
      setCustomText('')
      await fetchData()
    } catch (err) {
      console.error('[SurveyDetail] カスタム追加エラー:', err)
      toast.error('カスタム設問の追加に失敗しました')
    } finally {
      setAddingCustom(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  }

  const isDraft = survey?.status === 'draft'
  const isActive = survey?.status === 'active'
  const activeCount = questions.length

  // sort_order順にソートした設問リスト
  const sortedQuestions = useMemo(() => {
    return [...questions].sort((a, b) => a.sort_order - b.sort_order)
  }, [questions])

  // ── ローディング ──
  if (loading) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-4">
          <CardContent className="p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-5 w-8" />
              <Skeleton className="h-5 flex-1" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-10" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!survey) {
    return (
      <div className="text-center py-10">
        <p className="text-muted-foreground">サーベイが見つかりません</p>
      </div>
    )
  }

  const statusConfig = STATUS_CONFIG[survey.status] || STATUS_CONFIG.draft

  return (
    <div>
      {/* ── 1. ヘッダー部 ── */}
      <div className="mb-6">
        {/* 作成日／配信期間。一覧へ戻る導線はパンくずが担うため戻るボタンは置かない */}
        <div
          className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground"
          suppressHydrationWarning
        >
          <CalendarDays size={14} />
          <span>{isActive ? '配信期間' : '作成日'}</span>
          {isActive || survey.status === 'closed' ? (
            <span>
              {survey.starts_at ? formatDate(survey.starts_at) : '-'}
              {' 〜 '}
              {survey.ends_at ? formatDate(survey.ends_at) : '未定'}
            </span>
          ) : (
            <span>{formatDate(survey.created_at)}</span>
          )}
        </div>

        <div className="flex items-start justify-between gap-4">
          {/* タイトル + バッジ */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {editingTitle ? (
              <Input
                ref={titleInputRef}
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={e => { if (e.key === 'Enter') handleTitleBlur() }}
                className="text-2xl font-bold h-auto py-0 px-1 border-b border-t-0 border-x-0 rounded-none focus-visible:ring-0"
              />
            ) : (
              <h1
                className="text-2xl font-bold text-foreground truncate cursor-pointer transition-colors hover:text-muted-foreground"
                onClick={handleTitleClick}
                title="クリックして編集"
              >
                {survey.title}
              </h1>
            )}
            {savingTitle && (
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
            )}
            <Badge
              variant="secondary"
              className={`text-[10px] px-1.5 py-0 shrink-0 ${statusConfig.className}`}
            >
              {statusConfig.label}
            </Badge>
          </div>

          {/* アクションボタン */}
          <div className="flex items-center gap-2 shrink-0">
            {innerScore && innerScore.response_count > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={generateInsights}
                disabled={generatingInsights}
              >
                {generatingInsights ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                AI考察を再生成
              </Button>
            )}
            {isDraft && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleInsertTemplates}
                  disabled={insertingTemplates}
                >
                  {insertingTemplates ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <LayoutTemplate size={14} />
                  )}
                  テンプレート設問を追加
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateAi}
                  disabled={generatingAi}
                >
                  {generatingAi ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <WandSparkles size={14} />
                  )}
                  {generatingAi ? 'AI生成中...' : 'AI設問を生成'}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" disabled={updatingStatus || activeCount === 0}>
                      配信開始
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>サーベイを配信開始しますか？</AlertDialogTitle>
                      <AlertDialogDescription>
                        配信後は設問の変更ができなくなります。有効な設問は{activeCount}問です。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>キャンセル</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleStatusChange('active')}>
                        配信開始
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
            {isActive && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={updatingStatus}>
                    配信終了
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>サーベイを終了しますか？</AlertDialogTitle>
                    <AlertDialogDescription>
                      終了すると、新しい回答を受け付けなくなります。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleStatusChange('closed')}>
                      終了する
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. サーベイ情報カード ── */}
      {/* ダッシュボード（Good Action分析）のサマリーカードと同じ体裁に揃える。
          1指標=1カード、アイコン18px＋見出し text-sm、数値 text-3xl 中央 */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4 mb-4">
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList size={18} className="text-foreground" />
              <h3 className="text-sm font-semibold text-foreground m-0">設問数</h3>
            </div>
            <p className="text-3xl font-bold text-foreground m-0 text-center">
              {questions.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1 text-center">問</p>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <Users size={18} className="text-foreground" />
              <h3 className="text-sm font-semibold text-foreground m-0">回答数</h3>
            </div>
            <p className="text-3xl font-bold text-foreground m-0 text-center">
              {survey.responded_count}
            </p>
            <p className="text-xs text-muted-foreground mt-1 text-center">
              /{survey.total_members}人
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <Target size={18} className="text-foreground" />
              <h3 className="text-sm font-semibold text-foreground m-0">回答率</h3>
            </div>
            <p className="text-3xl font-bold text-foreground m-0 text-center">
              {survey.response_rate}%
            </p>
            <p className="text-xs text-muted-foreground mt-1 text-center">
              目標{survey.target_response_rate}%
            </p>
            <Progress value={survey.response_rate} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* ── 3. 回答結果セクション（active/closed時のみ） ── */}
      {(survey.status === 'active' || survey.status === 'closed') && (
        <div className="mb-6">
          {innerScoreLoading ? (
            <div className="space-y-4">
              <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
                <CardContent className="p-5">
                  <Skeleton className="h-4 w-32 mb-3" />
                  <Skeleton className="h-2 w-full mb-4" />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-2 w-full" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
                <CardContent className="p-5">
                  <Skeleton className="h-4 w-24 mb-3" />
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : innerScore && innerScore.response_count > 0 ? (
            // 結果ビューはポータルと共通の SurveyResults（管理画面用の表示は variant="admin"）
            <SurveyResults
              data={innerScore}
              questions={questions}
              insights={survey.insights ?? undefined}
              insightsLoading={generatingInsights}
              variant="admin"
            />
          ) : !innerScoreLoading && innerScore?.response_count === 0 ? (
            <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
              <CardContent className="p-10 text-center">
                <AlertCircle size={40} className="mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground text-sm">
                  まだ回答がありません。サーベイをメンバーに案内してください。
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}

      {/* ── 4. 設問一覧（draft時のみ表示） ── */}
      {isDraft && (
        <div className="mb-6">
          <h2 className="text-base font-bold text-foreground mb-4">
            設問一覧
          </h2>

          {questions.length === 0 ? (
            <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
              <CardContent className="p-10 text-center">
                <ClipboardList size={40} className="mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground text-sm mb-1">設問がありません</p>
                <p className="text-muted-foreground/60 text-xs">
                  テンプレート設問を追加するか、AI設問を生成してください
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
              <CardContent className="p-0">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={sortedQuestions.map(q => q.id)} strategy={verticalListSortingStrategy}>
                    {sortedQuestions.map(q => (
                      <SortableQuestionRow
                        key={q.id}
                        q={q}
                        isDraft={!!isDraft}
                        onCategoryChange={handleCategoryChange}
                        onDelete={handleDeleteQuestion}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── 5. カスタム設問追加フォーム（draft時のみ） ── */}
      {isDraft && (
        <div className="mb-6">
          <h2 className="text-base font-bold text-foreground mb-4">
            カスタム設問を追加
          </h2>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-36 shrink-0">
                    <Select value={customCategory} onValueChange={setCustomCategory}>
                      <SelectTrigger className="h-9 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="why">WHY（理念浸透）</SelectItem>
                        <SelectItem value="how">HOW（方針共感）</SelectItem>
                        <SelectItem value="what">WHAT（行動体現）</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea
                    value={customText}
                    onChange={e => setCustomText(e.target.value)}
                    placeholder="設問テキストを入力（5段階リッカート尺度で回答可能な文）"
                    className="flex-1 bg-background min-h-[36px] resize-none"
                    rows={1}
                  />
                  <Button
                    size="sm"
                    onClick={handleAddCustom}
                    disabled={addingCustom || !customText.trim()}
                    className="shrink-0"
                  >
                    {addingCustom ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Plus size={14} />
                    )}
                    追加
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── 5. 保存 FAB（draft時のみ・include-bz node の FabButton と同装飾） ── */}
      {isDraft && (
        <Fab>
          <FabButton onClick={handleSave} disabled={saving} icon={<Check size={16} />}>
            {saving ? '保存中...' : '保存'}
          </FabButton>
        </Fab>
      )}
    </div>
  )
}
