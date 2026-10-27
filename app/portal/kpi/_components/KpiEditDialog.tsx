// KPIの追加・編集ダイアログ（振り返り期間は進捗率のみ更新）
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { DatePicker } from '@/components/date-picker'
import type { GoalOption, KpiEditForm } from './kpi-utils'

type Props = {
  kpiEditOpen: boolean
  setKpiEditOpen: (open: boolean) => void
  canEdit: boolean
  canReview: boolean
  editingKpiId: string | null
  kpiEditForm: KpiEditForm
  updateKpiEditForm: (field: keyof KpiEditForm, value: unknown) => void
  kpiEditWeightTotal: number
  kpiEditWeightOver: boolean
  saving: boolean
  handleKpiEditSave: () => void
  /** 寄与先にできる上位 KPI（個人 KPI → つながるチーム目標の KPI）。無ければ欄を出さない */
  contributeOptions?: GoalOption[]
  /** 入力例（チーム KPI では文言を変える） */
  titlePlaceholder?: string
}

export function KpiEditDialog({
  kpiEditOpen,
  setKpiEditOpen,
  canEdit,
  canReview,
  editingKpiId,
  kpiEditForm,
  updateKpiEditForm,
  kpiEditWeightTotal,
  kpiEditWeightOver,
  saving,
  handleKpiEditSave,
  contributeOptions = [],
  titlePlaceholder = '例: 新規顧客を10社獲得',
}: Props) {
  return (
    <Dialog open={kpiEditOpen} onOpenChange={setKpiEditOpen}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogTitle>{!canEdit && canReview ? '進捗率を更新' : editingKpiId ? 'KPIを編集' : 'KPIを追加'}</DialogTitle>
        <div className="space-y-4 mt-2">
          {canEdit && (
            <div>
              <Label className="text-xs font-bold mb-1.5 block">KPIタイトル *</Label>
              <Input value={kpiEditForm.title} onChange={e => updateKpiEditForm('title', e.target.value)} placeholder={titlePlaceholder} className="h-9" />
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
          {canEdit && contributeOptions.length > 0 && (
            <div>
              <Label className="text-xs font-bold mb-1.5 block">寄与するチームKPI（任意）</Label>
              <Select value={kpiEditForm.contributesTo} onValueChange={v => updateKpiEditForm('contributesTo', v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">つなげない</SelectItem>
                  {contributeOptions.map(o => <SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="flex justify-end mt-4">
          <Button onClick={handleKpiEditSave} disabled={saving || kpiEditWeightOver} className="min-w-[100px]">{saving ? '保存中...' : '保存する'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
