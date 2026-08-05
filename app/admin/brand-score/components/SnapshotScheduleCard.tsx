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
import { toast } from 'sonner'
import { Calendar, Loader2, Settings2, Trash2 } from 'lucide-react'
import {
  type Frequency,
  calcNextSnapshotDate,
} from '@/lib/brand-score/schedule-utils'

interface SnapshotScheduleCardProps {
  companyId: string
  /** 「スコアを記録」ボタン（記録ダイアログ）。カード内に表示する */
  recordSlot?: React.ReactNode
  /** 記録を消したときに、親の推移グラフを取り直してもらうための通知 */
  onSnapshotsChanged?: () => void
}

/** 記録済みの1件。日付と総合スコアだけ出す */
type RecordedSnapshot = { snapshot_date: string; total_score: number | null }

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

export function SnapshotScheduleCard({
  companyId,
  recordSlot,
  onSnapshotsChanged,
}: SnapshotScheduleCardProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  // 保存済みの状態
  const [enabled, setEnabled] = useState(true)
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const [anchorDate, setAnchorDate] = useState('')
  // 記録済みの日付。誤って記録した日を残すと推移グラフが読めなくなるので、
  // 一覧から消せるようにする
  const [records, setRecords] = useState<RecordedSnapshot[]>([])
  const [deleteTarget, setDeleteTarget] = useState<RecordedSnapshot | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  // 記録済みの日付を取得。
  // 以前は anon キーで直接テーブルを読んでいたが、RLS で弾かれても
  // catch で握り潰していたため「前回記録日 —」のまま気づけなかった。
  // 推移グラフと同じ API（service_role）を使う
  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch(`/api/brand-score/snapshots?company_id=${companyId}`)
      if (!res.ok) return
      const data = await res.json()
      const list = (data.snapshots ?? []) as RecordedSnapshot[]
      // 新しい順に見せる（消したいのはたいてい直近の誤記録）
      setRecords([...list].sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date)))
    } catch (err) {
      console.error('[SnapshotSchedule] 記録一覧の取得エラー:', err)
    }
  }, [companyId])

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/brand-score/snapshots?company_id=${companyId}&snapshot_date=${deleteTarget.snapshot_date}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        throw new Error(d?.error || `HTTP ${res.status}`)
      }
      toast.success('記録を削除しました')
      setDeleteTarget(null)
      await fetchRecords()
      onSnapshotsChanged?.()
    } catch (err) {
      console.error('[SnapshotSchedule] 削除エラー:', err)
      toast.error(err instanceof Error ? err.message : '削除に失敗しました')
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    fetchSchedule()
    fetchRecords()
  }, [fetchSchedule, fetchRecords])

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
                自動では記録しません。下の「スコアを記録」で必要なときだけ残します。
              </p>
            )}

            {/* 記録済みの日付。行から直接消せる */}
            <div className="pt-1.5 border-t">
              <p className="m-0 mb-1.5 text-xs text-muted-foreground">記録した日</p>
              {records.length === 0 ? (
                <p className="m-0 text-xs text-muted-foreground">まだ記録がありません</p>
              ) : (
                <div className="space-y-0.5">
                  {records.map(r => (
                    <div
                      key={r.snapshot_date}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="font-medium text-foreground tabular-nums">
                        {r.snapshot_date}
                      </span>
                      <span className="ml-auto tabular-nums text-muted-foreground">
                        {r.total_score !== null ? r.total_score.toFixed(1) : '—'}
                      </span>
                      <button
                        type="button"
                        aria-label={`${r.snapshot_date} の記録を削除`}
                        onClick={() => setDeleteTarget(r)}
                        className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {recordSlot && <div className="pt-3">{recordSlot}</div>}
          </div>
        </CardContent>
      </Card>

      {/* 記録の削除。推移グラフから点が消えるので日付を明示する */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={open => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>この記録を削除しますか</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.snapshot_date} に記録したスコアを削除します。
              推移グラフからこの日の点が消えます。元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={e => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 size={14} className="animate-spin" />}
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
