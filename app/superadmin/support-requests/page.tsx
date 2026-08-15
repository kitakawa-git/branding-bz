'use client'

// スーパー管理画面: 入力サポート相談の処理キュー
// セットアップに詰まった管理者が出した相談を一覧する。
// カレンダー連携はしないので、日程調整はこの画面の外（メール・電話）で行い、
// 連絡がついたら「対応済みにする」で消し込む。
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Building2, CalendarClock, Clock, Mail, MessageSquare } from 'lucide-react'
import { SUPPORT_REQUESTS_CHANGED } from '@/app/superadmin/components/SuperAdminSidebar'

type SupportRequest = {
  id: string
  company_id: string
  company_name: string
  progress_done: number | null
  progress_total: number | null
  preferred_slots: string | null
  note: string | null
  requested_by_email: string | null
  created_at: string
}

export default function SupportRequestsPage() {
  const [requests, setRequests] = useState<SupportRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)

  const getToken = async () =>
    (await supabase.auth.getSession()).data.session?.access_token || ''

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/superadmin/setup-support-requests', {
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

  const act = async (req: SupportRequest, action: 'done' | 'cancel') => {
    const message =
      action === 'done'
        ? `「${req.company_name}」の相談を対応済みにします。\n日程の連絡は済んでいますか？`
        : `「${req.company_name}」の相談を取り下げます。\nよろしいですか？`
    if (!window.confirm(message)) return

    setActingId(req.id)
    try {
      const token = await getToken()
      const res = await fetch('/api/superadmin/setup-support-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ requestId: req.id, action }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '処理に失敗しました')
        return
      }
      toast.success(action === 'done' ? '対応済みにしました' : '相談を取り下げました')
      setRequests((prev) => prev.filter((r) => r.id !== req.id))
      window.dispatchEvent(new Event(SUPPORT_REQUESTS_CHANGED))
    } catch {
      toast.error('処理中にエラーが発生しました')
    } finally {
      setActingId(null)
    }
  }

  return (
    <main className="max-w-4xl">
      <h1 className="mb-1 text-xl font-bold text-foreground">入力サポートの相談</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        セットアップに詰まった管理者からの相談です。日程調整はこの画面の外で行い、
        連絡がついたら「対応済みにする」で消し込んでください。
      </p>

      {loading ? (
        <div className="h-32 animate-pulse rounded-xl bg-muted/50" />
      ) : requests.length === 0 ? (
        <Card className="bg-muted/50 border shadow-none">
          <CardContent className="p-6 text-sm text-muted-foreground">
            未対応の相談はありません。
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <Card key={req.id} className="bg-muted/50 border shadow-none">
              <CardContent className="p-6">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Building2 size={16} className="text-muted-foreground" aria-hidden="true" />
                  <Link
                    href={`/superadmin/companies/${req.company_id}`}
                    className="text-base font-bold text-foreground no-underline hover:underline"
                  >
                    {req.company_name}
                  </Link>
                  {/* 依頼時点の進捗。相談前に「どこで詰まったか」を掴むための手がかり */}
                  {req.progress_total !== null && (
                    <span className="rounded px-1.5 py-0.5 text-[11px] font-semibold bg-violet-100 text-violet-800">
                      セットアップ {req.progress_done ?? 0}/{req.progress_total}
                    </span>
                  )}
                </div>

                {req.preferred_slots && (
                  <p className="mb-3 flex items-start gap-2 whitespace-pre-wrap rounded-lg bg-background px-3 py-2 text-sm text-foreground/80">
                    <CalendarClock
                      size={14}
                      className="mt-0.5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    {req.preferred_slots}
                  </p>
                )}

                {req.note && (
                  <p className="mb-3 flex items-start gap-2 whitespace-pre-wrap rounded-lg bg-background px-3 py-2 text-sm text-foreground/80">
                    <MessageSquare
                      size={14}
                      className="mt-0.5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
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
                  <Button onClick={() => act(req, 'done')} disabled={actingId === req.id}>
                    対応済みにする
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => act(req, 'cancel')}
                    disabled={actingId === req.id}
                  >
                    取り下げ
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
