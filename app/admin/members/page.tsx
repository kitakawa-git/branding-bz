'use client'

// アカウント管理ページ（統合: 一覧 + 作成 + 招待リンク）
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../components/AuthProvider'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { Button } from '@/components/ui/button'
import { Check, Pencil, Eye, EyeOff, Trash2, Link2, ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// ============================================
// Types
// ============================================

type MemberWithProfile = {
  id: string
  auth_id: string
  display_name: string
  email: string
  is_active: boolean
  created_at: string
  profile_id: string | null
  profile: {
    id: string
    name: string
    slug: string
    card_enabled: boolean
    photo_url: string | null
  } | null
}

type InviteLink = {
  id: string
  token: string
  is_active: boolean
  created_at: string
}

type AdminMembersCache = {
  members: MemberWithProfile[]
  inviteLinks: InviteLink[]
}

// ============================================
// Helpers
// ============================================

function generatePassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let pw = ''
  for (let i = 0; i < 8; i++) {
    pw += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return pw
}

// ============================================
// Component
// ============================================

export default function MembersPage() {
  const { companyId } = useAuth()
  const cacheKey = `admin-members-${companyId}`
  const cached = companyId ? getPageCache<AdminMembersCache>(cacheKey) : null

  // メンバー一覧
  const [members, setMembers] = useState<MemberWithProfile[]>(cached?.members ?? [])
  const [loading, setLoading] = useState(!cached)
  const [fetchError, setFetchError] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // 招待リンク
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>(cached?.inviteLinks ?? [])
  const [generatingLink, setGeneratingLink] = useState(false)
  const [showInviteLinks, setShowInviteLinks] = useState(false)

  // アカウント作成フォーム
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [creating, setCreating] = useState(false)

  // ============================================
  // Fetch
  // ============================================
  const fetchData = async (retryCount = 0) => {
    if (!companyId) return
    if (retryCount === 0) {
      setLoading(true)
      setFetchError('')
    }

    const MAX_RETRIES = 2

    try {
      const [membersResult, linksResult] = await Promise.all([
        Promise.race([
          supabase
            .from('members')
            .select('id, auth_id, display_name, email, is_active, created_at, profile:profiles(id, name, slug, card_enabled, photo_url)')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 15000)
          ),
        ]),
        supabase
          .from('invite_links')
          .select('*')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false }),
      ])

      if (membersResult.error) throw new Error(membersResult.error.message)

      const membersData = (membersResult.data ?? []).map((m: any) => {
        const profile = Array.isArray(m.profile) ? m.profile[0] : m.profile
        return { ...m, profile: profile || null } as MemberWithProfile
      })
      const linksData = (linksResult.data ?? []) as InviteLink[]

      setMembers(membersData)
      setInviteLinks(linksData)
      setPageCache(cacheKey, { members: membersData, inviteLinks: linksData })
    } catch (err) {
      console.error(`[Members] データ取得エラー (試行${retryCount + 1}/${MAX_RETRIES + 1}):`, err)

      if (retryCount < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)))
        return fetchData(retryCount + 1)
      }

      const msg = err instanceof Error && err.message === 'timeout'
        ? 'データの取得がタイムアウトしました。再読み込みをお試しください。'
        : 'データの取得に失敗しました'
      setFetchError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!companyId) return
    if (getPageCache<AdminMembersCache>(cacheKey)) return
    fetchData()
  }, [companyId, cacheKey])

  // ============================================
  // Card toggle
  // ============================================
  const toggleCard = async (profileId: string, currentValue: boolean) => {
    setTogglingId(profileId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const res = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${profileId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
          'Authorization': `Bearer ${token}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ card_enabled: !currentValue }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      setMembers(prev => prev.map(m => {
        if (m.profile?.id === profileId) {
          return { ...m, profile: { ...m.profile!, card_enabled: !currentValue } }
        }
        return m
      }))
    } catch (err) {
      console.error('card_enabled更新エラー:', err)
      toast.error('名刺設定の更新に失敗しました')
    } finally {
      setTogglingId(null)
    }
  }

  // ============================================
  // Active toggle
  // ============================================
  const toggleActive = async (memberId: string, currentActive: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const res = await fetch(`${supabaseUrl}/rest/v1/members?id=eq.${memberId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
          'Authorization': `Bearer ${token}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ is_active: !currentActive }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      setMembers(prev => prev.map(m =>
        m.id === memberId ? { ...m, is_active: !currentActive } : m
      ))
      toast.success(currentActive ? 'アカウントを無効化しました' : 'アカウントを有効化しました')
    } catch (err) {
      console.error('ステータス更新エラー:', err)
      toast.error('ステータスの更新に失敗しました')
    }
  }

  // ============================================
  // Delete member
  // ============================================
  const handleDelete = async (memberId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const res = await fetch(`${supabaseUrl}/rest/v1/members?id=eq.${memberId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
          'Authorization': `Bearer ${token}`,
          'Prefer': 'return=minimal',
        },
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      setMembers(prev => prev.filter(m => m.id !== memberId))
      toast.success('アカウントを削除しました')
    } catch (err) {
      console.error('削除エラー:', err)
      toast.error('アカウントの削除に失敗しました')
    }
  }

  // ============================================
  // Invite Link handlers
  // ============================================
  const handleGenerateLink = async () => {
    if (!companyId) return
    setGeneratingLink(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const res = await fetch(`${supabaseUrl}/rest/v1/invite_links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': anonKey, 'Authorization': `Bearer ${token}`, 'Prefer': 'return=representation' },
        body: JSON.stringify({ company_id: companyId }),
      })
      if (!res.ok) { const body = await res.text(); throw new Error(`HTTP ${res.status}: ${body}`) }
      toast.success('招待リンクを生成しました')
      // invite_links を再取得
      const { data } = await supabase.from('invite_links').select('*').eq('company_id', companyId).order('created_at', { ascending: false })
      if (data) setInviteLinks(data as InviteLink[])
    } catch (err) {
      toast.error('生成に失敗しました: ' + (err instanceof Error ? err.message : '不明'))
    } finally {
      setGeneratingLink(false)
    }
  }

  const handleDeactivateLink = async (linkId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const res = await fetch(`${supabaseUrl}/rest/v1/invite_links?id=eq.${linkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'apikey': anonKey, 'Authorization': `Bearer ${token}`, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ is_active: false }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success('招待リンクを無効化しました')
      const { data } = await supabase.from('invite_links').select('*').eq('company_id', companyId).order('created_at', { ascending: false })
      if (data) setInviteLinks(data as InviteLink[])
    } catch (err) {
      toast.error('無効化に失敗: ' + (err instanceof Error ? err.message : '不明'))
    }
  }

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/portal/register?token=${token}`
    navigator.clipboard.writeText(url)
    toast.success('コピーしました')
  }

  // ============================================
  // Create member
  // ============================================
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
      toast.success('アカウントを作成しました')
      setNewEmail(''); setNewPassword(''); setNewDisplayName('')
      // メンバー一覧を再取得
      await fetchData()
    } catch (err) {
      toast.error('作成に失敗: ' + (err instanceof Error ? err.message : '不明'))
    } finally {
      setCreating(false)
    }
  }

  // ============================================
  // Render
  // ============================================

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-40 mb-6" />
        {/* 作成フォームスケルトン */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-6">
          <CardContent className="p-5 space-y-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-9 w-28" />
          </CardContent>
        </Card>
        {/* テーブルスケルトン */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-0">
            <div className="p-4">
              <div className="flex bg-muted px-4 py-3 gap-4 border-b border-border rounded-t-md">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Skeleton key={i} className="h-4 w-20" />
                ))}
              </div>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex px-4 py-3 gap-4 border-b border-border items-center">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-16 rounded" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">アカウント管理</h1>

      {/* ===== アカウント作成フォーム ===== */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-6">
        <CardContent className="p-5">
          <h3 className="text-sm font-bold text-foreground mb-2">アカウント作成</h3>
          <p className="text-xs text-muted-foreground mb-4 m-0">名刺プロフィールも同時に作成されます</p>

          <form onSubmit={handleCreateMember}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
              <div>
                <label className="text-xs font-bold mb-1.5 block">メールアドレス</label>
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="member@example.com" required className="h-9" />
              </div>
              <div>
                <label className="text-xs font-bold mb-1.5 block">パスワード</label>
                <div className="flex gap-2">
                  <Input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="8文字以上" required minLength={8} className="h-9 flex-1" />
                  <Button type="button" variant="outline" size="sm" className="h-9 text-xs shrink-0" onClick={() => setNewPassword(generatePassword())}>自動生成</Button>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold mb-1.5 block">名前</label>
                <Input type="text" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} placeholder="山田太郎" required className="h-9" />
              </div>
            </div>
            <Button type="submit" disabled={creating} variant="outline" className="py-2 px-4 text-[13px]">
              {creating ? '作成中...' : <><Plus size={16} />アカウントを追加</>}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ===== 招待リンク ===== */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-6">
        <CardContent className="p-0">
          <button
            onClick={() => setShowInviteLinks(!showInviteLinks)}
            className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Link2 size={16} className="text-muted-foreground" />
              <h3 className="text-sm font-bold text-foreground">招待リンク</h3>
              <span className="text-xs text-muted-foreground">— 従業員に共有してセルフ登録</span>
            </div>
            {showInviteLinks ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
          </button>

          {showInviteLinks && (
            <div className="px-5 pb-5 border-t">
              <div className="pt-4">
                <Button onClick={handleGenerateLink} disabled={generatingLink} size="sm" className="mb-4">
                  {generatingLink ? '生成中...' : '招待リンクを生成'}
                </Button>

                {inviteLinks.length > 0 && (
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="text-left px-4 py-2 bg-muted text-muted-foreground font-semibold border-b border-border text-xs">リンク</th>
                        <th className="text-left px-4 py-2 bg-muted text-muted-foreground font-semibold border-b border-border text-xs">ステータス</th>
                        <th className="text-left px-4 py-2 bg-muted text-muted-foreground font-semibold border-b border-border text-xs">作成日</th>
                        <th className="text-left px-4 py-2 bg-muted text-muted-foreground font-semibold border-b border-border text-xs">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inviteLinks.map((link) => (
                        <tr key={link.id}>
                          <td className="px-4 py-2 border-b border-border text-xs text-foreground break-all">
                            /portal/register?token={link.token.substring(0, 8)}...
                          </td>
                          <td className="px-4 py-2 border-b border-border">
                            <span className={`py-0.5 px-2 rounded text-xs font-bold ${link.is_active ? 'bg-green-50 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                              {link.is_active ? '有効' : '無効'}
                            </span>
                          </td>
                          <td className="px-4 py-2 border-b border-border text-xs text-muted-foreground">
                            {new Date(link.created_at).toLocaleDateString('ja-JP')}
                          </td>
                          <td className="px-4 py-2 border-b border-border">
                            {link.is_active && (
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleCopyLink(link.token)}>コピー</Button>
                                <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => handleDeactivateLink(link.id)}>無効化</Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {inviteLinks.length === 0 && (
                  <p className="text-xs text-muted-foreground">招待リンクはまだありません</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== アカウント一覧 ===== */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-0">
          {fetchError ? (
            <div className="text-center p-10">
              <p className="text-red-600 text-sm mb-3">{fetchError}</p>
              <Button variant="outline" size="sm" onClick={() => fetchData(0)}>再読み込み</Button>
            </div>
          ) : members.length === 0 ? (
            <p className="text-muted-foreground text-center p-10">アカウントが登録されていません</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">名前</th>
                  <th className="px-4 py-3 font-medium">メール</th>
                  <th className="px-4 py-3 font-medium">名刺</th>
                  <th className="px-4 py-3 font-medium">ステータス</th>
                  <th className="px-4 py-3 font-medium">登録日</th>
                  <th className="px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const cardEnabled = member.profile?.card_enabled ?? false
                  const profileId = member.profile?.id
                  return (
                    <tr key={member.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="size-9 shrink-0">
                            {member.profile?.photo_url && <AvatarImage src={member.profile.photo_url} alt={member.display_name} />}
                            <AvatarFallback className="text-xs">{member.display_name.slice(0, 1)}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-bold text-foreground">{member.display_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-foreground">{member.email}</span>
                      </td>
                      <td className="px-4 py-3">
                        {profileId ? (
                          <button
                            onClick={() => toggleCard(profileId, cardEnabled)}
                            disabled={togglingId === profileId}
                            className={`py-1 px-3 rounded-xl border-none text-xs font-bold cursor-pointer ${cardEnabled ? 'bg-green-50 text-green-600' : 'bg-muted text-muted-foreground'} ${togglingId === profileId ? 'opacity-50 cursor-default' : ''}`}
                          >
                            {cardEnabled ? <><Check size={14} className="inline" /> ON</> : 'OFF'}
                          </button>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`py-0.5 px-2 rounded text-xs font-bold ${member.is_active ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                          {member.is_active ? '有効' : '無効'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">
                          {new Date(member.created_at).toLocaleDateString('ja-JP')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`size-8 ${member.is_active ? '' : 'text-muted-foreground'}`}
                              >
                                {member.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {member.is_active ? 'アカウントを無効化しますか？' : 'アカウントを有効化しますか？'}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {member.is_active
                                    ? `「${member.display_name}」のアカウントを無効化します。データは残りますが非表示になります。`
                                    : `「${member.display_name}」のアカウントを有効化します。`}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                <AlertDialogAction onClick={() => toggleActive(member.id, member.is_active)}>
                                  {member.is_active ? '無効化する' : '有効化する'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          {profileId && cardEnabled ? (
                            <Button variant="ghost" size="icon" className="size-8" asChild>
                              <Link href={`/admin/members/${profileId}/edit`}>
                                <Pencil size={14} />
                              </Link>
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" className="size-8" disabled>
                              <Pencil size={14} />
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive hover:text-destructive"
                              >
                                <Trash2 size={14} />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>アカウントを削除しますか？</AlertDialogTitle>
                                <AlertDialogDescription>
                                  この操作は取り消せません。「{member.display_name}」のアカウントを完全に削除します。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(member.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  削除する
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
