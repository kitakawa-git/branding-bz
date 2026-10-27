// 目標設定ダイアログ Step 2（KPI入力 + リソース配分）
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { DatePicker } from '@/components/date-picker'
import { Plus, Trash2, X } from 'lucide-react'
import type { KpiFormItem } from './kpi-utils'

type Props = {
  setupStep: 0 | 1 | 2
  setSetupStep: (step: 0 | 1 | 2) => void
  setupGoalText: string
  setupKpis: KpiFormItem[]
  setupWeightTotal: number
  addSetupKpi: () => void
  removeSetupKpi: (id: string) => void
  updateSetupKpi: (id: string, field: keyof KpiFormItem, value: unknown) => void
  saving: boolean
  handleSetupSave: () => void
}

export function KpiSetupDialog({
  setupStep,
  setSetupStep,
  setupGoalText,
  setupKpis,
  setupWeightTotal,
  addSetupKpi,
  removeSetupKpi,
  updateSetupKpi,
  saving,
  handleSetupSave,
}: Props) {
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
            <p className="text-base sm:text-sm font-semibold text-foreground mt-1 m-0 leading-relaxed">{setupGoalText}</p>
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
                <div key={kpi.id} className="bg-muted/30 rounded-xl p-3 border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground">KPI {idx + 1}</span>
                    {setupKpis.length > 1 && (
                      <button onClick={() => removeSetupKpi(kpi.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <Input
                    value={kpi.title}
                    onChange={e => updateSetupKpi(kpi.id, 'title', e.target.value)}
                    placeholder="KPIタイトル"
                    className="h-9 text-sm"
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
