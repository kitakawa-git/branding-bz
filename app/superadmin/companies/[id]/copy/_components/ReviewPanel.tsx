'use client'

// ⑤ 批評: craft/brand_fit を別軸で並置、赤旗、処方箋（方向のみ）、自動リライト送還（before/after）。
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, ArrowRight, Gavel, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { COPY_ROLE_MATRIX } from '@/lib/copy/role-matrix'
import type { CopyDraft, CopyReview } from './types'

function ScoreBadge({ label, value, tone }: { label: string; value: number; tone: 'craft' | 'fit' }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-gray-200 bg-white px-4 py-2">
      <span className="text-[11px] text-gray-400">{label}</span>
      <span className={`text-2xl font-bold ${tone === 'craft' ? 'text-ds-app-accent' : 'text-emerald-600'}`}>{value}</span>
    </div>
  )
}

function ReviewBody({ review }: { review: CopyReview }) {
  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <ScoreBadge label="コピー力 craft" value={review.craft_score} tone="craft" />
        <ScoreBadge label="整合 brand_fit" value={review.brand_fit_score} tone="fit" />
        {review.red_flag && (
          <Badge className="gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100">
            <AlertTriangle className="h-3.5 w-3.5" /> 赤旗（正しいが退屈／硬性違反）
          </Badge>
        )}
        {review.reviewer_model && <span className="text-[11px] text-gray-400">採点: {review.reviewer_model}</span>}
      </div>

      {review.critique && <p className="mb-3 text-sm font-medium text-gray-800">「{review.critique}」</p>}

      {review.suggestions && review.suggestions.length > 0 && (
        <div>
          <p className="mb-1.5 text-[12px] font-bold text-gray-500">処方箋（リライト本文ではなく「直す方向」）</p>
          <ul className="space-y-2">
            {review.suggestions.map((s, i) => (
              <li key={i} className="rounded-md bg-gray-50 p-2.5 text-[13px]">
                <p className="text-gray-500">引用: 「{s.quote}」</p>
                <p className="text-gray-700">問題: {s.problem}</p>
                <p className="flex items-center gap-1 font-medium text-ds-app-accent">
                  <ArrowRight className="h-3.5 w-3.5" /> 方向: {s.rewrite_direction}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function ReviewPanel({
  drafts,
  reviews,
  targetDraftId,
  onReload,
}: {
  drafts: CopyDraft[]
  reviews: CopyReview[]
  targetDraftId: string | null
  onReload: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const token = async () => (await supabase.auth.getSession()).data.session?.access_token || ''

  const target = drafts.find((d) => d.id === targetDraftId) ?? drafts.find((d) => !d.parent_draft_id) ?? drafts[0]
  const latestReview = (draftId: string): CopyReview | undefined =>
    reviews.filter((r) => r.draft_id === draftId).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]

  const runReview = async (draftId: string, autoRewrite: boolean) => {
    setBusy(true)
    try {
      const res = await fetch('/api/superadmin/copy/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ draftId, autoRewrite }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '批評に失敗しました')
      if (autoRewrite && json.rewrite) {
        toast.success(`リライト ${json.rewrite.iterations?.length ?? 0} 回（${json.rewrite.stopped === 'clean' ? '赤旗解消' : '2回で停止'}）`)
      } else {
        toast.success(json.review?.redFlag ? '批評完了（赤旗あり）' : '批評完了')
      }
      await onReload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '批評に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  if (!target) {
    return (
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">
          <p className="text-[13px] text-muted-foreground">先にドラフトを生成してください（④）。</p>
        </CardContent>
      </Card>
    )
  }

  const targetReview = latestReview(target.id)
  const children = drafts.filter((d) => d.parent_draft_id === target.id)

  return (
    <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
      <CardContent className="p-5">
        {/* before（対象draft） */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-1.5 flex items-center gap-2">
            <Badge variant="secondary" className="text-[11px]">{COPY_ROLE_MATRIX[target.copy_role]?.label ?? target.copy_role}</Badge>
            <span className="text-[11px] text-gray-400">対象ドラフト</span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-900">{target.body}</p>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => runReview(target.id, false)} disabled={busy}>
            <Gavel className="mr-1 h-4 w-4" /> 批評する
          </Button>
          <Button size="sm" variant="outline" onClick={() => runReview(target.id, true)} disabled={busy}>
            <RefreshCw className="mr-1 h-4 w-4" /> 自動リライトへ送還
          </Button>
        </div>

        {targetReview && <ReviewBody review={targetReview} />}

        {/* after（リライト系譜・before/after比較） */}
        {children.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-[12px] font-bold text-gray-500">自動リライト結果（before → after）</p>
            {children
              .slice()
              .sort((a, b) => a.created_at.localeCompare(b.created_at))
              .map((c, idx) => {
                const cr = latestReview(c.id)
                const beforeCraft = targetReview?.craft_score
                return (
                  <div key={c.id} className="mb-3 rounded-xl border border-ds-app-accent/40 bg-white p-4">
                    <div className="mb-1.5 flex items-center gap-2">
                      <Badge variant="outline" className="text-[11px]">リライト #{idx + 1}</Badge>
                      {cr && beforeCraft != null && (
                        <span className="text-[12px] text-gray-500">
                          craft {beforeCraft} <ArrowRight className="inline h-3 w-3" /> <strong className="text-ds-app-accent">{cr.craft_score}</strong>
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-900">{c.body}</p>
                    {cr && <ReviewBody review={cr} />}
                  </div>
                )
              })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
