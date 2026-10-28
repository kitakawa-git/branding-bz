'use client'

// 目標・KPI管理ページ（ポータル）— タブ「会社 / チーム / わたし」
// わたし: 1人1目標 + 複数KPI + リソース配分(%) + 期間切り替え。目標はチーム目標・行動指針につなげられる（任意）
import { useEffect, useState, useMemo, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { usePortalAuth } from '../components/PortalDataProvider'
import { isFeatureEnabled } from '@/lib/constants/feature-toggles'
import { isPortalPageVisibleForRole } from '@/lib/constants/member-roles'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { fetchPhilosophy } from '@/lib/brand/philosophy'
import { Plus } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { GOAL_COLUMNS, pickCurrentPeriod, currentPeriodIds, type Goal, type Team, type TeamMember } from '@/lib/goals/types'
import { Fab, FabButton } from '@/components/ui/fab'
import { toast } from 'sonner'
import { PlanUpsell } from '@/components/billing/plan-gate'
import { can } from '@/lib/billing/entitlements'
import {
  emptyKpiEditForm,
  calcWeightedProgress,
  type GoalKpi,
  type PersonalGoal,
  type GoalPeriod,
  type GoalPeriodRecord,
  type BrandValue,
  type KpiFormItem,
  type KpiEditForm,
  type PortalKpiCache,
  type PortalGoalContext,
  emptyGoalContext,
  periodLabel,
} from './_components/kpi-utils'
import { useArchivedPeriod } from './_components/useArchivedPeriod'
import { ArchivedPeriodsSection } from './_components/ArchivedPeriodsSection'
import { GoalSetupDialog } from './_components/GoalSetupDialog'
import { KpiSetupDialog } from './_components/KpiSetupDialog'
import { GoalEditDialog } from './_components/GoalEditDialog'
import { KpiEditDialog } from './_components/KpiEditDialog'
import { KpiListCard } from './_components/KpiListCard'
import { KpiUnavailableNotice, KpiPageSkeleton, GoalPeriodNoticeCard, GoalEmptyCard } from './_components/KpiPagePlaceholders'
import { pickConceptVisual } from '@/components/brand/ConceptVisualBackdrop'
import { PersonalGoalLinkFields, NO_LINK } from './_components/PersonalGoalLinkFields'
import { GoalTreeCard } from './_components/GoalTreeCard'
import { CompanyGoalsTab } from './_components/CompanyGoalsTab'
import { TeamGoalsTab } from './_components/TeamGoalsTab'

// ============================================
// Component
// ============================================

export default function KpiPage() {
  const { companyId, user, company, roleCategory, isAdmin } = usePortalAuth()

  // 機能トグル: KPIが無効なら案内のみ表示（リダイレクトはしない）
  const kpiEnabled = isFeatureEnabled(company, 'kpi_enabled')
  // 区分ごとの表示設定で出し分け（URL直打ち対策）
  const kpiVisibleForRole = isPortalPageVisibleForRole(company, 'kpi', roleCategory, isAdmin)
  const searchParams = useSearchParams()
  const router = useRouter()
  const setupTriggered = useRef(false)
  const cacheKey = `portal-kpi-${companyId}-${user?.id}`
  const cached = companyId && user?.id ? getPageCache<PortalKpiCache>(cacheKey, { persist: true }) : null

  const [goal, setGoal] = useState<PersonalGoal | null>(cached?.goal ?? null)
  const [kpis, setKpis] = useState<GoalKpi[]>(cached?.kpis ?? [])
  const [goalPeriod, setGoalPeriod] = useState<GoalPeriod | null>(cached?.goalPeriod ?? null)
  const [currentPeriodId, setCurrentPeriodId] = useState<string | null>(cached?.currentPeriodId ?? null)
  const [archivedPeriods, setArchivedPeriods] = useState<GoalPeriodRecord[]>(cached?.archivedPeriods ?? [])
  const [goalContext, setGoalContext] = useState<PortalGoalContext>(cached?.goalContext ?? emptyGoalContext)
  const [tab, setTab] = useState<'company' | 'team' | 'me'>('me')
  const [loading, setLoading] = useState(!cached)
  const [saving, setSaving] = useState(false)

  // Setup dialog (2-step: 1=goal, 2=kpi)
  const [setupStep, setSetupStep] = useState<0 | 1 | 2>(0)
  const [setupGoalText, setSetupGoalText] = useState('')
  const [setupParentId, setSetupParentId] = useState(NO_LINK)
  const [setupGuidelineId, setSetupGuidelineId] = useState(NO_LINK)
  const [setupKpis, setSetupKpis] = useState<KpiFormItem[]>([{ id: crypto.randomUUID(), title: '', deadline: undefined, weight: 100 }])
  const [missionText, setMissionText] = useState<string | null>(null)
  const [valuesData, setValuesData] = useState<BrandValue[]>([])
  const [conceptVisualUrl, setConceptVisualUrl] = useState<string | null>(null)
  const [brandDataLoaded, setBrandDataLoaded] = useState(false)

  // KPI edit dialog (for editing individual KPIs after initial setup)
  const [kpiEditOpen, setKpiEditOpen] = useState(false)
  const [editingKpiId, setEditingKpiId] = useState<string | null>(null)
  const [kpiEditForm, setKpiEditForm] = useState<KpiEditForm>(emptyKpiEditForm)

  // Goal edit dialog
  const [goalEditOpen, setGoalEditOpen] = useState(false)
  const [goalEditText, setGoalEditText] = useState('')
  const [goalEditParentId, setGoalEditParentId] = useState(NO_LINK)
  const [goalEditGuidelineId, setGoalEditGuidelineId] = useState(NO_LINK)


  // 過去の期間アコーディオン
  const { expandedArchiveId, archiveData, archiveLoading, toggleArchive } = useArchivedPeriod(companyId, user?.id)


  // ============================================
  // Data Fetching
  // ============================================
  // useCallback にしない（React Compiler がメモ化する。手動のメモ化と推論が食い違うと最適化が止まる）
  const fetchData = async () => {
    if (!companyId || !user?.id) return
    try {
      // 期間・自分の目標（全期間分。下で今の期間に絞る）・KPI・会社とチームの目標・チーム・行動指針を1回の往復で取る
      const [periodsRes, companyRes, myGoalsRes, kpisRes, sharedGoalsRes, teamsRes, teamMembersRes, membersRes, guidelinesRes, countsRes] = await Promise.all([
        supabase.from('goal_periods').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
        supabase.from('companies').select('goal_period').eq('id', companyId).single(),
        supabase.from('goals').select(GOAL_COLUMNS).eq('company_id', companyId).eq('level', 'personal').eq('owner_user_id', user.id),
        // 見えている KPI をまとめて取る（自分の分＋会社・チーム目標の分。リーダーはメンバーの分も見える＝RLS）
        supabase
          .from('goal_kpis')
          .select('*')
          .eq('company_id', companyId)
          .order('created_at', { ascending: true }),
        supabase.from('goals').select(GOAL_COLUMNS).eq('company_id', companyId).in('level', ['company', 'team']).order('created_at', { ascending: true }),
        supabase.from('teams').select('id, company_id, name, created_at').eq('company_id', companyId).order('created_at', { ascending: true }),
        supabase.from('team_members').select('team_id, user_id, role'),
        supabase.from('members').select('auth_id, display_name, profile:profiles(name)').eq('company_id', companyId).eq('is_active', true),
        supabase.from('philosophy_elements').select('id, title, body').eq('company_id', companyId).eq('element_type', 'action_guideline').order('sort_order', { ascending: true }),
        // 寄与件数は RPC で実件数を取る（個人KPIは見える人が限られるため、画面で数えると閲覧者で変わる）
        supabase.rpc('goal_kpi_contribution_counts', { target_company_id: companyId }),
      ])

      const allPeriods = (periodsRes.data || []) as GoalPeriodRecord[]
      const current = pickCurrentPeriod(allPeriods, 'personal')
      const archived = allPeriods.filter(p => p.status === 'archived').sort((a, b) => b.start_date.localeCompare(a.start_date))
      const periodData = (companyRes.data?.goal_period as GoalPeriod) || null

      const curPeriodId = current?.id || null
      setCurrentPeriodId(curPeriodId)
      setArchivedPeriods(archived)

      // 今の期間の自分の目標（期間が無い会社は期間なしの移行前データ）
      const goalData = ((myGoalsRes.data || []) as PersonalGoal[]).find(g => (g.period_id ?? null) === curPeriodId) ?? null
      // KPIは目標に紐づくものだけフィルタ
      const kpisData = goalData
        ? ((kpisRes.data || []) as GoalKpi[]).filter(k => k.goal_id === goalData.id)
        : []

      // 会社・チーム目標は今の期間のもの（年度と半期の両方が今の期間になりうる）
      const nowIds = currentPeriodIds(allPeriods)
      const sharedGoals = ((sharedGoalsRes.data || []) as Goal[])
        .filter(g => (nowIds.length > 0 ? nowIds.includes(g.period_id ?? '') : g.period_id === null))
      const teams = (teamsRes.data || []) as Team[]
      const teamIds = new Set(teams.map(t => t.id))
      const memberNames: Record<string, string> = {}
      ;(membersRes.data || []).forEach((m: { auth_id: string; display_name: string; profile: { name: string } | { name: string }[] | null }) => {
        const p = Array.isArray(m.profile) ? m.profile[0] : m.profile
        memberNames[m.auth_id] = p?.name || m.display_name || '不明'
      })
      const allKpis = (kpisRes.data || []) as GoalKpi[]
      const sharedGoalIds = new Set(sharedGoals.map(g => g.id))
      const contributionCounts: Record<string, number> = Object.fromEntries(
        ((countsRes.data || []) as { kpi_id: string; contribution_count: number }[]).map(r => [r.kpi_id, r.contribution_count]),
      )
      const ctx: PortalGoalContext = {
        companyGoals: sharedGoals.filter(g => g.level === 'company'),
        teamGoals: sharedGoals.filter(g => g.level === 'team'),
        teams,
        teamMembers: ((teamMembersRes.data || []) as TeamMember[]).filter(m => teamIds.has(m.team_id)),
        memberNames,
        guidelines: ((guidelinesRes.data || []) as { id: string; title: string | null; body: string | null }[])
          .map(g => ({ id: g.id, title: g.title || g.body || '' }))
          .filter(g => g.title),
        periodLabels: Object.fromEntries(allPeriods.map(p => [p.id, periodLabel(p)])),
        sharedKpis: allKpis.filter(k => sharedGoalIds.has(k.goal_id)),
        contributionCounts,
      }

      setGoal(goalData)
      setKpis(kpisData)
      setGoalPeriod(periodData)
      setGoalContext(ctx)
      setPageCache(cacheKey, { goal: goalData, kpis: kpisData, goalPeriod: periodData, currentPeriodId: curPeriodId, archivedPeriods: archived, goalContext: ctx }, { persist: true })
    } catch (err) {
      console.error('[KPI] データ取得エラー:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!companyId || !user?.id) return
    // 再読込前の保存分（表示用）ではなく、この読み込み以降に取得済みのときだけ取り直さない（lib/page-cache.ts）
    if (getPageCache<PortalKpiCache>(cacheKey)) return
    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, user?.id])

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
    setSetupParentId(isEdit && goal?.parent_goal_id ? goal.parent_goal_id : NO_LINK)
    setSetupGuidelineId(isEdit && goal?.behavior_guideline_id ? goal.behavior_guideline_id : NO_LINK)
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
      // mission/values は philosophy_elements 由来（brand_guidelines から正規化済み）。
      // 背景のコンセプトビジュアルも並列で取る（ダッシュボードのミッションカードと同じ背景にする）
      const [phil, cvRes] = await Promise.all([
        fetchPhilosophy(supabase, companyId),
        supabase.from('brand_guidelines').select('concept_visuals, concept_visual_url').eq('company_id', companyId).maybeSingle(),
      ])
      setMissionText(phil.mission)
      setValuesData(phil.values as BrandValue[])
      setConceptVisualUrl(pickConceptVisual(cvRes.data))
      setBrandDataLoaded(true)
    }
  }

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
      // つながり先（任意）。「つなげない」は null
      const setupLinks = {
        parent_goal_id: setupParentId === NO_LINK ? null : setupParentId,
        behavior_guideline_id: setupGuidelineId === NO_LINK ? null : setupGuidelineId,
      }

      if (goalId) {
        const { error } = await supabase
          .from('goals')
          .update({ ...setupLinks, title: setupGoalText.trim(), updated_at: new Date().toISOString() })
          .eq('id', goalId)
        if (error) throw error
        // 目標の作り直し。ここは 0 件でも正常（KPI をまだ作っていない場合）なので、
        // RLS 0行対策の判定は入れずに error だけ見る
        const { error: kpiDelErr } = await supabase
          .from('goal_kpis').delete().eq('goal_id', goalId)
        if (kpiDelErr) throw kpiDelErr
      } else {
        goalId = crypto.randomUUID()
        const { error } = await supabase
          .from('goals')
          .insert({
            ...setupLinks,
            id: goalId,
            company_id: companyId,
            level: 'personal',
            owner_user_id: user.id,
            created_by: user.id,
            period_id: currentPeriodId, // 期間紐付け
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
    setGoalEditParentId(goal.parent_goal_id ?? NO_LINK)
    setGoalEditGuidelineId(goal.behavior_guideline_id ?? NO_LINK)
    setGoalEditOpen(true)
  }
  const handleGoalEditSave = async () => {
    if (!goal || !goalEditText.trim()) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('goals')
        .update({
          title: goalEditText.trim(),
          parent_goal_id: goalEditParentId === NO_LINK ? null : goalEditParentId,
          behavior_guideline_id: goalEditGuidelineId === NO_LINK ? null : goalEditGuidelineId,
          updated_at: new Date().toISOString(),
        })
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
      contributesTo: kpi.contributes_to_kpi_id ?? NO_LINK,
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
        contributes_to_kpi_id: kpiEditForm.contributesTo === NO_LINK ? null : kpiEditForm.contributesTo,
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
      // RLS 0行対策: 弾かれても error は null なので影響行で判定する
      const { data, error } = await supabase
        .from('goal_kpis').delete().eq('id', kpiId).select('id')
      if (error) throw error
      if (!data?.length) {
        toast.error('削除する権限がありません')
        return
      }
      toast.success('KPIを削除しました')
      await fetchData()
    } catch { toast.error('削除に失敗しました') }
  }

  // ============================================
  // 機能トグルがオフ: 内容は表示せず、案内のみ（URL直打ち時に状況が分かるように）
  // ============================================
  if (!kpiEnabled) {
    return <KpiUnavailableNotice message="この機能は現在ご利用いただけません" />
  }

  // 区分ごとの表示設定で非表示（URL直打ち時の防御）
  // プラン外: 隠さずアップセル面を出す（実効プランで判定）
  if (!can(company, 'kpi')) {
    return (
      <div className="max-w-4xl mx-auto px-5 pt-4 pb-10">
        <PlanUpsell
          readOnly={!isAdmin}
          company={company}
          feature="kpi"
          title="目標・KPI管理を使うには"
          benefits={[
            '全社の目標に紐づけて個人KPIを設定',
            '進捗を自分で更新',
            '期間ごとに区切って振り返る',
            '管理画面から全社の進捗を把握',
          ]}
        />
      </div>
    )
  }

  if (!kpiVisibleForRole) {
    return <KpiUnavailableNotice message="このページはご利用の区分では表示されません" />
  }

  // ============================================
  // Loading skeleton
  // ============================================
  if (loading) {
    return <KpiPageSkeleton />
  }

  // 過去の期間・目標設定ダイアログ（目標未設定／設定済みの両方で同じ位置に描画する）
  const archivedSection = (
    <ArchivedPeriodsSection
      archivedPeriods={archivedPeriods}
      expandedArchiveId={expandedArchiveId}
      archiveData={archiveData}
      archiveLoading={archiveLoading}
      toggleArchive={toggleArchive}
    />
  )
  const myTeamIds = new Set(goalContext.teamMembers.filter(m => m.user_id === user?.id).map(m => m.team_id))
  // つながり先の入力欄（設定・編集ダイアログで共用）
  const linkFields = (parentId: string, setParentId: (v: string) => void, guidelineId: string, setGuidelineId: (v: string) => void) => (
    <PersonalGoalLinkFields
      teamGoals={goalContext.teamGoals}
      teams={goalContext.teams}
      myTeamIds={myTeamIds}
      guidelines={goalContext.guidelines}
      parentGoalId={parentId}
      setParentGoalId={setParentId}
      guidelineId={guidelineId}
      setGuidelineId={setGuidelineId}
    />
  )
  const goalSetupDialog = (
    <GoalSetupDialog
      setupStep={setupStep}
      setSetupStep={setSetupStep}
      goalPeriod={goalPeriod}
      missionText={missionText}
      valuesData={valuesData}
      conceptVisualUrl={conceptVisualUrl}
      setupGoalText={setupGoalText}
      setSetupGoalText={setSetupGoalText}
      handleGoalStepNext={handleGoalStepNext}
      linkFields={linkFields(setupParentId, setSetupParentId, setupGuidelineId, setSetupGuidelineId)}
    />
  )
  const kpiSetupDialog = (
    <KpiSetupDialog
      setupStep={setupStep}
      setSetupStep={setSetupStep}
      setupGoalText={setupGoalText}
      setupKpis={setupKpis}
      setupWeightTotal={setupWeightTotal}
      addSetupKpi={addSetupKpi}
      removeSetupKpi={removeSetupKpi}
      updateSetupKpi={updateSetupKpi}
      saving={saving}
      handleSetupSave={handleSetupSave}
    />
  )

  // 個人 KPI の寄与先: つながっているチーム目標の KPI
  const contributeOptions = goal?.parent_goal_id
    ? goalContext.sharedKpis.filter(k => k.goal_id === goal.parent_goal_id).map(k => ({ id: k.id, title: k.title }))
    : []
  const contributeTitles = Object.fromEntries(goalContext.sharedKpis.map(k => [k.id, k.title]))

  // ツリーの会社・チーム目標から、そのタブの該当目標へ移る（タブを切り替えてから、描画後にスクロール）
  const jumpToGoal = (target: 'company' | 'team', goalId: string) => {
    setTab(target)
    window.setTimeout(() => {
      const el = document.getElementById(`goal-${goalId}`)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('ring-2', 'ring-ds-app-accent', 'rounded-lg')
      window.setTimeout(() => el.classList.remove('ring-2', 'ring-ds-app-accent', 'rounded-lg'), 1600)
    }, 60)
  }

  const canEdit = goalPeriod?.show_goal_banner !== false
  const canReview = goalPeriod?.show_review_banner === true

  // ============================================
  // わたしタブ: 目標未設定 / 設定済み
  // ============================================
  const myContent = !goal ? (
    <>
      {goalPeriod && <GoalPeriodNoticeCard goalPeriod={goalPeriod} />}

      <GoalEmptyCard goalPeriod={goalPeriod} />

      {/* 過去の期間 */}
      {archivedSection}
    </>
  ) : (
    <>
      {/* 会社目標 → チーム目標 → わたしの目標（ツリー。目標名はここで1回だけ） */}
      <GoalTreeCard
        goal={goal}
        goalPeriod={goalPeriod}
        teamGoals={goalContext.teamGoals}
        companyGoals={goalContext.companyGoals}
        teams={goalContext.teams}
        guidelines={goalContext.guidelines}
        periodLabels={goalContext.periodLabels ?? {}}
        canEdit={canEdit}
        openGoalEdit={openGoalEdit}
        onJump={jumpToGoal}
      />

      {/* KPI総合サマリー + KPI一覧（入れ子） */}
      <KpiListCard
        kpis={kpis}
        weightedProgress={weightedProgress}
        statusCounts={statusCounts}
        totalWeight={totalWeight}
        canEdit={canEdit}
        canReview={canReview}
        openKpiAdd={openKpiAdd}
        openKpiEdit={openKpiEdit}
        handleKpiDelete={handleKpiDelete}
        contributeTitles={contributeTitles}
      />

      {/* 過去の期間 */}
      {archivedSection}
    </>
  )

  return (
    <div className="max-w-4xl mx-auto px-5 pt-4 pb-10">
      <Tabs value={tab} onValueChange={v => setTab(v as 'company' | 'team' | 'me')}>
        <TabsList className="mb-4">
          <TabsTrigger value="company">会社</TabsTrigger>
          <TabsTrigger value="team">チーム</TabsTrigger>
          <TabsTrigger value="me">わたし</TabsTrigger>
        </TabsList>
        <TabsContent value="company" className="mt-0">
          <CompanyGoalsTab
            companyGoals={goalContext.companyGoals}
            teamGoals={goalContext.teamGoals}
            sharedKpis={goalContext.sharedKpis}
            contributionCounts={goalContext.contributionCounts}
            userId={user?.id ?? ''}
            isAdmin={isAdmin}
          />
        </TabsContent>
        <TabsContent value="team" className="mt-0">
          <TeamGoalsTab
            teams={goalContext.teams}
            teamMembers={goalContext.teamMembers}
            memberNames={goalContext.memberNames}
            teamGoals={goalContext.teamGoals}
            companyGoals={goalContext.companyGoals}
            sharedKpis={goalContext.sharedKpis}
            contributionCounts={goalContext.contributionCounts}
            userId={user?.id ?? ''}
            isAdmin={isAdmin}
            onChanged={fetchData}
          />
        </TabsContent>
        <TabsContent value="me" className="mt-0 space-y-6">
          {myContent}
        </TabsContent>
      </Tabs>

      {/* Setup Dialogs (2-step) */}
      {goalSetupDialog}
      {kpiSetupDialog}

      {/* Goal Edit Dialog */}
      <GoalEditDialog
        goalEditOpen={goalEditOpen}
        setGoalEditOpen={setGoalEditOpen}
        goalEditText={goalEditText}
        setGoalEditText={setGoalEditText}
        saving={saving}
        handleGoalEditSave={handleGoalEditSave}
        linkFields={linkFields(goalEditParentId, setGoalEditParentId, goalEditGuidelineId, setGoalEditGuidelineId)}
      />

      {/* KPI Edit Dialog */}
      <KpiEditDialog
        kpiEditOpen={kpiEditOpen}
        setKpiEditOpen={setKpiEditOpen}
        canEdit={canEdit}
        canReview={canReview}
        editingKpiId={editingKpiId}
        kpiEditForm={kpiEditForm}
        updateKpiEditForm={updateKpiEditForm}
        kpiEditWeightTotal={kpiEditWeightTotal}
        kpiEditWeightOver={kpiEditWeightOver}
        saving={saving}
        handleKpiEditSave={handleKpiEditSave}
        contributeOptions={contributeOptions}
      />

      {/* 右下FAB: 目標とKPIを設定する（わたしタブ・目標未設定・設定期間内のみ表示） */}
      {tab === 'me' && !goal && canEdit && (
        <Fab>
          <FabButton onClick={() => openSetupDialog(false)} icon={<Plus size={18} />}>
            目標とKPIを設定する
          </FabButton>
        </Fab>
      )}
    </div>
  )
}
