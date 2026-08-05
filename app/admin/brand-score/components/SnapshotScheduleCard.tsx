'use client'

// 記録設定カード: スコアの記録を「自動」で回すか「任意」で都度取るかを選ぶ。
// 自動を選んだときだけ、頻度と起点日をモーダルで設定する。
// 内部的には brand_score_schedules.enabled が 自動=true / 任意=false に対応する。
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Calendar, Loader2, Settings2 } from 'lucide-react'
import {
  type Frequency,
  calcNextSnapshotDate,
} from '@/lib/brand-score/schedule-utils'

interface SnapshotScheduleCardProps {
  companyId: string
}

const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'monthly', label: '毎月' },
  { value: 'quarterly', label: '四半期ごと（3ヶ月）' },
  { value: 'semi_annual', label: '半年ごと' },
  { value: 'annual', label: '年1回' },
]

const FREQUENCY_LABELS: Record<Frequency, string> = {
  monthly: '毎月',
  quarterly: '四半期ごと',
  semi_annual: '半年ごと',
  annual: '年1回',
}

export function SnapshotScheduleCard({ companyId }: SnapshotScheduleCardProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  // 保存済みの状態
  const [enabled, setEnabled] = useState(true)
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const [anchorDate, setAnchorDate] = useState('')
  const [lastSnapshotDate, setLastSnapshotDate] = useState<string | null>(null)

  // モーダル内の編集中の値。キャンセルで捨てられるよう保存済みとは別に持つ
  const [draftFrequency, setDraftFrequency] = useState<Frequency>('monthly')
  const [draftAnchorDate, setDraftAnchorDate] = useState('')

  // データ取得
  const fetchSchedule = useCallback(async () => {
    try {
      const res = await fetch(`/api/brand-score/schedule?company_id=${companyId}`)
      if (!res.ok) return

      const data = await res.json()
      setEnabled(data.enabled ?? true)
      setFrequency((data.frequency as Frequency) || 'monthly')
      setAnchorDate(data.anchor_date || new Date().toISOString().split('T')[0])
    } catch (err) {
      console.error('[SnapshotSchedule] 取得エラー:', err)
    } finally {
      setIsLoading(false)
    }
  }, [companyId])

  // 前回記録日を取得
  const fetchLastSnapshot = useCallback(async () => {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      const { data } = await supabase
        .from('brand_score_snapshots')
        .select('snapshot_date')
        .eq('company_id', companyId)
        .order('snapshot_date', { ascending: false })
        .limit(1)

      if (data && data.length > 0) {
        setLastSnapshotDate(data[0].snapshot_date)
      }
    } catch {
      // 無視
    }
  }, [companyId])

  useEffect(() => {
    fetchSchedule()
    fetchLastSnapshot()
  }, [fetchSchedule, fetchLastSnapshot])

  // 次回記録予定日。カードでは保存済みの値、モーダルでは編集中の値で計算する
  const nextDateOf = (anchor: string, freq: Frequency) => {
    if (!anchor || !/^\d{4}-\d{2}-\d{2}$/.test(anchor)) return null
    try {
      return calcNextSnapshotDate(anchor, freq)
    } catch {
      return null
    }
  }

  const nextSnapshotDate = useMemo(
    () => nextDateOf(anchorDate, frequency),
    [anchorDate, frequency]
  )
  const draftNextDate = useMemo(
    () => nextDateOf(draftAnchorDate, draftFrequency),
    [draftAnchorDate, draftFrequency]
  )

  const save = async (next: { enabled: boolean; frequency: Frequency; anchorDate: string }) => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/brand-score/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          frequency: next.frequency,
          anchor_date: next.anchorDate,
          enabled: next.enabled,
        }),
      })
      if (!res.ok) throw new Error()

      setEnabled(next.enabled)
      setFrequency(next.frequency)
      setAnchorDate(next.anchorDate)
      return true
    } catch {
      toast.error('保存に失敗しました')
      return false
    } finally {
      setIsSaving(false)
    }
  }

  // 「自動」を選ぶ → 設定モーダルを開く（保存はモーダル側で行う）
  const handleSelectAuto = () => {
    setDraftFrequency(frequency)
    setDraftAnchorDate(anchorDate || new Date().toISOString().split('T')[0])
    setDialogOpen(true)
  }

  // 「任意」を選ぶ → その場で自動記録を止める
  const handleSelectManual = async () => {
    if (!enabled) return
    if (await save({ enabled: false, frequency, anchorDate })) {
      toast.success('任意（手動で記録）に切り替えました')
    }
  }

  const handleDialogSave = async () => {
    if (!draftAnchorDate) {
      toast.error('起点日を入力してください')
      return
    }
    if (await save({ enabled: true, frequency: draftFrequency, anchorDate: draftAnchorDate })) {
      toast.success('自動記録の設定を保存しました')
      setDialogOpen(false)
    }
  }

  if (isLoading) {
    return (
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" />
            読み込み中...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Calendar size={14} />
              記録設定
            </h2>

            {/* 自動 / 任意 の切り替え。設問別スコアの軸切替と同じ体裁 */}
            <div className="flex rounded-md border bg-background p-0.5 text-xs">
              <button
                type="button"
                onClick={handleSelectAuto}
                disabled={isSaving}
                className={`px-2.5 py-1 rounded transition-colors ${
                  enabled
                    ? 'bg-foreground text-background font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                自動
              </button>
              <button
                type="button"
                onClick={handleSelectManual}
                disabled={isSaving}
                className={`px-2.5 py-1 rounded transition-colors ${
                  !enabled
                    ? 'bg-foreground text-background font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                任意
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            {enabled ? (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">頻度</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {FREQUENCY_LABELS[frequency]}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-[11px]"
                      onClick={handleSelectAuto}
                    >
                      <Settings2 size={12} />
                      変更
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">次回記録予定日</span>
                  <span className="font-medium text-foreground">
                    {nextSnapshotDate ?? '—'}
                  </span>
                </div>
              </>
            ) : (
              <p className="m-0 text-xs text-muted-foreground">
                自動では記録しません。上の「スコアを記録」で必要なときだけ残します。
              </p>
            )}

            <div className="flex items-center justify-between text-xs pt-1.5 border-t">
              <span className="text-muted-foreground">前回記録日</span>
              <span className="font-medium text-foreground">{lastSnapshotDate || '—'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 自動記録の設定 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>自動記録の設定</DialogTitle>
            <DialogDescription>
              起点日から指定した間隔でスコアを記録します。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">頻度</Label>
              <Select
                value={draftFrequency}
                onValueChange={v => setDraftFrequency(v as Frequency)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">起点日</Label>
              <Input
                type="date"
                value={draftAnchorDate}
                onChange={e => setDraftAnchorDate(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t">
              <span className="text-muted-foreground">次回記録予定日</span>
              <span className="font-medium text-foreground">{draftNextDate ?? '—'}</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
              キャンセル
            </Button>
            <Button size="sm" onClick={handleDialogSave} disabled={isSaving}>
              {isSaving && <Loader2 size={14} className="animate-spin" />}
              保存する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
