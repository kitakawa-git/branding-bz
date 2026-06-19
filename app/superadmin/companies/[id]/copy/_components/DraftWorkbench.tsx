'use client'

// ④ 生成: 役割（尖り度・人格を表示）＋語の品格を選び生成。選択済みインサイト/切り口はサーバがDB注入。
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { COPY_ROLE_MATRIX, type CopyRole, type Register } from '@/lib/copy/role-matrix'
import { REGISTER_LABELS, type CopyDraft, type CopyReview } from './types'

const ROLES = Object.keys(COPY_ROLE_MATRIX) as CopyRole[]
const REGISTERS: Register[] = ['casual', 'neutral', 'formal', 'reverent']

export default function DraftWorkbench({
  projectId,
  drafts,
  reviews,
  onReload,
  onReview,
}: {
  projectId: string
  drafts: CopyDraft[]
  reviews: CopyReview[]
  onReload: () => Promise<void>
  onReview: (draftId: string) => void
}) {
  const [role, setRole] = useState<CopyRole>('hero_h1')
  const [register, setRegister] = useState<Register>('neutral')
  const [busy, setBusy] = useState(false)
  const spec = COPY_ROLE_MATRIX[role]
  const reviewedIds = new Set(reviews.map((r) => r.draft_id))

  const token = async () => (await supabase.auth.getSession()).data.session?.access_token || ''

  const generate = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/superadmin/copy/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ projectId, role, register }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '生成に失敗しました')
      toast.success(`${json.drafts?.length ?? 0} 案を生成しました`)
      await onReload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '生成に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  // 親draft（リライト系譜の根）を上に、子は下にぶら下げる簡易表示
  const roots = drafts.filter((d) => !d.parent_draft_id)
  const childrenOf = (id: string) => drafts.filter((d) => d.parent_draft_id === id)

  return (
    <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
      <CardContent className="p-5">
        {/* 役割選択 */}
        <div className="mb-4">
          <h2 className="text-sm font-bold mb-2">役割（コピーの枠）</h2>
          <div className="flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`min-h-9 rounded-full border px-3 text-[13px] transition-colors ${
                  role === r ? 'border-ds-app-accent bg-ds-app-accent text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                {COPY_ROLE_MATRIX[r].label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[13px] text-muted-foreground">
            尖り度 <strong>{spec.sharpness}%</strong>・人格「<strong>{spec.persona}</strong>」・{spec.candidates}案生成
          </p>
        </div>

        {/* 語の品格 */}
        <div className="mb-4">
          <h2 className="text-sm font-bold mb-2">語の品格</h2>
          <div className="flex flex-wrap gap-2">
            {REGISTERS.map((rg) => (
              <button
                key={rg}
                type="button"
                onClick={() => setRegister(rg)}
                className={`min-h-9 rounded-full border px-3 text-[13px] transition-colors ${
                  register === rg ? 'border-ds-app-accent bg-ds-app-accent text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                {REGISTER_LABELS[rg]}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={generate} disabled={busy} className="mb-5 w-full sm:w-auto">
          <Sparkles className="mr-1 h-4 w-4" />
          {busy ? '生成中…' : '生成する'}
        </Button>

        {/* 生成済みドラフト */}
        {drafts.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">まだドラフトがありません。役割を選んで生成してください。</p>
        ) : (
          <div className="space-y-3">
            {roots.map((d) => (
              <div key={d.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-[11px]">{COPY_ROLE_MATRIX[d.copy_role]?.label ?? d.copy_role}</Badge>
                  <Badge variant="outline" className="text-[11px]">{REGISTER_LABELS[d.register] ?? d.register}</Badge>
                  {reviewedIds.has(d.id) && <Badge className="bg-emerald-600 text-[11px] text-white">批評済み</Badge>}
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-900">{d.body}</p>
                <div className="mt-3">
                  <Button size="sm" variant="outline" onClick={() => onReview(d.id)}>批評する</Button>
                </div>

                {/* リライト系譜（子） */}
                {childrenOf(d.id).map((c) => (
                  <div key={c.id} className="mt-3 border-l-2 border-ds-app-accent/40 pl-3">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge variant="outline" className="text-[11px]">リライト（系譜）</Badge>
                      {reviewedIds.has(c.id) && <Badge className="bg-emerald-600 text-[11px] text-white">批評済み</Badge>}
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-900">{c.body}</p>
                    <div className="mt-2">
                      <Button size="sm" variant="outline" onClick={() => onReview(c.id)}>批評する</Button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
