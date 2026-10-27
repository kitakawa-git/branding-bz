'use client'

// 目標・KPI管理ページ（ポータル）— 1人1目標 + 複数KPI + リソース配分(%) + 期間切り替え
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { usePortalAuth } from '../components/PortalDataProvider'
import { isFeatureEnabled } from '@/lib/constants/feature-toggles'
import { isPortalPageVisibleForRole } from '@/lib/constants/member-roles'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { fetchPhilosophy } from '@/lib/brand/philosophy'
import { Plus } from 'lucide-react'
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
} from './_components/kpi-utils'
import { useArchivedPeriod } from './_components/useArchivedPeriod'
import { ArchivedPeriodsSection } from './_components/ArchivedPeriodsSection'
import { GoalSetupDialog } from './_components/GoalSetupDialog'
import { KpiSetupDialog } from './_components/KpiSetupDialog'
import { GoalEditDialog } from './_components/GoalEditDialog'
import { KpiEditDialog } from './_components/KpiEditDialog'
import { GoalCard } from './_components/GoalCard'
import { KpiListCard } from './_components/KpiListCard'
import { KpiUnavailableNotice, KpiPageSkeleton, GoalPeriodNoticeCard, GoalEmptyCard } from './_components/KpiPagePlaceholders'

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
  const { expandedArchiveId, archiveData, archiveLoading, toggleArchive } = useArchivedPeriod(companyId, user?.id)


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
      setPageCache(cacheKey, { goal: goalData, kpis: kpisData, goalPeriod: periodData, currentPeriodId: curPeriodId, archivedPeriods: archived }, { persist: true })
    } catch (err) {
      console.error('[KPI] データ取得エラー:', err)
    } finally {
      setLoading(false)
    }
  }, [companyId, user?.id, cacheKey])

  useEffect(() => {
    if (!companyId || !user?.id) return
    // 再読込前の保存分（表示用）ではなく、この読み込み以降に取得済みのときだけ取り直さない（lib/page-cache.ts）
    if (getPageCache<PortalKpiCache>(cacheKey)) return
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
      // mission/values は philosophy_elements 由来（brand_guidelines から正規化済み）
      const phil = await fetchPhilosophy(supabase, companyId)
      setMissionText(phil.mission)
      setValuesData(phil.values as BrandValue[])
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
        // 目標の作り直し。ここは 0 件でも正常（KPI をまだ作っていない場合）なので、
        // RLS 0行対策の判定は入れずに error だけ見る
        const { error: kpiDelErr } = await supabase
          .from('goal_kpis').delete().eq('goal_id', goalId)
        if (kpiDelErr) throw kpiDelErr
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
  const goalSetupDialog = (
    <GoalSetupDialog
      setupStep={setupStep}
      setSetupStep={setSetupStep}
      goalPeriod={goalPeriod}
      missionText={missionText}
      valuesData={valuesData}
      setupGoalText={setupGoalText}
      setSetupGoalText={setSetupGoalText}
      handleGoalStepNext={handleGoalStepNext}
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

  // ============================================
  // Render: 目標未設定
  // ============================================
  if (!goal) {
    return (
      <div className="max-w-4xl mx-auto px-5 pt-4 pb-10 space-y-6">

        {goalPeriod && <GoalPeriodNoticeCard goalPeriod={goalPeriod} />}

        <GoalEmptyCard goalPeriod={goalPeriod} />

        {/* 過去の期間 */}
        {archivedSection}

        {goalSetupDialog}
        {kpiSetupDialog}

        {/* 右下FAB: 目標とKPIを設定する（設定期間内のみ表示） */}
        {(goalPeriod?.show_goal_banner !== false) && (
          <Fab>
            <FabButton onClick={() => openSetupDialog(false)} icon={<Plus size={18} />}>
              目標とKPIを設定する
            </FabButton>
          </Fab>
        )}
      </div>
    )
  }

  // ============================================
  // Render: 目標設定済み
  // ============================================
  const canEdit = goalPeriod?.show_goal_banner !== false
  const canReview = goalPeriod?.show_review_banner === true

  return (
    <div className="max-w-4xl mx-auto px-5 pt-4 pb-10 space-y-6">

      {/* ゴール期間 + 目標表示 */}
      <GoalCard goal={goal} goalPeriod={goalPeriod} canEdit={canEdit} openGoalEdit={openGoalEdit} />

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
      />

      {/* 過去の期間 */}
      {archivedSection}

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
      />
    </div>
  )
}
