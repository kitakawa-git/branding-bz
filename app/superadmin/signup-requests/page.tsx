'use client'

// スーパー管理画面: 新規owner登録の承認キュー
// 承認待ち（approval_status='pending'）の企業を一覧し、承認/却下する。
// 競合ドメイン一致は赤バッジで警告（自動ブロックはしない＝人手判断）。
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

  const act = async (req: SignupRequest, action: 'approve' | 'reject') => {
    if (action === 'reject') {
      const ok = window.confirm(
        `「${req.companyName}」の登録を却下します。\nアカウント・企業データは完全に削除され、本人へ却下メールが送られます。\nよろしいですか？`,
      )
      if (!ok) return
    }
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
                      {req.emailDomain && <span>ドメイン: {req.emailDomain}</span>}
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
                      onClick={() => act(req, 'reject')}
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

  const remove = async (id: string, d: string) => {
    if (!window.confirm(`${d} をブロックリストから削除しますか？`)) return
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
                  onClick={() => remove(d.id, d.domain)}
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
    </Card>
  )
}
