'use client'

// ③ 切り口: 選択済みインサイトから5型生成→1枚選択（idのみ送信）。
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { ANGLE_LABELS, type CopyAngle } from './types'

export default function AngleSelector({
  projectId,
  angles,
  hasSelectedInsight,
  onReload,
  onNeedInsight,
  onAdvance,
}: {
  projectId: string
  angles: CopyAngle[]
  hasSelectedInsight: boolean
  onReload: () => Promise<void>
  onNeedInsight: () => void
  onAdvance: () => void
}) {
  const [busy, setBusy] = useState(false)
  const token = async () => (await supabase.auth.getSession()).data.session?.access_token || ''

  const generate = async () => {
    if (!hasSelectedInsight) {
      toast.warning('先にインサイトを選択してください')
      onNeedInsight()
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/superadmin/copy/angles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ projectId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '生成に失敗しました')
      toast.success(`${json.angles?.length ?? 0} 件の切り口を生成しました`)
      await onReload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '生成に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  const select = async (angleId: string) => {
    setBusy(true)
    try {
      // idのみ送信
      const res = await fetch('/api/superadmin/copy/angles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ projectId, angleId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '選択に失敗しました')
      toast.success('この切り口で進みます')
      await onReload()
      onAdvance() // ④生成へ進む
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '選択に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-[13px] text-muted-foreground">選んだ本音に刺す「態度表明」。1つ選ぶと生成に反映されます。</p>
          <Button onClick={generate} disabled={busy} variant={angles.length ? 'outline' : 'default'} size="sm" className="shrink-0">
            <Sparkles className="mr-1 h-4 w-4" />
            {angles.length ? '再生成' : '切り口を生成'}
          </Button>
        </div>

        {angles.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">まだ切り口がありません。「切り口を生成」を押してください。</p>
        ) : (
          <div className="space-y-3">
            {angles.map((a) => {
              const selected = a.is_selected
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => select(a.id)}
                  disabled={busy}
                  className={`block w-full rounded-lg border bg-white p-4 text-left transition-colors ${
                    selected ? 'border-ds-app-accent ring-1 ring-ds-app-accent' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <Badge variant="secondary" className="text-[11px]">{ANGLE_LABELS[a.angle_type] ?? a.angle_type}</Badge>
                    {selected && <Badge className="bg-ds-app-accent text-[11px] text-white">選択中</Badge>}
                  </div>
                  <p className="text-[15px] font-bold leading-snug text-gray-900">{a.stance}</p>
                  {a.premise && <p className="mt-1.5 text-[13px] text-muted-foreground">根拠: {a.premise}</p>}
                </button>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
