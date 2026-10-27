'use client'

// 会社目標・チーム目標の KPI（総合進捗＋一覧＋追加・編集・削除）。ポータルの会社／チームタブと管理画面で共用
// 書き込みは画面から直接（RLS の goal_kpis_* が親の目標の権限で判定する。会社=管理者、チーム=そのチームのリーダー＋管理者）
// 寄与先（contributes_to_kpi_id）は親目標の KPI だけ（DB のトリガでも確かめる）
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
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
import { Plus, Pencil, Trash2, AlertCircle, Users, CornerLeftUp } from 'lucide-react'
import { toast } from 'sonner'
import { KpiEditDialog } from '@/app/portal/kpi/_components/KpiEditDialog'
import {
  STATUS_LABELS,
  STATUS_COLORS,
  emptyKpiEditForm,
  calcWeightedProgress,
  isOverdue,
  formatDate,
  type GoalKpi,
  type KpiEditForm,
} from '@/app/portal/kpi/_components/kpi-utils'
import type { Goal } from '@/lib/goals/types'

const MAX_KPIS = 5

const LEVEL_TEXT = {
  company: { label: '会社KPI', contributors: 'チームKPI', placeholder: '例: 指名での問い合わせを年間120件にする' },
  team: { label: 'チームKPI', contributors: '個人KPI', placeholder: '例: 導入事例を6本公開' },
  personal: { label: 'KPI', contributors: 'KPI', placeholder: '例: 新規顧客を10社獲得' },
} as const

type Props = {
  goal: Goal
  kpis: GoalKpi[]
  editable: boolean
  userId: string
  /** KPI id → それに寄与している下位 KPI の数（goal_kpi_contribution_counts。閲覧者によらず実件数） */
  contributionCounts?: Record<string, number>
  /** 寄与先にできる親目標の KPI（チーム目標が会社目標につながっているときの会社KPI） */
  parentKpis?: GoalKpi[]
  onChanged: () => void
}

export function GoalKpiSection({ goal, kpis, editable, userId, contributionCounts = {}, parentKpis = [], onChanged }: Props) {
  const text = LEVEL_TEXT[goal.level]
  const parentTitles = Object.fromEntries(parentKpis.map(k => [k.id, k.title]))
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<KpiEditForm>(emptyKpiEditForm)
  const [saving, setSaving] = useState(false)

  const progress = calcWeightedProgress(kpis)
  const otherWeight = kpis.filter(k => k.id !== editingId).reduce((s, k) => s + (k.weight || 0), 0)
  const weightTotal = otherWeight + (form.weight || 0)
  const weightOver = weightTotal > 100

  const openAdd = () => {
    if (kpis.length >= MAX_KPIS) { toast.error(`KPIは最大${MAX_KPIS}つまでです`); return }
    setEditingId(null)
    setForm({ ...emptyKpiEditForm, weight: Math.max(0, 100 - kpis.reduce((s, k) => s + (k.weight || 0), 0)) })
    setOpen(true)
  }
  const openEdit = (kpi: GoalKpi) => {
    setEditingId(kpi.id)
    setForm({
      title: kpi.title,
      deadline: kpi.deadline ? new Date(kpi.deadline + 'T00:00:00') : undefined,
      progress: kpi.progress,
      weight: kpi.weight,
      status: kpi.status,
      contributesTo: kpi.contributes_to_kpi_id ?? 'none',
    })
    setOpen(true)
  }
  const updateForm = (field: keyof KpiEditForm, value: unknown) => {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'progress' && value === 100) next.status = 'completed'
      if (field === 'status' && value === 'completed') next.progress = 100
      return next
    })
  }

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('KPIタイトルを入力してください'); return }
    if (!form.weight || form.weight <= 0) { toast.error('配分は1%以上にしてください'); return }
    if (weightOver) { toast.error('配分の合計が100%を超えています'); return }
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        deadline: form.deadline ? form.deadline.toISOString().slice(0, 10) : null,
        progress: form.progress,
        weight: form.weight,
        status: form.status,
        contributes_to_kpi_id: form.contributesTo === 'none' ? null : form.contributesTo,
        updated_at: new Date().toISOString(),
      }
      if (editingId) {
        // RLS 0行対策: 弾かれても error は null なので影響行で判定する
        const { data, error } = await supabase.from('goal_kpis').update(payload).eq('id', editingId).select('id')
        if (error) throw error
        if (!data?.length) { toast.error('編集する権限がありません'); return }
      } else {
        const { error } = await supabase.from('goal_kpis').insert({
          ...payload,
          goal_id: goal.id,
          company_id: goal.company_id,
          user_id: userId, // 作成者
        })
        if (error) throw error
      }
      toast.success(editingId ? 'KPIを更新しました' : 'KPIを追加しました')
      setOpen(false)
      onChanged()
    } catch {
      toast.error('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (kpiId: string) => {
    try {
      const { data, error } = await supabase.from('goal_kpis').delete().eq('id', kpiId).select('id')
      if (error) throw error
      if (!data?.length) { toast.error('削除する権限がありません'); return }
      toast.success('KPIを削除しました')
      onChanged()
    } catch {
      toast.error('削除に失敗しました')
    }
  }

  // KPI が無く編集もできない人には何も出さない
  if (kpis.length === 0 && !editable) return null

  return (
    <div className="mt-2 ml-3 pl-3 border-l-2 border-muted">
      {kpis.length > 0 ? (
        <>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[11px] font-bold text-muted-foreground shrink-0">{text.label}</span>
            <Progress value={progress} className="flex-1 h-1.5" animate />
            <span className="text-xs font-bold text-foreground w-10 text-right shrink-0">{progress}%</span>
          </div>
          <div className="space-y-1.5">
            {kpis.map(kpi => {
              const overdue = isOverdue(kpi.deadline, kpi.status)
              const contributions = contributionCounts[kpi.id] ?? 0
              return (
                <div key={kpi.id} className="rounded-lg border bg-background px-3 py-2">
                  <div className="flex items-start gap-2">
                    <p className="text-sm font-semibold text-foreground m-0 flex-1 min-w-0 leading-relaxed">{kpi.title}</p>
                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                      <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[kpi.status]}`}>{STATUS_LABELS[kpi.status]}</Badge>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-purple-50 text-purple-700">配分 {kpi.weight}%</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <Progress value={kpi.progress} className="flex-1 h-1.5" />
                    <span className="text-xs font-semibold text-foreground w-10 text-right">{kpi.progress}%</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1 min-h-6">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
                      {kpi.deadline && (
                        <span className={`flex items-center gap-0.5 ${overdue ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                          {overdue && <AlertCircle size={12} />}
                          期限: {formatDate(kpi.deadline)}{overdue && '（期限超過）'}
                        </span>
                      )}
                      {contributions > 0 && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Users size={12} />寄与している{text.contributors} {contributions}件
                        </span>
                      )}
                      {kpi.contributes_to_kpi_id && parentTitles[kpi.contributes_to_kpi_id] && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <CornerLeftUp size={12} />会社KPI：{parentTitles[kpi.contributes_to_kpi_id]}
                        </span>
                      )}
                    </div>
                    {editable && (
                      <div className="flex shrink-0 -mr-2 -my-1">
                        <Button variant="ghost" size="icon" className="size-9" aria-label="KPIを編集" onClick={() => openEdit(kpi)}>
                          <Pencil size={14} />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-9 text-destructive hover:text-destructive" aria-label="KPIを削除">
                              <Trash2 size={14} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>KPIを削除しますか？</AlertDialogTitle>
                              <AlertDialogDescription>「{kpi.title}」を削除します。このKPIに寄与している{text.contributors}は、つながりが外れます（KPI自体は残ります）。この操作は取り消せません。</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>キャンセル</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(kpi.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">削除する</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground m-0">{text.label}はまだありません</p>
      )}
      {editable && kpis.length < MAX_KPIS && (
        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs mt-1 -ml-2" onClick={openAdd}>
          <Plus size={13} />{text.label}を追加
        </Button>
      )}

      <KpiEditDialog
        kpiEditOpen={open}
        setKpiEditOpen={setOpen}
        canEdit
        canReview={false}
        editingKpiId={editingId}
        kpiEditForm={form}
        updateKpiEditForm={updateForm}
        kpiEditWeightTotal={weightTotal}
        kpiEditWeightOver={weightOver}
        saving={saving}
        handleKpiEditSave={handleSave}
        titlePlaceholder={text.placeholder}
        contributeOptions={parentKpis.map(k => ({ id: k.id, title: k.title }))}
        contributeLabel="寄与する会社KPI"
      />
    </div>
  )
}
