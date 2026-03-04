'use client'

// 全社員 目標・KPI管理ページ（管理画面）— ゴール期間設定 + 期間切り替え + 1人1目標 閲覧専用一覧
import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../components/AuthProvider'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DatePicker } from '@/components/date-picker'
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
import { Switch } from '@/components/ui/switch'
import { ChevronDown, ChevronUp, AlertCircle, CalendarDays, Trash2, Clock, Archive, Search } from 'lucide-react'
import { toast } from 'sonner'

// ============================================
// Types
// ============================================

type GoalKpi = {
  id: string
  goal_id: string
  title: string
  deadline: string | null
  progress: number
  weight: number
  status: string
}

type MemberSummary = {
  auth_id: string
  name: string
  position: string | null
  photo_url: string | null
  goalText: string | null
  goalId: string | null
  kpis: GoalKpi[]
  kpiCount: number
  completedKpiCount: number
  overallProgress: number
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

type AdminKpiCache = {
  members: MemberSummary[]
  goalPeriod: GoalPeriod | null
  currentPeriodRecord: GoalPeriodRecord | null
  archivedPeriods: GoalPeriodRecord[]
}

// ============================================
// Constants
// ============================================

const STATUS_LABELS: Record<string, string> = { not_started: '未着手', in_progress: '進行中', completed: '達成' }
const STATUS_COLORS: Record<string, string> = { not_started: 'bg-gray-100 text-gray-600', in_progress: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700' }
const PERIOD_TYPE_LABELS: Record<string, string> = { quarter: '四半期', half: '半期', half_year: '半期', year: '年度', custom: 'カスタム' }

// ============================================
// Helpers
// ============================================

// DB type (half_year) ↔ UI type (half) 変換
function dbTypeToUi(t: string): string { return t === 'half_year' ? 'half' : t }
function uiTypeToDb(t: string): string { return t === 'half' ? 'half_year' : t }

function calcWeightedProgress(kpis: GoalKpi[]): number {
  if (kpis.length === 0) return 0
  let tw = 0, ws = 0
  kpis.forEach(k => { const w = k.weight || 0; ws += k.progress * w; tw += w })
  return tw > 0 ? Math.round(ws / tw) : 0
}

function isOverdue(deadline: string | null, status: string): boolean {
  if (!deadline || status === 'completed') return false
  const t = new Date(); t.setHours(0, 0, 0, 0)
  return new Date(deadline) < t
}

function formatDate(s: string): string {
  const d = new Date(s)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function calcEndDate(type: string, start: string): string {
  if (!start || type === 'custom') return ''
  const d = new Date(start)
  switch (type) { case 'quarter': d.setMonth(d.getMonth() + 3); break; case 'half': case 'half_year': d.setMonth(d.getMonth() + 6); break; case 'year': d.setFullYear(d.getFullYear() + 1); break; default: return '' }
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

function calcNextEndDate(type: string, startStr: string, prevStartStr: string, prevEndStr: string): string {
  if (type === 'custom') {
    // カスタムの場合、前回と同じ日数
    const prevStart = new Date(prevStartStr)
    const prevEnd = new Date(prevEndStr)
    const days = Math.round((prevEnd.getTime() - prevStart.getTime()) / (1000 * 60 * 60 * 24))
    const d = new Date(startStr)
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  }
  return calcEndDate(type, startStr)
}

function addOneDayStr(dateStr: string): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

// ============================================
// Component
// ============================================

export default function AdminKpiPage() {
  const { companyId } = useAuth()
  const cacheKey = `admin-kpi-${companyId}`
  const cached = companyId ? getPageCache<AdminKpiCache>(cacheKey) : null

  const [members, setMembers] = useState<MemberSummary[]>(cached?.members ?? [])
  const [loading, setLoading] = useState(!cached)
  const [filter, setFilter] = useState<'all' | 'no_goals' | 'low_progress'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // ゴール期間
  const [periodType, setPeriodType] = useState<string>(cached?.goalPeriod?.type || '')
  const [startDate, setStartDate] = useState<Date | undefined>(cached?.goalPeriod?.start_date ? new Date(cached.goalPeriod.start_date + 'T00:00:00') : undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(cached?.goalPeriod?.end_date ? new Date(cached.goalPeriod.end_date + 'T00:00:00') : undefined)
  const [periodSaving, setPeriodSaving] = useState(false)
  const [showGoalBanner, setShowGoalBanner] = useState<boolean>(cached?.goalPeriod?.show_goal_banner ?? true)
  const [showReviewBanner, setShowReviewBanner] = useState<boolean>(cached?.goalPeriod?.show_review_banner ?? true)

  // goal_periods テーブル
  const [currentPeriodRecord, setCurrentPeriodRecord] = useState<GoalPeriodRecord | null>(cached?.currentPeriodRecord ?? null)
  const [pendingPeriod, setPendingPeriod] = useState<GoalPeriodRecord | null>(null)
  const [archivedPeriods, setArchivedPeriods] = useState<GoalPeriodRecord[]>(cached?.archivedPeriods ?? [])
  const [approvingSaving, setApprovingSaving] = useState(false)

  // 承認待ちの編集用
  const [pendingType, setPendingType] = useState<string>('')
  const [pendingStart, setPendingStart] = useState<Date | undefined>(undefined)
  const [pendingEnd, setPendingEnd] = useState<Date | undefined>(undefined)

  // 過去の期間展開
  const [expandedArchiveId, setExpandedArchiveId] = useState<string | null>(null)
  const [archiveMembers, setArchiveMembers] = useState<MemberSummary[]>([])
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [archiveExpandedMember, setArchiveExpandedMember] = useState<string | null>(null)

  // ============================================
  // Fetch
  // ============================================
  const fetchData = useCallback(async () => {
    if (!companyId) return
    try {
      const [membersRes, periodsRes, companyRes] = await Promise.all([
        supabase.from('members').select('auth_id, display_name, profile:profiles(name, photo_url, position)').eq('company_id', companyId).eq('is_active', true),
        supabase.from('goal_periods').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
        supabase.from('companies').select('goal_period').eq('id', companyId).single(),
      ])

      const period = (companyRes.data?.goal_period as GoalPeriod) || null
      const allPeriods = (periodsRes.data || []) as GoalPeriodRecord[]

      const current = allPeriods.find(p => p.is_current && p.status === 'active') || null
      const pending = allPeriods.find(p => p.status === 'pending_approval') || null
      const archived = allPeriods.filter(p => p.status === 'archived').sort((a, b) => b.start_date.localeCompare(a.start_date))

      setCurrentPeriodRecord(current)
      setPendingPeriod(pending)
      setArchivedPeriods(archived)

      // 承認待ちの編集用state初期化
      if (pending) {
        setPendingType(dbTypeToUi(pending.type))
        setPendingStart(new Date(pending.start_date + 'T00:00:00'))
        setPendingEnd(new Date(pending.end_date + 'T00:00:00'))
      }

      // 自動期間生成: 現在の期間が終了していて、pending_approvalがなければ自動生成
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (current && !pending) {
        const endD = new Date(current.end_date)
        endD.setHours(0, 0, 0, 0)
        if (endD < today) {
          const nextStartStr = addOneDayStr(current.end_date)
          const nextEndStr = calcNextEndDate(current.type, nextStartStr, current.start_date, current.end_date)
          const { data: newPeriod, error: insertErr } = await supabase.from('goal_periods').insert({
            company_id: companyId,
            type: current.type,
            start_date: nextStartStr,
            end_date: nextEndStr,
            is_current: false,
            status: 'pending_approval',
          }).select().single()
          if (!insertErr && newPeriod) {
            const rec = newPeriod as GoalPeriodRecord
            setPendingPeriod(rec)
            setPendingType(dbTypeToUi(rec.type))
            setPendingStart(new Date(rec.start_date + 'T00:00:00'))
            setPendingEnd(new Date(rec.end_date + 'T00:00:00'))
          }
        }
      }

      // 現在の期間のgoal_period_idで目標・KPIを取得
      const currentPeriodId = current?.id || null
      let goalsQuery = supabase.from('personal_goals').select('id, user_id, title, goal_period_id').eq('company_id', companyId)
      if (currentPeriodId) {
        goalsQuery = goalsQuery.eq('goal_period_id', currentPeriodId)
      } else {
        // goal_periodsが1つもない場合は goal_period_id IS NULL のデータを取得（移行前データ）
        goalsQuery = goalsQuery.is('goal_period_id', null)
      }
      const [goalsRes, kpisRes] = await Promise.all([
        goalsQuery,
        supabase.from('goal_kpis').select('id, goal_id, user_id, title, deadline, progress, weight, status').eq('company_id', companyId).order('created_at', { ascending: true }),
      ])

      // Maps
      const goalByUser = new Map<string, { id: string; title: string }>()
      ;(goalsRes.data || []).forEach((g: { id: string; user_id: string; title: string }) => {
        goalByUser.set(g.user_id, { id: g.id, title: g.title })
      })

      // KPIを現在の期間の目標IDだけでフィルタ
      const currentGoalIds = new Set(goalByUser.values().map(g => g.id) ? [...goalByUser.values()].map(g => g.id) : [])
      const kpisByGoal = new Map<string, GoalKpi[]>()
      ;(kpisRes.data || []).forEach((k: GoalKpi) => {
        if (!currentGoalIds.has(k.goal_id)) return
        const list = kpisByGoal.get(k.goal_id) || []
        list.push(k)
        kpisByGoal.set(k.goal_id, list)
      })

      const summaries: MemberSummary[] = (membersRes.data || []).map((m: { auth_id: string; display_name: string; profile: { name: string; photo_url: string; position: string } | { name: string; photo_url: string; position: string }[] | null }) => {
        const p = Array.isArray(m.profile) ? m.profile[0] : m.profile
        const g = goalByUser.get(m.auth_id)
        const kpis = g ? (kpisByGoal.get(g.id) || []) : []
        return {
          auth_id: m.auth_id,
          name: p?.name || m.display_name || '不明',
          position: p?.position || null,
          photo_url: p?.photo_url || null,
          goalText: g?.title || null,
          goalId: g?.id || null,
          kpis,
          kpiCount: kpis.length,
          completedKpiCount: kpis.filter(k => k.status === 'completed').length,
          overallProgress: calcWeightedProgress(kpis),
        }
      })

      setMembers(summaries)
      if (period) {
        setPeriodType(period.type)
        setStartDate(new Date(period.start_date + 'T00:00:00'))
        setEndDate(new Date(period.end_date + 'T00:00:00'))
        setShowGoalBanner(period.show_goal_banner ?? true)
        setShowReviewBanner(period.show_review_banner ?? true)
      } else if (current) {
        // goal_periodsからperiod情報を補完
        setPeriodType(dbTypeToUi(current.type))
        setStartDate(new Date(current.start_date + 'T00:00:00'))
        setEndDate(new Date(current.end_date + 'T00:00:00'))
      }
      setPageCache(cacheKey, { members: summaries, goalPeriod: period, currentPeriodRecord: current, archivedPeriods: archived })
    } catch (err) { console.error('[AdminKPI] Error:', err) }
    finally { setLoading(false) }
  }, [companyId, cacheKey])

  useEffect(() => { if (companyId && !cached) fetchData() }, [companyId, cached, fetchData])

  // ============================================
  // Period auto-calc
  // ============================================
  const handlePeriodTypeChange = (t: string) => {
    setPeriodType(t)
    if (t !== 'custom' && startDate) { const e = calcEndDate(t, startDate.toISOString().slice(0, 10)); if (e) setEndDate(new Date(e + 'T00:00:00')) }
  }
  const handleStartChange = (d: Date | undefined) => {
    setStartDate(d)
    if (d && periodType && periodType !== 'custom') { const e = calcEndDate(periodType, d.toISOString().slice(0, 10)); if (e) setEndDate(new Date(e + 'T00:00:00')) }
  }

  // ============================================
  // Period Save (goal_periods + companies.goal_period 同時更新)
  // ============================================
  const handleSavePeriod = async () => {
    if (!companyId || !periodType || !startDate || !endDate) { toast.error('すべての項目を設定してください'); return }
    setPeriodSaving(true)
    try {
      const startStr = startDate.toISOString().slice(0, 10)
      const endStr = endDate.toISOString().slice(0, 10)
      const dbType = uiTypeToDb(periodType)

      // goal_periods テーブルに保存
      if (currentPeriodRecord) {
        // 既存の active レコードを更新
        const { error } = await supabase.from('goal_periods').update({
          type: dbType, start_date: startStr, end_date: endStr,
        }).eq('id', currentPeriodRecord.id)
        if (error) throw error
      } else {
        // 新規作成
        const { data: newRec, error } = await supabase.from('goal_periods').insert({
          company_id: companyId, type: dbType,
          start_date: startStr, end_date: endStr,
          is_current: true, status: 'active',
        }).select().single()
        if (error) throw error
        setCurrentPeriodRecord(newRec as GoalPeriodRecord)
      }

      // companies.goal_period JSONB も更新（バナーフラグ保持）
      const payload: GoalPeriod = { type: periodType as GoalPeriod['type'], start_date: startStr, end_date: endStr, show_goal_banner: showGoalBanner, show_review_banner: showReviewBanner }
      const { error: compErr } = await supabase.from('companies').update({ goal_period: payload }).eq('id', companyId)
      if (compErr) throw compErr

      toast.success('目標期間を保存しました')
      const c = getPageCache<AdminKpiCache>(cacheKey)
      if (c) setPageCache(cacheKey, { ...c, goalPeriod: payload })
    } catch { toast.error('保存に失敗しました') }
    finally { setPeriodSaving(false) }
  }

  // ============================================
  // Banner Toggle
  // ============================================
  const handleToggleBanner = async (key: 'show_goal_banner' | 'show_review_banner', value: boolean) => {
    if (key === 'show_goal_banner') setShowGoalBanner(value)
    else setShowReviewBanner(value)

    if (!companyId) return
    try {
      const { data } = await supabase.from('companies').select('goal_period').eq('id', companyId).single()
      const current = (data?.goal_period as GoalPeriod) || {}
      const updated = { ...current, [key]: value }
      const { error } = await supabase.from('companies').update({ goal_period: updated }).eq('id', companyId)
      if (error) throw error
      toast.success('設定を更新しました')
      const c = getPageCache<AdminKpiCache>(cacheKey)
      if (c) setPageCache(cacheKey, { ...c, goalPeriod: updated as GoalPeriod })
    } catch { toast.error('更新に失敗しました') }
  }

  // ============================================
  // Approve New Period
  // ============================================
  const handleApprovePeriod = async () => {
    if (!companyId || !pendingPeriod || !pendingStart || !pendingEnd) return
    setApprovingSaving(true)
    try {
      const startStr = pendingStart.toISOString().slice(0, 10)
      const endStr = pendingEnd.toISOString().slice(0, 10)
      const dbType = uiTypeToDb(pendingType)

      // 1. 旧期間を archived に
      if (currentPeriodRecord) {
        await supabase.from('goal_periods').update({ status: 'archived', is_current: false }).eq('id', currentPeriodRecord.id)
      }

      // 2. 新期間を active に（編集内容を反映）
      await supabase.from('goal_periods').update({
        type: dbType, start_date: startStr, end_date: endStr,
        status: 'active', is_current: true,
      }).eq('id', pendingPeriod.id)

      // 3. companies.goal_period を新期間で更新 + バナーリセット
      const newPeriodPayload: GoalPeriod = {
        type: pendingType as GoalPeriod['type'],
        start_date: startStr, end_date: endStr,
        show_goal_banner: true, show_review_banner: false,
      }
      await supabase.from('companies').update({ goal_period: newPeriodPayload }).eq('id', companyId)

      toast.success('新しい期間を開始しました')
      // リフレッシュ
      setPendingPeriod(null)
      setShowGoalBanner(true)
      setShowReviewBanner(false)
      await fetchData()
    } catch { toast.error('期間の切り替えに失敗しました') }
    finally { setApprovingSaving(false) }
  }

  // 承認待ちの期間タイプ変更
  const handlePendingTypeChange = (t: string) => {
    setPendingType(t)
    if (t !== 'custom' && pendingStart) {
      const e = calcEndDate(t, pendingStart.toISOString().slice(0, 10))
      if (e) setPendingEnd(new Date(e + 'T00:00:00'))
    }
  }
  const handlePendingStartChange = (d: Date | undefined) => {
    setPendingStart(d)
    if (d && pendingType && pendingType !== 'custom') {
      const e = calcEndDate(pendingType, d.toISOString().slice(0, 10))
      if (e) setPendingEnd(new Date(e + 'T00:00:00'))
    }
  }

  // ============================================
  // Load Archive Period Members
  // ============================================
  const loadArchiveMembers = async (periodId: string) => {
    if (!companyId) return
    setArchiveLoading(true)
    setArchiveExpandedMember(null)
    try {
      const [membersRes, goalsRes, kpisRes] = await Promise.all([
        supabase.from('members').select('auth_id, display_name, profile:profiles(name, photo_url, position)').eq('company_id', companyId).eq('is_active', true),
        supabase.from('personal_goals').select('id, user_id, title').eq('company_id', companyId).eq('goal_period_id', periodId),
        supabase.from('goal_kpis').select('id, goal_id, user_id, title, deadline, progress, weight, status').eq('company_id', companyId).order('created_at', { ascending: true }),
      ])

      const goalByUser = new Map<string, { id: string; title: string }>()
      ;(goalsRes.data || []).forEach((g: { id: string; user_id: string; title: string }) => {
        goalByUser.set(g.user_id, { id: g.id, title: g.title })
      })

      const goalIds = new Set([...goalByUser.values()].map(g => g.id))
      const kpisByGoal = new Map<string, GoalKpi[]>()
      ;(kpisRes.data || []).forEach((k: GoalKpi) => {
        if (!goalIds.has(k.goal_id)) return
        const list = kpisByGoal.get(k.goal_id) || []
        list.push(k)
        kpisByGoal.set(k.goal_id, list)
      })

      const summaries: MemberSummary[] = (membersRes.data || [])
        .map((m: { auth_id: string; display_name: string; profile: { name: string; photo_url: string; position: string } | { name: string; photo_url: string; position: string }[] | null }) => {
          const p = Array.isArray(m.profile) ? m.profile[0] : m.profile
          const g = goalByUser.get(m.auth_id)
          const kpis = g ? (kpisByGoal.get(g.id) || []) : []
          return {
            auth_id: m.auth_id,
            name: p?.name || m.display_name || '不明',
            position: p?.position || null,
            photo_url: p?.photo_url || null,
            goalText: g?.title || null,
            goalId: g?.id || null,
            kpis,
            kpiCount: kpis.length,
            completedKpiCount: kpis.filter(k => k.status === 'completed').length,
            overallProgress: calcWeightedProgress(kpis),
          }
        })
        .filter(m => m.goalText) // 過去の期間: 目標がある人だけ表示

      setArchiveMembers(summaries)
    } catch (err) { console.error('[AdminKPI] Archive load error:', err) }
    finally { setArchiveLoading(false) }
  }

  const toggleArchive = (periodId: string) => {
    if (expandedArchiveId === periodId) {
      setExpandedArchiveId(null)
      setArchiveMembers([])
    } else {
      setExpandedArchiveId(periodId)
      loadArchiveMembers(periodId)
    }
  }

  // ============================================
  // Goal Delete
  // ============================================
  const handleDeleteGoal = async (goalId: string, memberName: string) => {
    try {
      const { error } = await supabase.from('personal_goals').delete().eq('id', goalId)
      if (error) throw error
      toast.success(`${memberName}さんの目標を削除しました`)
      setExpandedId(null)
      await fetchData()
    } catch {
      toast.error('削除に失敗しました')
    }
  }

  // ============================================
  // Filter
  // ============================================
  const filtered = useMemo(() => {
    let result = members
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(m =>
        m.name.toLowerCase().includes(q) ||
        (m.position && m.position.toLowerCase().includes(q)) ||
        (m.goalText && m.goalText.toLowerCase().includes(q)) ||
        m.kpis.some(k => k.title.toLowerCase().includes(q))
      )
    }
    switch (filter) {
      case 'no_goals': return result.filter(m => !m.goalText)
      case 'low_progress': return [...result].sort((a, b) => a.overallProgress - b.overallProgress)
      default: return result
    }
  }, [members, filter, searchQuery])

  const stats = useMemo(() => {
    const total = members.length
    const withGoals = members.filter(m => m.goalText).length
    return { total, withGoals, noGoals: total - withGoals }
  }, [members])

  // 期間が終了しているか
  const isPeriodExpired = useMemo(() => {
    if (!currentPeriodRecord) return false
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const endD = new Date(currentPeriodRecord.end_date); endD.setHours(0, 0, 0, 0)
    return endD < today
  }, [currentPeriodRecord])

  // ============================================
  // Render
  // ============================================
  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-32 mb-6" />
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-6"><CardContent className="p-5"><Skeleton className="h-5 w-40 mb-4" /><div className="flex gap-3"><Skeleton className="h-9 w-[180px]" /><Skeleton className="h-9 w-[180px]" /><Skeleton className="h-9 w-[180px]" /></div></CardContent></Card>
        {[1, 2, 3, 4].map(i => <Card key={i} className="bg-[hsl(0_0%_97%)] border shadow-none mb-3"><CardContent className="p-4"><div className="flex items-center gap-3"><Skeleton className="size-9 rounded-full" /><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-32 ml-auto" /></div></CardContent></Card>)}
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">目標・KPI管理</h1>

      {/* ===== 承認待ちバナー ===== */}
      {pendingPeriod && isPeriodExpired && (
        <Card className="bg-amber-50 border-amber-200 shadow-none mb-6">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={16} className="text-amber-600" />
              <h2 className="text-sm font-bold text-amber-900">期間終了 — 新しい期間の承認</h2>
            </div>
            <p className="text-sm text-amber-800 mb-4 m-0">
              前期（{formatDate(currentPeriodRecord!.start_date)}〜{formatDate(currentPeriodRecord!.end_date)}）が終了しました。新しい期間を確認して開始してください。
            </p>
            <div className="flex flex-wrap gap-3 items-end mb-4">
              <div className="w-[160px]">
                <Label className="text-xs font-bold mb-1.5 block text-amber-900">期間タイプ</Label>
                <Select value={pendingType} onValueChange={handlePendingTypeChange}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quarter">四半期</SelectItem>
                    <SelectItem value="half">半期</SelectItem>
                    <SelectItem value="year">年度</SelectItem>
                    <SelectItem value="custom">カスタム</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[180px]">
                <Label className="text-xs font-bold mb-1.5 block text-amber-900">開始日</Label>
                <DatePicker value={pendingStart} onChange={handlePendingStartChange} placeholder="開始日" />
              </div>
              <div className="w-[180px]">
                <Label className="text-xs font-bold mb-1.5 block text-amber-900">終了日</Label>
                <DatePicker value={pendingEnd} onChange={d => setPendingEnd(d)} placeholder="終了日" disabled={!!pendingType && pendingType !== 'custom'} />
              </div>
            </div>
            <Button onClick={handleApprovePeriod} disabled={approvingSaving || !pendingStart || !pendingEnd} className="bg-amber-600 hover:bg-amber-700 text-white">
              {approvingSaving ? '処理中...' : '新しい期間を開始する'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ===== ゴール期間設定 ===== */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-6">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-bold">ゴール期間設定</h2>
            {isPeriodExpired && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 ml-2">期間終了</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="w-[160px]">
              <Label className="text-xs font-bold mb-1.5 block">期間タイプ</Label>
              <Select value={periodType} onValueChange={handlePeriodTypeChange}>
                <SelectTrigger className="h-9"><SelectValue placeholder="選択..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="quarter">四半期</SelectItem>
                  <SelectItem value="half">半期</SelectItem>
                  <SelectItem value="year">年度</SelectItem>
                  <SelectItem value="custom">カスタム</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-[180px]">
              <Label className="text-xs font-bold mb-1.5 block">開始日</Label>
              <DatePicker value={startDate} onChange={handleStartChange} placeholder="開始日" />
            </div>
            <div className="w-[180px]">
              <Label className="text-xs font-bold mb-1.5 block">終了日</Label>
              <DatePicker value={endDate} onChange={d => setEndDate(d)} placeholder="終了日" disabled={!!periodType && periodType !== 'custom'} />
            </div>
            <Button onClick={handleSavePeriod} disabled={periodSaving || !periodType || !startDate || !endDate} size="sm" className="h-9">
              {periodSaving ? '保存中...' : '保存する'}
            </Button>
          </div>

          {/* バナー表示切り替え */}
          <div className="flex flex-wrap gap-6 mt-5 pt-4 border-t">
            <div className="flex items-center gap-3">
              <Switch id="goal-banner" checked={showGoalBanner} onCheckedChange={v => handleToggleBanner('show_goal_banner', v)} />
              <Label htmlFor="goal-banner" className="text-xs cursor-pointer">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#F41189] mr-1.5 align-middle" />
                「目標とKPIを決めましょう」バナー
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="review-banner" checked={showReviewBanner} onCheckedChange={v => handleToggleBanner('show_review_banner', v)} />
              <Label htmlFor="review-banner" className="text-xs cursor-pointer">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#47C95C] mr-1.5 align-middle" />
                「自己評価を行いましょう」バナー
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== 統計 + フィルター + メンバー一覧 ===== */}
      <div className="border rounded-lg overflow-hidden bg-[hsl(0_0%_97%)]">
        <div className="p-5 space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="text-sm"><span className="text-muted-foreground">全社員</span><span className="ml-1.5 font-bold">{stats.total}名</span></div>
            <div className="text-sm"><span className="text-muted-foreground">目標設定済み</span><span className="ml-1.5 font-bold text-green-600">{stats.withGoals}名</span></div>
            <div className="text-sm"><span className="text-muted-foreground">目標未設定</span><span className="ml-1.5 font-bold text-red-600">{stats.noGoals}名</span></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {([{ key: 'all', label: 'すべて' }, { key: 'no_goals', label: '目標未設定者' }, { key: 'low_progress', label: '進捗率が低い順' }] as const).map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === f.key ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>{f.label}</button>
            ))}
            <div className="relative ml-auto">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="名前・目標・KPIで検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-52 pl-8 text-xs"
              />
            </div>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="border-t p-10 text-center"><p className="text-sm text-muted-foreground">該当するメンバーがいません</p></div>
        ) : (
          <div className="divide-y border-t">
          {filtered.map(m => {
            const isExp = expandedId === m.auth_id
            return (
              <div key={m.auth_id} className="bg-[hsl(0_0%_97%)]">
                  <button onClick={() => setExpandedId(isExp ? null : m.auth_id)} className="w-full p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors text-left">
                    <Avatar className="size-9 shrink-0">
                      {m.photo_url && <AvatarImage src={m.photo_url} alt={m.name} />}
                      <AvatarFallback className="text-xs">{m.name.slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground truncate">{m.name}</span>
                        {m.position && <span className="text-[11px] text-muted-foreground truncate">{m.position}</span>}
                      </div>
                      {m.goalText ? (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 m-0">{m.goalText}</p>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-red-50 text-red-600 mt-0.5">目標未設定</Badge>
                      )}
                    </div>
                    {m.kpiCount > 0 && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Progress value={m.overallProgress} className="w-20 h-2" />
                        <span className="text-xs font-semibold w-10 text-right">{m.overallProgress}%</span>
                      </div>
                    )}
                    {m.goalText && (isExp ? <ChevronUp size={16} className="text-muted-foreground shrink-0" /> : <ChevronDown size={16} className="text-muted-foreground shrink-0" />)}
                  </button>

                  {/* 展開: 目標 + KPI一覧 */}
                  {isExp && m.goalText && (
                    <div className="border-t px-4 pb-4 pt-3 space-y-3">
                      <div className="bg-background rounded-lg p-3 border">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">目標</Label>
                            <p className="text-sm font-semibold text-foreground mt-1 m-0">{m.goalText}</p>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-7 shrink-0 text-destructive hover:text-destructive">
                                <Trash2 size={14} />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>目標を削除しますか？</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {m.name}さんの目標と、紐づくKPI（{m.kpiCount}件）をすべて削除します。この操作は取り消せません。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteGoal(m.goalId!, m.name)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">削除する</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      {m.kpis.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">KPI ({m.kpis.length}件)</span>
                          {m.kpis.map(k => {
                            const overdue = isOverdue(k.deadline, k.status)
                            return (
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
                                  {k.deadline && (
                                    <span className={`text-[9px] flex items-center gap-0.5 shrink-0 ${overdue ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                                      {overdue && <AlertCircle size={9} />}{formatDate(k.deadline)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {m.kpis.length === 0 && <p className="text-xs text-muted-foreground">KPIが設定されていません</p>}
                    </div>
                  )}
              </div>
            )
          })}
          </div>
        )}
      </div>

      {/* ===== 過去の期間 ===== */}
      {archivedPeriods.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-4">
            <Archive size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-bold text-foreground">過去の期間</h2>
          </div>
          <div className="space-y-3">
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
                            {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                          </div>
                        ) : archiveMembers.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">この期間に目標を設定した社員はいません</p>
                        ) : (
                          <div className="space-y-2">
                            {archiveMembers.map(am => {
                              const amExp = archiveExpandedMember === am.auth_id
                              return (
                                <div key={am.auth_id} className="bg-background rounded-lg border">
                                  <button onClick={() => setArchiveExpandedMember(amExp ? null : am.auth_id)} className="w-full p-3 flex items-center gap-3 hover:bg-muted/20 transition-colors text-left">
                                    <Avatar className="size-7 shrink-0">
                                      {am.photo_url && <AvatarImage src={am.photo_url} alt={am.name} />}
                                      <AvatarFallback className="text-[10px]">{am.name.slice(0, 1)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                      <span className="text-xs font-semibold text-foreground truncate block">{am.name}</span>
                                      {am.goalText && <p className="text-[11px] text-muted-foreground line-clamp-1 m-0">{am.goalText}</p>}
                                    </div>
                                    {am.kpiCount > 0 && (
                                      <div className="flex items-center gap-2 shrink-0">
                                        <Progress value={am.overallProgress} className="w-16 h-1.5" />
                                        <span className="text-[10px] font-semibold w-8 text-right">{am.overallProgress}%</span>
                                      </div>
                                    )}
                                    {amExp ? <ChevronUp size={14} className="text-muted-foreground shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
                                  </button>
                                  {amExp && (
                                    <div className="border-t px-3 pb-3 pt-2 space-y-2">
                                      {am.kpis.map(k => (
                                        <div key={k.id} className="bg-muted/30 rounded p-2">
                                          <div className="flex items-center justify-between gap-2 mb-1">
                                            <span className="text-[11px] font-semibold text-foreground flex-1">{k.title}</span>
                                            <Badge variant="secondary" className={`text-[9px] px-1 py-0 ${STATUS_COLORS[k.status]}`}>{STATUS_LABELS[k.status]}</Badge>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Progress value={k.progress} className="flex-1 h-1" />
                                            <span className="text-[9px] font-semibold w-7 text-right">{k.progress}%</span>
                                          </div>
                                        </div>
                                      ))}
                                      {am.kpis.length === 0 && <p className="text-[11px] text-muted-foreground">KPIなし</p>}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
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
      )}
    </div>
  )
}
