'use client'

// アカウント作成（ポータル） — 招待リンク管理 + アカウント手動作成
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../components/AdminDataProvider'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type InviteLink = {
  id: string
  token: string
  is_active: boolean
  created_at: string
}

function generatePassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let pw = ''
  for (let i = 0; i < 8; i++) {
    pw += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return pw
}

export default function MembersPortalPage() {
  const { companyId } = useAuth()
  const cacheKey = `admin-members-portal-${companyId}`
  const cached = getPageCache<InviteLink[]>(cacheKey)
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>(cached ?? [])
  const [loading, setLoading] = useState(!cached)

  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [creating, setCreating] = useState(false)
  const [generatingLink, setGeneratingLink] = useState(false)

  useEffect(() => {
    if (!companyId) return
    if (getPageCache<InviteLink[]>(cacheKey)) return
    fetchData()
  }, [companyId, cacheKey])

  const fetchData = async () => {
    if (!companyId) return
    const { data } = await supabase
      .from('invite_links')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
    if (data) {
      setInviteLinks(data)
      setPageCache(cacheKey, data)
    }
    setLoading(false)
  }

  const showMessage = (msg: string, type: 'success' | 'error') => {
    if (type === 'success') toast.success(msg)
    else toast.error(msg)
  }

  const handleGenerateLink = async () => {
    if (!companyId) return
    setGeneratingLink(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/invite_links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': anonKey, 'Authorization': `Bearer ${token}`, 'Prefer': 'return=representation' },
        body: JSON.stringify({ company_id: companyId }),
      })
      if (!res.ok) { const body = await res.text(); throw new Error(`HTTP ${res.status}: ${body}`) }
      showMessage('招待リンクを生成しました', 'success')
      await fetchData()
    } catch (err) {
      showMessage('生成に失敗しました: ' + (err instanceof Error ? err.message : '不明'), 'error')
    } finally {
      setGeneratingLink(false)
    }
  }

  const handleDeactivateLink = async (linkId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/invite_links?id=eq.${linkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'apikey': anonKey, 'Authorization': `Bearer ${token}`, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ is_active: false }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      showMessage('招待リンクを無効化しました', 'success')
      await fetchData()
    } catch (err) {
      showMessage('無効化に失敗: ' + (err instanceof Error ? err.message : '不明'), 'error')
    }
  }

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/portal/register?token=${token}`
    navigator.clipboard.writeText(url)
    showMessage('コピーしました', 'success')
  }

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return
    setCreating(true)
    try {
      const res = await fetch('/api/members/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, password: newPassword, display_name: newDisplayName, company_id: companyId }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || '作成に失敗')
      showMessage('アカウントを作成しました', 'success')
      setNewEmail(''); setNewPassword(''); setNewDisplayName('')
      await fetchData()
    } catch (err) {
      showMessage('作成に失敗: ' + (err instanceof Error ? err.message : '不明'), 'error')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-40 mb-6" />
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-6">
          <CardContent className="p-5 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-64" />
            <Skeleton className="h-9 w-36" />
            <div className="space-y-2 mt-4">
              {[1, 2].map(i => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-border">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-20 rounded" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 space-y-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-9 w-28" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      {/* 招待リンク */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-6">
        <CardContent className="p-5">
          <h3 className="text-sm font-bold text-foreground mb-2">招待リンク</h3>
          <p className="text-xs text-muted-foreground mb-3 m-0">
            従業員に共有すると、セルフ登録でアカウントを作成できます
          </p>

          <Button onClick={handleGenerateLink} disabled={generatingLink} size="sm" className="mb-4">
            {generatingLink ? '生成中...' : '招待リンクを生成'}
          </Button>

          {inviteLinks.length > 0 && (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-semibold border-b border-border text-xs">リンク</th>
                  <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-semibold border-b border-border text-xs">ステータス</th>
                  <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-semibold border-b border-border text-xs">作成日</th>
                  <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-semibold border-b border-border text-xs">操作</th>
                </tr>
              </thead>
              <tbody>
                {inviteLinks.map((link) => (
                  <tr key={link.id}>
                    <td className="px-4 py-3 border-b border-border text-xs text-foreground break-all">
                      /portal/register?token={link.token.substring(0, 8)}...
                    </td>
                    <td className="px-4 py-3 border-b border-border">
                      <span className={`py-0.5 px-2 rounded text-xs font-bold ${link.is_active ? 'bg-green-50 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                        {link.is_active ? '有効' : '無効'}
                      </span>
                    </td>
                    <td className="px-4 py-3 border-b border-border text-xs text-muted-foreground">
                      {new Date(link.created_at).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-4 py-3 border-b border-border">
                      {link.is_active && (
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleCopyLink(link.token)}>コピー</Button>
                          <Button variant="outline-destructive" size="sm" className="h-7 text-xs" onClick={() => handleDeactivateLink(link.id)}>無効化</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* アカウント手動作成 */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-6">
        <CardContent className="p-5">
          <h3 className="text-sm font-bold text-foreground mb-2">アカウント手動作成</h3>
          <p className="text-xs text-muted-foreground mb-4 m-0">名刺プロフィールも同時に作成されます</p>

          <form onSubmit={handleCreateMember}>
            <div className="mb-5">
              <h2 className="text-sm font-bold mb-3">メールアドレス</h2>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="member@example.com" required className="h-10" />
            </div>
            <div className="mb-5">
              <h2 className="text-sm font-bold mb-3">パスワード</h2>
              <div className="flex gap-2">
                <Input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="8文字以上" required minLength={8} className="h-10 flex-1" />
                <Button type="button" variant="outline" size="sm" onClick={() => setNewPassword(generatePassword())}>自動生成</Button>
              </div>
            </div>
            <div className="mb-5">
              <h2 className="text-sm font-bold mb-3">名前</h2>
              <Input type="text" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} placeholder="山田太郎" required className="h-10" />
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? '作成中...' : 'アカウントを作成'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
