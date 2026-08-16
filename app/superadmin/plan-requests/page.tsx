'use client'

// スーパー管理画面: プラン変更依頼の処理キュー
// 契約者が管理画面から出した希望プランを一覧し、承認（=companies.plan を書き換え）
// または却下する。決済は自前で持たないので、入金・契約の確認は人がやる前提。
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { ArrowRight, Sparkles, Clock, Mail, MessageSquare } from 'lucide-react'
import { PLAN_LABELS, PLAN_TONES } from '@/lib/billing/plan-display'
import { PLAN_REQUESTS_CHANGED } from '@/app/superadmin/components/SuperAdminSidebar'

type PlanRequest = {
  id: string
  company_id: string
  company_name: string
  current_plan: string
  requested_plan: string
  note: string | null
  requested_by_email: string | null
  created_at: string
}

function PlanChip({ plan }: { plan: string }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${PLAN_TONES[plan] ?? PLAN_TONES.free}`}>
      {PLAN_LABELS[plan] ?? plan}
    </span>
  )
}

export default function PlanRequestsPage() {
  const [requests, setRequests] = useState<PlanRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)

  const getToken = async () =>
    (await supabase.auth.getSession()).data.session?.access_token || ''

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/superadmin/plan-change-requests', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '取得に失敗しました')
        return
      }
      setRequests(data.requests || [])
    } catch {
      toast.error('取得中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const act = async (req: PlanRequest, action: 'approve' | 'reject') => {
    const label = PLAN_LABELS[req.requested_plan] ?? req.requested_plan
    const message =
      action === 'approve'
        ? `「${req.company_name}」を ${label} に変更します。\nこの操作で即座にプランが切り替わります。入金・契約の確認は済んでいますか？`
        : `「${req.company_name}」の ${label} への依頼を却下します。\nプランは変わりません。よろしいですか？`
    if (!window.confirm(message)) return

    setActingId(req.id)
    try {
      const token = await getToken()
      const res = await fetch('/api/superadmin/plan-change-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ requestId: req.id, action }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '処理に失敗しました')
        return
      }
      toast.success(
        action === 'approve' ? `${req.company_name} を ${label} に変更しました` : '依頼を却下しました',
      )
      setRequests((prev) => prev.filter((r) => r.id !== req.id))
      window.dispatchEvent(new Event(PLAN_REQUESTS_CHANGED))
    } catch {
      toast.error('処理中にエラーが発生しました')
    } finally {
      setActingId(null)
    }
  }

  return (
    <main className="max-w-4xl">
      <h1 className="mb-1 text-xl font-bold text-foreground">プラン変更の依頼</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        契約者が管理画面から出した希望プランです。承認するとその場で
        <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">companies.plan</code>
        が切り替わります。入金・契約の確認はこの画面の外で行ってください。
      </p>

      {loading ? (
        <div className="h-32 animate-pulse rounded-xl bg-muted/50" />
      ) : requests.length === 0 ? (
        <Card className="bg-muted/50 border shadow-none">
          <CardContent className="p-6 text-sm text-muted-foreground">
            未対応の依頼はありません。
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <Card key={req.id} className="bg-muted/50 border shadow-none">
              <CardContent className="p-6">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Sparkles size={16} className="text-muted-foreground" aria-hidden="true" />
                  <Link
                    href={`/superadmin/companies/${req.company_id}`}
                    className="text-base font-bold text-foreground no-underline hover:underline"
                  >
                    {req.company_name}
                  </Link>
                </div>

                <div className="mb-3 flex items-center gap-2">
                  <PlanChip plan={req.current_plan} />
                  <ArrowRight size={14} className="text-muted-foreground" aria-hidden="true" />
                  <PlanChip plan={req.requested_plan} />
                </div>

                {req.note && (
                  <p className="mb-3 flex items-start gap-2 whitespace-pre-wrap rounded-lg bg-background px-3 py-2 text-sm text-foreground/80">
                    <MessageSquare size={14} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    {req.note}
                  </p>
                )}

                <div className="mb-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  {req.requested_by_email && (
                    <span className="inline-flex items-center gap-1">
                      <Mail size={12} aria-hidden="true" />
                      {req.requested_by_email}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Clock size={12} aria-hidden="true" />
                    {new Date(req.created_at).toLocaleString('ja-JP')}
                  </span>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => act(req, 'approve')}
                    disabled={actingId === req.id}
                  >
                    このプランに変更する
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => act(req, 'reject')}
                    disabled={actingId === req.id}
                  >
                    却下
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  )
}
