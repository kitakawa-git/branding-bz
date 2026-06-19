'use client'

// ② インサイト人間ゲート（Q5）: 生成→候補表示（生の声 source_ref を並列表示）→複数選択→確定（idのみ送信）。
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Quote, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { PSYCH_LABELS, type CopyInsight } from './types'

export default function InsightGate({
  projectId,
  insights,
  onReload,
}: {
  projectId: string
  insights: CopyInsight[]
  onReload: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(insights.filter((i) => i.is_selected).map((i) => i.id)),
  )

  const token = async () => (await supabase.auth.getSession()).data.session?.access_token || ''

  const generate = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/superadmin/copy/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ projectId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '生成に失敗しました')
      if ((json.insights ?? []).length === 0) {
        toast.warning(json.note || '接地できる候補が出ませんでした（pain_points を確認）')
      } else {
        toast.success(`${json.insights.length} 件の本音候補を生成しました`)
      }
      await onReload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '生成に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const confirm = async () => {
    if (picked.size === 0) return toast.error('1件以上選択してください')
    setBusy(true)
    try {
      // idのみ送信（本文は載せない＝改ざん防止）
      const res = await fetch('/api/superadmin/copy/insights', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ projectId, selectedIds: Array.from(picked) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '確定に失敗しました')
      toast.success('この心理で進みます')
      await onReload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '確定に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-[13px] text-muted-foreground">
            表層の悩みの裏にある「隠れた本音」。<strong>現場の声</strong>に接地した候補だけが残ります（妄想は破棄）。
          </p>
          <Button onClick={generate} disabled={busy} variant={insights.length ? 'outline' : 'default'} size="sm" className="shrink-0">
            <Sparkles className="mr-1 h-4 w-4" />
            {insights.length ? '再生成' : 'インサイトを生成'}
          </Button>
        </div>

        {insights.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">まだ候補がありません。「インサイトを生成」を押してください。</p>
        ) : (
          <div className="space-y-3">
            {insights.map((ins) => {
              const selected = picked.has(ins.id)
              return (
                <button
                  key={ins.id}
                  type="button"
                  onClick={() => toggle(ins.id)}
                  className={`block w-full rounded-lg border bg-white p-4 text-left transition-colors ${
                    selected ? 'border-ds-app-accent ring-1 ring-ds-app-accent' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1 h-4 w-4 flex-shrink-0 rounded border ${
                        selected ? 'border-ds-app-accent bg-ds-app-accent' : 'border-gray-300'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <Badge variant="secondary" className="text-[11px]">
                          {PSYCH_LABELS[ins.psych_type] ?? ins.psych_type}
                        </Badge>
                      </div>
                      <p className="text-[15px] font-bold leading-snug text-gray-900">{ins.body}</p>
                      <p className="mt-1.5 text-[13px] text-muted-foreground">{ins.rationale}</p>
                      {ins.source_ref?.ref && (
                        <div className="mt-2 flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5">
                          <Quote className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-600" />
                          <p className="text-[13px] text-amber-900">
                            現場の声：「{ins.source_ref.ref}」
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {insights.length > 0 && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-[13px] text-muted-foreground">{picked.size} 件選択中（目安2〜3件）</span>
            <Button onClick={confirm} disabled={busy || picked.size === 0}>
              この心理で行く
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
