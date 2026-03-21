'use client'

// 自動記録設定カード: スナップショットの自動取得スケジュールを管理
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Calendar, Loader2 } from 'lucide-react'
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

export function SnapshotScheduleCard({ companyId }: SnapshotScheduleCardProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // フォーム状態
  const [enabled, setEnabled] = useState(true)
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const [anchorDate, setAnchorDate] = useState('')
  const [lastSnapshotDate, setLastSnapshotDate] = useState<string | null>(null)

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

  // 次回記録予定日のリアルタイムプレビュー
  const nextSnapshotDate = useMemo(() => {
    if (!anchorDate || !/^\d{4}-\d{2}-\d{2}$/.test(anchorDate)) return null
    try {
      return calcNextSnapshotDate(anchorDate, frequency)
    } catch {
      return null
    }
  }, [anchorDate, frequency])

  // 保存ハンドラー
  const handleSave = async () => {
    if (enabled && !anchorDate) {
      toast.error('起点日を入力してください')
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch('/api/brand-score/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          frequency,
          anchor_date: anchorDate,
          enabled,
        }),
      })

      if (!res.ok) throw new Error()

      toast.success('自動記録設定を保存しました')
    } catch {
      toast.error('保存に失敗しました')
    } finally {
      setIsSaving(false)
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
    <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
      <CardContent className="p-5">
        {/* ヘッダー: タイトル + トグル */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <Calendar size={14} />
            自動記録設定
          </h2>
          <div className="flex items-center gap-2">
            <Label htmlFor="schedule-enabled" className="text-xs text-muted-foreground">
              {enabled ? '有効' : '無効'}
            </Label>
            <Switch
              id="schedule-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
        </div>

        {/* フォーム */}
        <div className="space-y-4">
          {/* 頻度 */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">頻度</Label>
            <Select
              value={frequency}
              onValueChange={(v) => setFrequency(v as Frequency)}
              disabled={!enabled}
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

          {/* 起点日 */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">起点日</Label>
            <Input
              type="date"
              value={anchorDate}
              onChange={e => setAnchorDate(e.target.value)}
              disabled={!enabled}
              className="h-9"
            />
          </div>

          {/* 情報表示 */}
          <div className="pt-2 border-t space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">次回記録予定日</span>
              <span className="font-medium text-foreground">
                {enabled && nextSnapshotDate ? nextSnapshotDate : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">前回記録日</span>
              <span className="font-medium text-foreground">
                {lastSnapshotDate || '—'}
              </span>
            </div>
          </div>

          {/* 保存ボタン */}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="sm"
            className="w-full"
          >
            {isSaving && <Loader2 size={14} className="animate-spin" />}
            保存する
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
