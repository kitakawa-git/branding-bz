'use client'

// 目標・KPI管理ページ（ポータル）— 1人1目標 + 複数KPI + リソース配分(%) + 期間切り替え
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { usePortalAuth } from '../components/PortalAuthProvider'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { DatePicker } from '@/components/date-picker'
import { Milestone, Plus, Pencil, Trash2, AlertCircle, CalendarDays, X, ChevronDown, ChevronUp, Archive } from 'lucide-react'
import { toast } from 'sonner'

// ============================================
// Types
// ============================================

type GoalKpi = {
  id: string
  goal_id: string
  company_id: string
  user_id: string
  title: string
  deadline: string | null
  progress: number
  weight: number
  status: 'not_started' | 'in_progress' | 'completed'
  created_at: string
  updated_at: string
}

type PersonalGoal = {
  id: string
  company_id: string
  user_id: string
  title: string
  goal_period_id: string | null
  created_at: string
  updated_at: string
}

type GoalPeriod = {
  type: 'quarter' | 'half' | 'year' | 'custom'
  start_date: string
  end_date: string
  show_goal_banner?: boolean
  show_review_banner?: boolean
}

type GoalPeriodRecord = {
  id: string
  company_id: string
  type: string
  start_date: string
  end_date: string
  is_current: boolean
  status: 'active' | 'pending_approval' | 'archived'
  created_at: string
}

type BrandValue = { name: string; description: string }

type KpiFormItem = {
  id: string // temp id for form
  title: string
  deadline: Date | undefined
  weight: number
}

type KpiEditForm = {
  title: string
  deadline: Date | undefined
  progress: number
  weight: number
  status: 'not_started' | 'in_progress' | 'completed'
}

type ArchivedPeriodData = {
  goal: PersonalGoal | null
  kpis: GoalKpi[]
}

type PortalKpiCache = {
  goal: PersonalGoal | null
  kpis: GoalKpi[]
  goalPeriod: GoalPeriod | null
  currentPeriodId: string | null
  archivedPeriods: GoalPeriodRecord[]
}

// ============================================
// Constants
// ============================================

const STATUS_LABELS: Record<string, string> = { not_started: '未着手', in_progress: '進行中', completed: '達成' }
const STATUS_COLORS: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
}
const PERIOD_TYPE_LABELS: Record<string, string> = { quarter: '四半期', half: '半期', half_year: '半期', year: '年度', custom: 'カスタム' }
const PERIOD_DURATION_LABELS: Record<string, string> = { quarter: '3ヶ月', half: '6ヶ月', half_year: '6ヶ月', year: '1年', custom: '' }

const emptyKpiEditForm: KpiEditForm = { title: '', deadline: undefined, progress: 0, weight: 30, status: 'not_started' }

// ============================================
// Helpers
// ============================================

function isOverdue(deadline: string | null, status: string): boolean {
  if (!deadline || status === 'completed') return false
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return new Date(deadline) < today
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
}

function calcWeightedProgress(kpis: GoalKpi[]): number {
  if (kpis.length === 0) return 0
  let totalWeight = 0, weightedSum = 0
  kpis.forEach(k => { const w = k.weight || 0; weightedSum += k.progress * w; totalWeight += w })
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0
}

function getRemainingDays(endDate: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const end = new Date(endDate); end.setHours(0, 0, 0, 0)
  return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function getPeriodTitle(period: GoalPeriod | null): string {
  if (!period) return '目標とKPIを決めましょう！'
  const label = PERIOD_TYPE_LABELS[period.type] || ''
  const dur = PERIOD_DURATION_LABELS[period.type]
  const durStr = dur ? `（${dur}）` : ''
  return `${label}${durStr}目標とKPIを決めましょう！`
}

// ============================================
// Component
// ============================================

export default function KpiPage() {
  const { companyId, user } = usePortalAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const setupTriggered = useRef(false)
  const cacheKey = `portal-kpi-${companyId}-${user?.id}`
  const cached = companyId && user?.id ? getPageCache<PortalKpiCache>(cacheKey) : null

  const [goal, setGoal] = useState<PersonalGoal | null>(cached?.goal ?? null)
  const [kpis, setKpis] = useState<GoalKpi[]>(cached?.kpis ?? [])
  const [goalPeriod, setGoalPeriod] = useState<GoalPeriod | null>(cached?.goalPeriod ?? null)
  const [currentPeriodId, setCurrentPeriodId] = useState<string | null>(cached?.currentPeriodId ?? null)
  const [archivedPeriods, setArchivedPeriods] = useState<GoalPeriodRecord[]>(cached?.archivedPeriods ?? [])
  const [loading, setLoading] = useState(!cached)
  const [saving, setSaving] = useState(false)

  // Setup dialog (2-step: 1=goal, 2=kpi)
  const [setupStep, setSetupStep] = useState<0 | 1 | 2>(0)
  const [setupGoalText, setSetupGoalText] = useState('')
  const [setupKpis, setSetupKpis] = useState<KpiFormItem[]>([{ id: crypto.randomUUID(), title: '', deadline: undefined, weight: 100 }])
  const [missionText, setMissionText] = useState<string | null>(null)
  const [valuesData, setValuesData] = useState<BrandValue[]>([])
  const [brandDataLoaded, setBrandDataLoaded] = useState(false)

  // KPI edit dialog (for editing individual KPIs after initial setup)
  const [kpiEditOpen, setKpiEditOpen] = useState(false)
  const [editingKpiId, setEditingKpiId] = useState<string | null>(null)
  const [kpiEditForm, setKpiEditForm] = useState<KpiEditForm>(emptyKpiEditForm)

  // Goal edit dialog
  const [goalEditOpen, setGoalEditOpen] = useState(false)
  const [goalEditText, setGoalEditText] = useState('')

  // 過去の期間アコーディオン
  const [expandedArchiveId, setExpandedArchiveId] = useState<string | null>(null)
  const [archiveData, setArchiveData] = useState<ArchivedPeriodData | null>(null)
  const [archiveLoading, setArchiveLoading] = useState(false)

  // ============================================
  // Data Fetching
  // ============================================
  const fetchData = useCallback(async () => {
    if (!companyId || !user?.id) return
    try {
      // まず goal_periods と companies.goal_period を取得
      const [periodsRes, companyRes] = await Promise.all([
        supabase.from('goal_periods').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
        supabase.from('companies').select('goal_period').eq('id', companyId).single(),
      ])

      const allPeriods = (periodsRes.data || []) as GoalPeriodRecord[]
      const current = allPeriods.find(p => p.is_current && p.status === 'active') || null
      const archived = allPeriods.filter(p => p.status === 'archived').sort((a, b) => b.start_date.localeCompare(a.start_date))
      const periodData = (companyRes.data?.goal_period as GoalPeriod) || null

      const curPeriodId = current?.id || null
      setCurrentPeriodId(curPeriodId)
      setArchivedPeriods(archived)

      // 現在の期間の目標・KPIを取得
      let goalsQuery = supabase
        .from('personal_goals')
        .select('id, company_id, user_id, title, goal_period_id, created_at, updated_at')
        .eq('company_id', companyId)
        .eq('user_id', user.id)
      if (curPeriodId) {
        goalsQuery = goalsQuery.eq('goal_period_id', curPeriodId)
      } else {
        goalsQuery = goalsQuery.is('goal_period_id', null)
      }

      const [goalsRes, kpisRes] = await Promise.all([
        goalsQuery.limit(1).maybeSingle(),
        supabase
          .from('goal_kpis')
          .select('*')
          .eq('company_id', companyId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: true }),
      ])

      const goalData = goalsRes.error ? null : (goalsRes.data as PersonalGoal)
      // KPIは目標に紐づくものだけフィルタ
      const kpisData = goalData
        ? ((kpisRes.data || []) as GoalKpi[]).filter(k => k.goal_id === goalData.id)
        : []

      setGoal(goalData)
      setKpis(kpisData)
      setGoalPeriod(periodData)
      setPageCache(cacheKey, { goal: goalData, kpis: kpisData, goalPeriod: periodData, currentPeriodId: curPeriodId, archivedPeriods: archived })
    } catch (err) {
      console.error('[KPI] データ取得エラー:', err)
    } finally {
      setLoading(false)
    }
  }, [companyId, user?.id, cacheKey])

  useEffect(() => {
    if (!companyId || !user?.id) return
    if (cached) return
    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, user?.id])

  // ?setup=true でダッシュボードから直接ダイアログを開く
  useEffect(() => {
    if (setupTriggered.current) return
    if (loading) return
    if (searchParams.get('setup') === 'true' && !goal) {
      setupTriggered.current = true
      router.replace('/portal/kpi', { scroll: false })
      openSetupDialog(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, goal, searchParams])

  // ============================================
  // Load Archive Data
  // ============================================
  const loadArchiveData = async (periodId: string) => {
    if (!companyId || !user?.id) return
    setArchiveLoading(true)
    try {
      const [goalRes, kpisRes] = await Promise.all([
        supabase.from('personal_goals').select('id, company_id, user_id, title, goal_period_id, created_at, updated_at')
          .eq('company_id', companyId).eq('user_id', user.id).eq('goal_period_id', periodId).limit(1).maybeSingle(),
        supabase.from('goal_kpis').select('*').eq('company_id', companyId).eq('user_id', user.id).order('created_at', { ascending: true }),
      ])
      const archGoal = goalRes.error ? null : (goalRes.data as PersonalGoal)
      const archKpis = archGoal ? ((kpisRes.data || []) as GoalKpi[]).filter(k => k.goal_id === archGoal.id) : []
      setArchiveData({ goal: archGoal, kpis: archKpis })
    } catch (err) { console.error('[KPI] Archive load error:', err) }
    finally { setArchiveLoading(false) }
  }

  const toggleArchive = (periodId: string) => {
    if (expandedArchiveId === periodId) {
      setExpandedArchiveId(null)
      setArchiveData(null)
    } else {
      setExpandedArchiveId(periodId)
      loadArchiveData(periodId)
    }
  }

  // ============================================
  // Computed
  // ============================================
  const weightedProgress = useMemo(() => calcWeightedProgress(kpis), [kpis])
  const statusCounts = useMemo(() => {
    const c = { not_started: 0, in_progress: 0, completed: 0 }
    kpis.forEach(k => { c[k.status]++ })
    return c
  }, [kpis])
  const totalWeight = useMemo(() => kpis.reduce((s, k) => s + (k.weight || 0), 0), [kpis])

  // Setup dialog: 配分合計
  const setupWeightTotal = useMemo(() => setupKpis.reduce((s, k) => s + (k.weight || 0), 0), [setupKpis])

  // KPI edit: 他のKPIのweight合計（編集中のKPIを除く）
  const otherKpisWeight = useMemo(() => {
    return kpis.filter(k => k.id !== editingKpiId).reduce((s, k) => s + (k.weight || 0), 0)
  }, [kpis, editingKpiId])

  // ============================================
  // Setup Dialog: fetch brand data
  // ============================================
  const openSetupDialog = async (isEdit = false) => {
    if (isEdit && goal) {
      setSetupGoalText(goal.title)
      setSetupKpis(
        kpis.length > 0
          ? kpis.map(k => ({ id: k.id, title: k.title, deadline: k.deadline ? new Date(k.deadline + 'T00:00:00') : undefined, weight: k.weight }))
          : [{ id: crypto.randomUUID(), title: '', deadline: undefined, weight: 100 }]
      )
    } else {
      setSetupGoalText('')
      setSetupKpis([{ id: crypto.randomUUID(), title: '', deadline: undefined, weight: 100 }])
    }
    setSetupStep(1)

    if (!brandDataLoaded && companyId) {
      const { data } = await supabase
        .from('brand_guidelines')
        .select('mission, values')
        .eq('company_id', companyId)
        .single()
      if (data) {
        setMissionText(data.mission || null)
        setValuesData((data.values as BrandValue[]) || [])
      }
      setBrandDataLoaded(true)
    }
  }

  // Step 1 → Step 2
  const handleGoalStepNext = () => {
    if (!setupGoalText.trim()) {
      toast.error('目標を入力してください')
      return
    }
    setSetupStep(2)
  }

  // Setup dialog: KPI form management
  const addSetupKpi = () => {
    setSetupKpis(prev => {
      if (prev.length >= 5) return prev
      const currentTotal = prev.reduce((s, k) => s + (k.weight || 0), 0)
      const remaining = Math.max(0, 100 - currentTotal)
      return [...prev, { id: crypto.randomUUID(), title: '', deadline: undefined, weight: remaining }]
    })
  }
  const removeSetupKpi = (id: string) => {
    setSetupKpis(prev => prev.length > 1 ? prev.filter(k => k.id !== id) : prev)
  }
  const updateSetupKpi = (id: string, field: keyof KpiFormItem, value: unknown) => {
    setSetupKpis(prev => prev.map(k => k.id === id ? { ...k, [field]: value } : k))
  }

  // ============================================
  // Setup Dialog: Save (goal + KPIs)
  // ============================================
  const handleSetupSave = async () => {
    if (!companyId || !user?.id) return
    if (!setupGoalText.trim()) {
      toast.error('目標を入力してください')
      return
    }
    const validKpis = setupKpis.filter(k => k.title.trim())
    if (validKpis.length === 0) {
      toast.error('KPIを最低1つ入力してください')
      return
    }
    if (validKpis.some(k => !k.weight || k.weight <= 0)) {
      toast.error('配分が0%のKPIがあります')
      return
    }
    if (setupWeightTotal > 100) {
      toast.error('配分の合計が100%を超えています')
      return
    }

    setSaving(true)
    try {
      let goalId = goal?.id || null

      if (goalId) {
        const { error } = await supabase
          .from('personal_goals')
          .update({ title: setupGoalText.trim(), updated_at: new Date().toISOString() })
          .eq('id', goalId)
        if (error) throw error
        await supabase.from('goal_kpis').delete().eq('goal_id', goalId)
      } else {
        goalId = crypto.randomUUID()
        const { error } = await supabase
          .from('personal_goals')
          .insert({
            id: goalId,
            company_id: companyId,
            user_id: user.id,
            goal_period_id: currentPeriodId, // 期間紐付け
            title: setupGoalText.trim(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        if (error) throw error
      }

      const kpiPayloads = validKpis.map(k => ({
        id: crypto.randomUUID(),
        goal_id: goalId!,
        company_id: companyId,
        user_id: user.id,
        title: k.title.trim(),
        deadline: k.deadline ? k.deadline.toISOString().slice(0, 10) : null,
        weight: String(k.weight),
        progress: 0,
        status: 'not_started' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))
      const { error: kpiErr } = await supabase.from('goal_kpis').insert(kpiPayloads)
      if (kpiErr) {
        console.error('[KPI] KPI insert error:', kpiErr)
        throw kpiErr
      }

      toast.success('目標とKPIを保存しました')
      setSetupStep(0)
      await fetchData()
    } catch (err) {
      console.error('[KPI] 保存エラー:', err)
      toast.error('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  // ============================================
  // Goal Edit (simple text edit)
  // ============================================
  const openGoalEdit = () => {
    if (!goal) return
    setGoalEditText(goal.title)
    setGoalEditOpen(true)
  }
  const handleGoalEditSave = async () => {
    if (!goal || !goalEditText.trim()) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('personal_goals')
        .update({ title: goalEditText.trim(), updated_at: new Date().toISOString() })
        .eq('id', goal.id)
      if (error) throw error
      toast.success('目標を更新しました')
      setGoalEditOpen(false)
      await fetchData()
    } catch { toast.error('更新に失敗しました') }
    finally { setSaving(false) }
  }

  // ============================================
  // KPI CRUD (individual after setup)
  // ============================================
  const openKpiAdd = () => {
    if (kpis.length >= 5) { toast.error('KPIは最大5つまでです'); return }
    setEditingKpiId(null)
    const currentTotal = kpis.reduce((s, k) => s + (k.weight || 0), 0)
    const remaining = Math.max(0, 100 - currentTotal)
    setKpiEditForm({ ...emptyKpiEditForm, weight: remaining })
    setKpiEditOpen(true)
  }
  const openKpiEdit = (kpi: GoalKpi) => {
    setEditingKpiId(kpi.id)
    setKpiEditForm({
      title: kpi.title,
      deadline: kpi.deadline ? new Date(kpi.deadline + 'T00:00:00') : undefined,
      progress: kpi.progress,
      weight: kpi.weight,
      status: kpi.status,
    })
    setKpiEditOpen(true)
  }
  const updateKpiEditForm = (field: keyof KpiEditForm, value: unknown) => {
    setKpiEditForm(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'progress' && value === 100) next.status = 'completed'
      if (field === 'status' && value === 'completed') next.progress = 100
      return next
    })
  }

  // KPI edit: 配分バリデーション
  const kpiEditWeightTotal = otherKpisWeight + (kpiEditForm.weight || 0)
  const kpiEditWeightOver = kpiEditWeightTotal > 100

  const handleKpiEditSave = async () => {
    if (!companyId || !user?.id || !goal) return
    if (!kpiEditForm.title.trim()) { toast.error('KPIタイトルを入力してください'); return }
    if (!kpiEditForm.weight || kpiEditForm.weight <= 0) { toast.error('配分は1%以上にしてください'); return }
    if (kpiEditWeightOver) { toast.error('配分の合計が100%を超えています'); return }
    setSaving(true)
    try {
      const payload = {
        title: kpiEditForm.title.trim(),
        deadline: kpiEditForm.deadline ? kpiEditForm.deadline.toISOString().slice(0, 10) : null,
        progress: kpiEditForm.progress,
        weight: String(kpiEditForm.weight),
        status: kpiEditForm.status,
        updated_at: new Date().toISOString(),
      }
      if (editingKpiId) {
        const { error } = await supabase.from('goal_kpis').update(payload).eq('id', editingKpiId)
        if (error) throw error
        toast.success('KPIを更新しました')
      } else {
        const { error } = await supabase.from('goal_kpis').insert({
          ...payload,
          id: crypto.randomUUID(),
          goal_id: goal.id,
          company_id: companyId,
          user_id: user.id,
          created_at: new Date().toISOString(),
        })
        if (error) throw error
        toast.success('KPIを追加しました')
      }
      setKpiEditOpen(false)
      await fetchData()
    } catch { toast.error('保存に失敗しました') }
    finally { setSaving(false) }
  }
  const handleKpiDelete = async (kpiId: string) => {
    try {
      const { error } = await supabase.from('goal_kpis').delete().eq('id', kpiId)
      if (error) throw error
      toast.success('KPIを削除しました')
      await fetchData()
    } catch { toast.error('削除に失敗しました') }
  }

  // ============================================
  // Loading skeleton
  // ============================================
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-5 pt-4 pb-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none"><CardContent className="p-5"><Skeleton className="h-4 w-56 mb-3" /></CardContent></Card>
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none"><CardContent className="p-5"><Skeleton className="h-4 w-32 mb-3" /><Skeleton className="h-3 w-full mb-4" /></CardContent></Card>
        {[1, 2].map(i => <Card key={i} className="bg-[hsl(0_0%_97%)] border shadow-none"><CardContent className="p-5"><Skeleton className="h-5 w-48 mb-2" /><Skeleton className="h-2 w-full" /></CardContent></Card>)}
      </div>
    )
  }

  // ============================================
  // Render: 目標未設定
  // ============================================
  if (!goal) {
    return (
      <div className="max-w-4xl mx-auto px-5 pt-4 pb-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">目標・KPI</h1>
          <p className="text-sm text-muted-foreground mt-1">個人目標の設定とKPI管理</p>
        </div>

        {goalPeriod && (
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CalendarDays size={16} className="text-muted-foreground" />
                <span className="text-sm text-foreground">
                  目標期間: {formatDateShort(goalPeriod.start_date)} 〜 {formatDateShort(goalPeriod.end_date)}（{PERIOD_TYPE_LABELS[goalPeriod.type]}）
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="py-16 text-center">
            <Milestone size={48} className="mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-bold text-foreground mb-2">目標がまだ設定されていません</h2>
            {(goalPeriod?.show_goal_banner !== false) ? (
              <>
                <p className="text-sm text-muted-foreground mb-6">
                  ブランドにどう貢献するかを宣言し、具体的なKPIを設定しましょう。
                </p>
                <Button size="lg" onClick={() => openSetupDialog(false)}>
                  目標とKPIを設定する
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                目標設定期間外です。管理者にお問い合わせください。
              </p>
            )}
          </CardContent>
        </Card>

        {/* 過去の期間 */}
        {renderArchivedSection()}

        {renderGoalDialog()}
        {renderKpiSetupDialog()}
      </div>
    )
  }

  // ============================================
  // Render: 目標設定済み
  // ============================================
  const canEdit = goalPeriod?.show_goal_banner !== false
  const canReview = goalPeriod?.show_review_banner === true

  return (
    <div className="max-w-4xl mx-auto px-5 pt-4 pb-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">目標・KPI</h1>
        <p className="text-sm text-muted-foreground mt-1">個人目標の設定とKPI管理</p>
      </div>

      {/* ゴール期間 + 目標表示 */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h2 className="text-xl font-bold text-foreground m-0 leading-relaxed">{goal.title}</h2>
            {canEdit && (
              <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={openGoalEdit}>
                <Pencil size={14} />
              </Button>
            )}
          </div>
          {goalPeriod && (
            <div className="flex items-center gap-2">
              <CalendarDays size={14} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {PERIOD_TYPE_LABELS[goalPeriod.type]}（{formatDateShort(goalPeriod.start_date)} 〜 {formatDateShort(goalPeriod.end_date)}）
              </span>
              {(() => {
                const remaining = getRemainingDays(goalPeriod.end_date)
                const untilStart = getRemainingDays(goalPeriod.start_date)
                if (remaining < 0) return <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700">期間終了</Badge>
                if (untilStart > 0) return <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-yellow-100 text-yellow-700">開始まで{untilStart}日</Badge>
                return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">残り{remaining}日</Badge>
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI総合サマリー + KPI一覧（入れ子） */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">
          {kpis.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold">KPI 総合進捗率</h2>
                <span className="text-2xl font-bold text-foreground">{weightedProgress}%</span>
              </div>
              <Progress value={weightedProgress} className="h-3 mb-4" animate />
              <div className="flex flex-wrap gap-2 mb-5">
                <Badge variant="secondary" className={STATUS_COLORS.not_started}>未着手 {statusCounts.not_started}</Badge>
                <Badge variant="secondary" className={STATUS_COLORS.in_progress}>進行中 {statusCounts.in_progress}</Badge>
                <Badge variant="secondary" className={STATUS_COLORS.completed}>達成 {statusCounts.completed}</Badge>
                <Badge variant="secondary" className="bg-purple-50 text-purple-700">配分合計 {totalWeight}%</Badge>
              </div>
            </>
          )}

          {kpis.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                {canEdit ? 'KPIが未設定です。KPIを追加してください。' : 'KPIが未設定です。'}
              </p>
              {canEdit && (
                <Button onClick={openKpiAdd} className="gap-1.5">
                  <Plus size={16} />
                  KPIを追加
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {kpis.map(kpi => {
                  const overdue = isOverdue(kpi.deadline, kpi.status)
                  return (
                    <div key={kpi.id} className="bg-background rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="text-sm font-bold text-foreground flex-1">{kpi.title}</h3>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[kpi.status]}`}>
                            {STATUS_LABELS[kpi.status]}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-purple-50 text-purple-700">
                            配分 {kpi.weight}%
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mb-2">
                        <Progress value={kpi.progress} className="flex-1 h-2" animate />
                        <span className="text-xs font-semibold text-foreground w-10 text-right">{kpi.progress}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        {kpi.deadline && (
                          <span className={`text-[11px] flex items-center gap-0.5 ${overdue ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                            {overdue && <AlertCircle size={11} />}
                            期限: {formatDate(kpi.deadline)}
                            {overdue && ' (期限超過)'}
                          </span>
                        )}
                        {!kpi.deadline && <span />}
                        {canEdit ? (
                          <div className="flex items-center gap-0.5">
                            <Button variant="ghost" size="icon" className="size-7" onClick={() => openKpiEdit(kpi)}>
                              <Pencil size={12} />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive">
                                  <Trash2 size={12} />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>KPIを削除しますか？</AlertDialogTitle>
                                  <AlertDialogDescription>「{kpi.title}」を削除します。この操作は取り消せません。</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleKpiDelete(kpi.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">削除する</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        ) : canReview ? (
                          <Button variant="ghost" size="icon" className="size-7" onClick={() => openKpiEdit(kpi)}>
                            <Pencil size={12} />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
              {canEdit && kpis.length < 5 && (
                <div className="flex justify-end mt-4">
                  <Button onClick={openKpiAdd} size="sm" variant="outline" className="gap-1.5">
                    <Plus size={14} />
                    KPIを追加
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 過去の期間 */}
      {renderArchivedSection()}

      {/* Setup Dialogs (2-step) */}
      {renderGoalDialog()}
      {renderKpiSetupDialog()}

      {/* Goal Edit Dialog */}
      <Dialog open={goalEditOpen} onOpenChange={setGoalEditOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogTitle>目標を編集</DialogTitle>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs font-bold mb-1.5 block">目標</Label>
              <Textarea value={goalEditText} onChange={e => setGoalEditText(e.target.value)} rows={3} className="resize-none" placeholder="ブランドにどう貢献するかを宣言..." />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={handleGoalEditSave} disabled={saving || !goalEditText.trim()} className="min-w-[100px]">{saving ? '保存中...' : '保存する'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* KPI Edit Dialog */}
      <Dialog open={kpiEditOpen} onOpenChange={setKpiEditOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogTitle>{!canEdit && canReview ? '進捗率を更新' : editingKpiId ? 'KPIを編集' : 'KPIを追加'}</DialogTitle>
          <div className="space-y-4 mt-2">
            {canEdit && (
              <div>
                <Label className="text-xs font-bold mb-1.5 block">KPIタイトル *</Label>
                <Input value={kpiEditForm.title} onChange={e => updateKpiEditForm('title', e.target.value)} placeholder="例: 新規顧客を10社獲得" className="h-9" />
              </div>
            )}
            {!canEdit && canReview && (
              <div className="px-3 py-2 bg-muted rounded-md">
                <p className="text-sm font-semibold text-foreground m-0">{kpiEditForm.title}</p>
              </div>
            )}
            {canEdit && (
              <div>
                <Label className="text-xs font-bold mb-1.5 block">達成期限</Label>
                <DatePicker value={kpiEditForm.deadline} onChange={d => updateKpiEditForm('deadline', d)} placeholder="期限を選択" />
              </div>
            )}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs font-bold">進捗率</Label>
                <span className="text-sm font-bold text-foreground">{kpiEditForm.progress}%</span>
              </div>
              <Slider value={[kpiEditForm.progress]} onValueChange={v => updateKpiEditForm('progress', v[0])} max={100} step={5} className="w-full" />
            </div>
            {canEdit && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold mb-1.5 block">リソース配分</Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={kpiEditForm.weight}
                      onChange={e => updateKpiEditForm('weight', Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                      className="h-9 w-20"
                    />
                    <span className="text-sm font-semibold text-muted-foreground">%</span>
                  </div>
                  <p className={`text-[11px] mt-1 m-0 ${kpiEditWeightOver ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                    {kpiEditWeightOver ? '配分の合計が100%を超えています' : `残り配分: ${Math.max(0, 100 - kpiEditWeightTotal)}%`}
                  </p>
                </div>
                <div>
                  <Label className="text-xs font-bold mb-1.5 block">ステータス</Label>
                  <Select value={kpiEditForm.status} onValueChange={v => updateKpiEditForm('status', v)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_started">未着手</SelectItem>
                      <SelectItem value="in_progress">進行中</SelectItem>
                      <SelectItem value="completed">達成</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={handleKpiEditSave} disabled={saving || kpiEditWeightOver} className="min-w-[100px]">{saving ? '保存中...' : '保存する'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )

  // ============================================
  // 過去の目標・KPIセクション
  // ============================================
  function renderArchivedSection() {
    if (archivedPeriods.length === 0) return null
    return (
      <div className="mt-4">
        <div className="flex items-center gap-2 mb-3">
          <Archive size={16} className="text-muted-foreground" />
          <h2 className="text-sm font-bold text-foreground">過去の目標・KPI</h2>
        </div>
        <div className="space-y-2">
          {archivedPeriods.map(ap => {
            const isArchExp = expandedArchiveId === ap.id
            return (
              <Card key={ap.id} className="bg-[hsl(0_0%_97%)] border shadow-none">
                <CardContent className="p-0">
                  <button onClick={() => toggleArchive(ap.id)} className="w-full p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors text-left">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{PERIOD_TYPE_LABELS[ap.type] || ap.type}</Badge>
                        <span className="text-sm text-foreground">{formatDate(ap.start_date)} 〜 {formatDate(ap.end_date)}</span>
                      </div>
                    </div>
                    {isArchExp ? <ChevronUp size={16} className="text-muted-foreground shrink-0" /> : <ChevronDown size={16} className="text-muted-foreground shrink-0" />}
                  </button>

                  {isArchExp && (
                    <div className="border-t px-4 pb-4 pt-3">
                      {archiveLoading ? (
                        <div className="space-y-3">
                          <Skeleton className="h-8 w-full" />
                          <Skeleton className="h-8 w-full" />
                        </div>
                      ) : !archiveData?.goal ? (
                        <p className="text-sm text-muted-foreground text-center py-4">この期間には目標が設定されていません</p>
                      ) : (
                        <div className="space-y-3">
                          <div className="bg-background rounded-lg p-3 border">
                            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">目標</Label>
                            <p className="text-sm font-semibold text-foreground mt-1 m-0">{archiveData.goal.title}</p>
                          </div>
                          {archiveData.kpis.length > 0 && (
                            <div className="space-y-2">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">KPI ({archiveData.kpis.length}件)</span>
                              {archiveData.kpis.map(k => (
                                <div key={k.id} className="bg-background rounded-lg p-3 border">
                                  <div className="flex items-start justify-between gap-2 mb-1">
                                    <span className="text-xs font-semibold text-foreground flex-1">{k.title}</span>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <Badge variant="secondary" className={`text-[9px] px-1 py-0 ${STATUS_COLORS[k.status]}`}>{STATUS_LABELS[k.status]}</Badge>
                                      <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-purple-50 text-purple-700">配分 {k.weight}%</Badge>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Progress value={k.progress} className="flex-1 h-1.5" />
                                    <span className="text-[10px] font-semibold w-7 text-right">{k.progress}%</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {archiveData.kpis.length === 0 && <p className="text-xs text-muted-foreground">KPIが設定されていません</p>}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  // ============================================
  // Step 1: Goal Dialog (mission/values + goal input)
  // ============================================
  function renderGoalDialog() {
    return (
      <Dialog open={setupStep === 1} onOpenChange={open => { if (!open) setSetupStep(0) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          <div className="sticky top-0 bg-background z-10 border-b px-6 py-4 flex items-center justify-between">
            <DialogTitle className="text-base font-bold">{getPeriodTitle(goalPeriod)}</DialogTitle>
            <button onClick={() => setSetupStep(0)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="px-6 py-5 space-y-6">
            <div>
              <p className="text-sm text-foreground font-semibold mb-1">
                &ldquo;ブランドにどう貢献するか&rdquo;を宣言しましょう。
              </p>
              <p className="text-xs text-muted-foreground">
                ミッションとバリューを踏まえ、具体的かつ測定できる目標を記入してください。
              </p>
            </div>

            {(missionText || valuesData.length > 0) && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                {missionText && (
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">私たちのミッション</Label>
                    <p className="text-sm font-semibold text-foreground mt-1 m-0 leading-relaxed">{missionText}</p>
                  </div>
                )}
                {valuesData.length > 0 && (
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">私たちのバリュー</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {valuesData.map((v, i) => (
                        <div key={i} className="bg-background rounded-md p-2.5 border">
                          <p className="text-xs font-bold text-foreground m-0">{v.name}</p>
                          {v.description && <p className="text-[11px] text-muted-foreground mt-0.5 m-0">{v.description}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <Label className="text-xs font-bold mb-1.5 block">
                あなたの{goalPeriod ? `${PERIOD_TYPE_LABELS[goalPeriod.type]}（${PERIOD_DURATION_LABELS[goalPeriod.type] || ''}）` : ''}目標
              </Label>
              <Textarea
                value={setupGoalText}
                onChange={e => setSetupGoalText(e.target.value)}
                rows={3}
                className="resize-none"
                placeholder="例：ブランド学習動画を月2本公開し、社内の理解度を30%向上させる"
              />
            </div>
          </div>

          <div className="sticky bottom-0 bg-background z-10 border-t px-6 py-4">
            <Button onClick={handleGoalStepNext} className="w-full">
              次へ — KPIを設定する
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // ============================================
  // Step 2: KPI Setup Dialog
  // ============================================
  function renderKpiSetupDialog() {
    const isOver = setupWeightTotal > 100
    return (
      <Dialog open={setupStep === 2} onOpenChange={open => { if (!open) setSetupStep(0) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          <div className="sticky top-0 bg-background z-10 border-b px-6 py-4 flex items-center justify-between">
            <DialogTitle className="text-base font-bold">KPIを設定する</DialogTitle>
            <button onClick={() => setSetupStep(0)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="px-6 py-5 space-y-6">
            {/* 設定済み目標の表示 */}
            <div className="bg-muted/50 rounded-lg p-4">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">あなたの目標</Label>
              <p className="text-sm font-semibold text-foreground mt-1 m-0 leading-relaxed">{setupGoalText}</p>
            </div>

            {/* 配分サマリー */}
            <div className={`rounded-lg p-3 border text-center ${isOver ? 'bg-red-50 border-red-200' : 'bg-purple-50 border-purple-200'}`}>
              <span className={`text-xs font-bold ${isOver ? 'text-red-700' : 'text-purple-700'}`}>
                {isOver
                  ? `配分合計 ${setupWeightTotal}% — 100%を超えています`
                  : `リソース配分: ${setupWeightTotal}% / 100%（残り ${100 - setupWeightTotal}%）`
                }
              </span>
            </div>

            {/* KPI入力 */}
            <div>
              <p className="text-xs text-muted-foreground mb-3">
                目標を達成するための具体的なKPIと、リソース配分（合計100%以内）を設定しましょう。
              </p>
              <div className="space-y-3">
                {setupKpis.map((kpi, idx) => (
                  <div key={kpi.id} className="bg-muted/30 rounded-lg p-3 border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-muted-foreground">KPI {idx + 1}</span>
                      {setupKpis.length > 1 && (
                        <button onClick={() => removeSetupKpi(kpi.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <Input
                      value={kpi.title}
                      onChange={e => updateSetupKpi(kpi.id, 'title', e.target.value)}
                      placeholder="KPIタイトル"
                      className="h-8 text-sm"
                    />
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <DatePicker
                          value={kpi.deadline}
                          onChange={d => updateSetupKpi(kpi.id, 'deadline', d)}
                          placeholder="達成期限"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={kpi.weight}
                          onChange={e => updateSetupKpi(kpi.id, 'weight', Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                          className="h-9 w-16 text-center"
                        />
                        <span className="text-xs font-semibold text-muted-foreground">%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={addSetupKpi} disabled={setupKpis.length >= 5} className="mt-3 gap-1 text-xs">
                <Plus size={14} />
                KPIを追加{setupKpis.length >= 5 ? '（上限5つ）' : ''}
              </Button>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-background z-10 border-t px-6 py-4 flex gap-3">
            <Button variant="outline" onClick={() => setSetupStep(1)} className="flex-1">
              戻る
            </Button>
            <Button onClick={handleSetupSave} disabled={saving || isOver} className="flex-1">
              {saving ? '保存中...' : '保存する'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }
}
