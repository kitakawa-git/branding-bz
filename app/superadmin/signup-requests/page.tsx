'use client'

// スーパー管理画面: 新規owner登録の承認キュー
// 承認待ち（approval_status='pending'）の企業を一覧し、承認/却下する。
// 競合ドメイン一致は赤バッジで警告（自動ブロックはしない＝人手判断）。
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { SIGNUP_REQUESTS_CHANGED } from '@/app/superadmin/components/SuperAdminSidebar'
import { toast } from 'sonner'
import { AlertTriangle, Building2, Mail, Clock, Ban, Plus, Trash2 } from 'lucide-react'

type SignupRequest = {
  companyId: string
  companyName: string
  competitorFlag: boolean
  emailDomain: string | null
  createdAt: string
  owner: { email: string; name: string }
}

export default function SignupRequestsPage() {
  const [requests, setRequests] = useState<SignupRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  // 却下は取り消せない（アカウントごと消える）ので確認を挟む。
  // window.confirm はブラウザ既定の見た目で、消える対象の重さが伝わらない
  const [rejectTarget, setRejectTarget] = useState<SignupRequest | null>(null)

  const getToken = async () =>
    (await supabase.auth.getSession()).data.session?.access_token || ''

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/superadmin/signup-requests', {
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

  // 確認は呼び出し側（却下はダイアログ、承認はそのまま）で済ませてから呼ぶ
  const act = async (req: SignupRequest, action: 'approve' | 'reject') => {
    setActingId(req.companyId)
    try {
      const token = await getToken()
      const res = await fetch('/api/superadmin/signup-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ companyId: req.companyId, action }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '処理に失敗しました')
        return
      }
      toast.success(action === 'approve' ? '承認しました' : '却下しました')
      setRequests((prev) => prev.filter((r) => r.companyId !== req.companyId))
      // サイドバーの承認待ちバッジを即時更新
      window.dispatchEvent(new Event(SIGNUP_REQUESTS_CHANGED))
    } catch {
      toast.error('処理中にエラーが発生しました')
    } finally {
      setActingId(null)
    }
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-foreground">新規登録の承認</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          新規に企業を登録したオーナーの承認待ち一覧です。承認するとログインできるようになります。
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      ) : requests.length === 0 ? (
        <Card className="border bg-[hsl(0_0%_97%)] shadow-none">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            承認待ちの新規登録はありません。
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <Card key={req.companyId} className="border shadow-none">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 grow">
                    <div className="flex flex-wrap items-center gap-2">
                      <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="font-bold text-foreground">{req.companyName}</span>
                      {req.competitorFlag && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700 ring-1 ring-red-200">
                          <AlertTriangle className="h-3 w-3" />
                          競合ドメインの疑い
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" />
                        {req.owner.name ? `${req.owner.name}（${req.owner.email}）` : req.owner.email}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(req.createdAt).toLocaleString('ja-JP')}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={actingId === req.companyId}
                      onClick={() => setRejectTarget(req)}
                      className="border-red-200 text-red-700 hover:bg-red-50"
                    >
                      却下
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={actingId === req.companyId}
                      onClick={() => act(req, 'approve')}
                    >
                      {actingId === req.companyId ? '処理中...' : '承認'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-10">
        <BlockedDomainsManager />
      </div>

      <AlertDialog open={rejectTarget !== null} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              「{rejectTarget?.companyName}」の登録を却下しますか？
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p className="m-0">
                  アカウントと企業データは完全に削除されます。取り消せません。
                </p>
                <p className="m-0">
                  {rejectTarget?.owner.name}（{rejectTarget?.owner.email}）宛に却下メールが送られます。
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const target = rejectTarget
                setRejectTarget(null)
                if (target) act(target, 'reject')
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              却下する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ───────────────────────────────────────────────────────────
// 競合ドメイン ブロックリスト（手動メンテ）
// RLS で superadmin のみ read/write 可のため supabase クライアントで直接CRUD。
// 一致しても自動ブロックはせず、新規登録の承認キューで⚠警告を出すだけ。
type BlockedDomain = { id: string; domain: string; label: string | null; note: string | null }

function BlockedDomainsManager() {
  const [domains, setDomains] = useState<BlockedDomain[]>([])
  const [removeTarget, setRemoveTarget] = useState<BlockedDomain | null>(null)
  const [loading, setLoading] = useState(true)
  const [domain, setDomain] = useState('')
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('blocked_competitor_domains')
      .select('id, domain, label, note')
      .order('domain')
    if (error) toast.error('ブロックリスト取得に失敗しました')
    else setDomains((data as BlockedDomain[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const add = async () => {
    const d = domain.trim().toLowerCase().replace(/^@/, '')
    if (!d || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) {
      toast.error('正しいドメイン形式で入力してください（例: example.com）')
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('blocked_competitor_domains')
      .insert({ domain: d, label: label.trim() || null })
    setSaving(false)
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'すでに登録済みのドメインです' : '追加に失敗しました')
      return
    }
    setDomain('')
    setLabel('')
    toast.success('追加しました')
    load()
  }

  // 確認はダイアログ側で済ませてから呼ぶ
  const remove = async (id: string) => {
    const { error } = await supabase.from('blocked_competitor_domains').delete().eq('id', id)
    if (error) {
      toast.error('削除に失敗しました')
      return
    }
    setDomains((prev) => prev.filter((x) => x.id !== id))
    toast.success('削除しました')
  }

  return (
    <Card className="border shadow-none">
      <CardContent className="p-4">
        <div className="mb-1 flex items-center gap-2">
          <Ban className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-bold text-foreground">競合ドメイン ブロックリスト</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          ここに登録したドメインで新規登録があると、承認キューに⚠警告が付きます（自動ブロックはしません）。
        </p>

        <div className="mb-4 flex flex-wrap items-end gap-2">
          <div className="grow basis-48">
            <label className="mb-1 block text-xs font-bold text-muted-foreground">ドメイン</label>
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
              className="h-10"
            />
          </div>
          <div className="grow basis-48">
            <label className="mb-1 block text-xs font-bold text-muted-foreground">競合社名（任意）</label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="株式会社◯◯"
              className="h-10"
            />
          </div>
          <Button type="button" onClick={add} disabled={saving} className="h-10">
            <Plus className="mr-1 h-4 w-4" />
            追加
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        ) : domains.length === 0 ? (
          <p className="text-sm text-muted-foreground">登録されているドメインはありません。</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {domains.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-3 py-2">
                <span className="font-medium text-foreground">{d.domain}</span>
                {d.label && <span className="text-sm text-muted-foreground">{d.label}</span>}
                <span className="grow" />
                <button
                  type="button"
                  onClick={() => setRemoveTarget(d)}
                  className="text-muted-foreground hover:text-red-600"
                  aria-label="削除"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <AlertDialog open={removeTarget !== null} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {removeTarget?.domain} をブロックリストから削除しますか？
            </AlertDialogTitle>
            <AlertDialogDescription>
              このドメインで新規登録があっても、承認キューに警告が出なくなります。
              登録済みの企業には影響しません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const target = removeTarget
                setRemoveTarget(null)
                if (target) remove(target.id)
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
