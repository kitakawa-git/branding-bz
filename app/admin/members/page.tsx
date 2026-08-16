'use client'

// アカウント管理ページ（統合: 一覧 + 作成 + 招待リンク）
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/supabase-fetch'
import { useAuth } from '../components/AdminDataProvider'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { MEMBER_ROLE_OPTIONS } from '@/lib/constants/member-roles'
import { Button } from '@/components/ui/button'
import { Check, Pencil, Eye, EyeOff, Trash2, Link2, ChevronDown, ChevronUp, Plus, Upload, UserPlus, CheckCircle2, XCircle } from 'lucide-react'
import { Fab, FabButton } from '@/components/ui/fab'
import { MemberCsvImportDialog } from './MemberCsvImportDialog'
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
  status: string | null
  created_at: string
  profile_id: string | null
  profile: {
    id: string
    name: string
    slug: string
    card_enabled: boolean
    photo_url: string | null
    role_category: string | null
  } | null
}

type JoinRequest = {
  id: string
  auth_id: string
  display_name: string
  email: string
  created_at: string
  profile_id: string | null
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
  /** 管理者の auth_id 一覧（admin_users に行がある人） */
  adminAuthIds: string[]
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

  // 参加リクエスト
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([])
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null)

  // 招待リンク
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>(cached?.inviteLinks ?? [])
  const [adminAuthIds, setAdminAuthIds] = useState<string[]>(cached?.adminAuthIds ?? [])
  const [togglingAdminId, setTogglingAdminId] = useState<string | null>(null)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [showInviteLinks, setShowInviteLinks] = useState(false)

  // 孤立アカウントクリーンアップ
  const [showCleanup, setShowCleanup] = useState(false)
  const [cleanupEmail, setCleanupEmail] = useState('')
  const [cleaningUp, setCleaningUp] = useState(false)

  // アカウント作成フォーム
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [csvDialogOpen, setCsvDialogOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [creating, setCreating] = useState(false)

  // ============================================
  // Fetch
  // ============================================
  const fetchData = async () => {
    if (!companyId) return
    setLoading(true)
    setFetchError('')

    // fetchWithRetry: タイムアウト6秒 + リトライ1回（setTimeout リーク防止＋短縮）
    const [membersRes, linksRes] = await Promise.all([
      fetchWithRetry(() =>
        supabase
          .from('members')
          .select('id, auth_id, display_name, email, is_active, status, created_at, profile:profiles(id, name, slug, card_enabled, photo_url, role_category)')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
      ),
      fetchWithRetry(() =>
        supabase
          .from('invite_links')
          .select('*')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
      ),
    ])

    if (membersRes.error) {
      console.error('[Members] データ取得エラー:', membersRes.error)
      setFetchError(membersRes.error)
      setLoading(false)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const membersData = ((membersRes.data ?? []) as any[])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((m: any) => {
        const profile = Array.isArray(m.profile) ? m.profile[0] : m.profile
        return { ...m, profile: profile || null } as MemberWithProfile
      })
      // 参加リクエスト中（pending）のメンバーは別セクションで表示するので一覧から除外
      .filter((m: MemberWithProfile) => m.status !== 'pending')
    const linksData = (linksRes.data ?? []) as InviteLink[]

    setMembers(membersData)
    setInviteLinks(linksData)
    setPageCache(cacheKey, {
      members: membersData,
      inviteLinks: linksData,
      adminAuthIds,
    })
    setLoading(false)
  }

  useEffect(() => {
    if (!companyId) return
    if (getPageCache<AdminMembersCache>(cacheKey)) return
    fetchData()
  }, [companyId, cacheKey])

  // 管理者一覧はサーバー経由で取る。admin_users は RLS で自分の行しか
  // 読めないため、クライアントから select すると全員 OFF に見える。
  // 一覧のキャッシュとは別に、開くたびに取り直す（件数が少なく軽い）
  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/admin/members/admin-role', {
          headers: { Authorization: `Bearer ${session?.access_token || ''}` },
        })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setAdminAuthIds(data.auth_ids ?? [])
      } catch (err) {
        console.error('[Members] 管理者一覧の取得エラー:', err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [companyId])

  // ============================================
  // Join Requests
  // ============================================
  const fetchJoinRequests = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/members/join-requests', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setJoinRequests(data.requests || [])
    } catch {
      // 取得失敗は無視
    }
  }

  useEffect(() => {
    if (companyId) fetchJoinRequests()
  }, [companyId])

  const handleJoinRequest = async (memberId: string, action: 'approve' | 'reject') => {
    setProcessingRequestId(memberId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch('/api/members/join-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ memberId, action }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '処理に失敗しました')
        return
      }

      if (action === 'approve') {
        toast.success(`${data.member.name} を承認しました`)
        await fetchData()
      } else {
        toast.success(`${data.member.name} のリクエストを拒否しました`)
      }
      setJoinRequests(prev => prev.filter(r => r.id !== memberId))
    } catch (err) {
      toast.error('処理に失敗しました: ' + (err instanceof Error ? err.message : '不明'))
    } finally {
      setProcessingRequestId(null)
    }
  }

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
  // 区分（経営層/管理職/従業員）更新
  // ============================================
  const updateRoleCategory = async (profileId: string, value: string) => {
    // 楽観更新（失敗時に元へ戻す）
    const prevMembers = members
    setMembers(prev => prev.map(m =>
      m.profile?.id === profileId
        ? { ...m, profile: { ...m.profile!, role_category: value } }
        : m
    ))
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
        body: JSON.stringify({ role_category: value }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (err) {
      console.error('区分更新エラー:', err)
      toast.error('区分の更新に失敗しました')
      setMembers(prevMembers)
    }
  }

  // ============================================
  // 管理者の付与・剥奪
  // ============================================
  // 管理者かどうかは admin_users に行があるかで決まる（members とは別テーブル）。
  // 最後の1人を外すと誰も管理画面に入れなくなるので、判定はサーバー側が持つ
  const toggleAdmin = async (authId: string, isAdmin: boolean) => {
    if (togglingAdminId) return
    setTogglingAdminId(authId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const res = await fetch(
        isAdmin
          ? `/api/admin/members/admin-role?auth_id=${authId}`
          : '/api/admin/members/admin-role',
        {
          method: isAdmin ? 'DELETE' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: isAdmin ? undefined : JSON.stringify({ auth_id: authId }),
        }
      )
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)

      const next = isAdmin
        ? adminAuthIds.filter(id => id !== authId)
        : [...adminAuthIds, authId]
      setAdminAuthIds(next)
      setPageCache(cacheKey, { members, inviteLinks, adminAuthIds: next })
      toast.success(isAdmin ? '管理者から外しました' : '管理者にしました')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '切り替えに失敗しました')
    } finally {
      setTogglingAdminId(null)
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

      // Service Role で members / profiles / auth.users と関連投稿をまとめて削除
      const res = await fetch(`/api/members/${memberId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }

      setMembers(prev => prev.filter(m => m.id !== memberId))
      toast.success('アカウントを削除しました')
    } catch (err) {
      console.error('削除エラー:', err)
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`アカウントの削除に失敗しました: ${msg}`)
    }
  }

  // ============================================
  // 孤立アカウントのクリーンアップ
  // （members に存在しないが auth.users に残ってしまったケース用）
  // ============================================
  const handleCleanupOrphan = async () => {
    const email = cleanupEmail.trim()
    if (!email) {
      toast.error('メールアドレスを入力してください')
      return
    }
    setCleaningUp(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const res = await fetch('/api/members/cleanup-orphan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ email }),
      })

      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.error || `HTTP ${res.status}`)
      }

      toast.success(`${email} の残存アカウントを削除しました`)
      setCleanupEmail('')
    } catch (err) {
      console.error('クリーンアップエラー:', err)
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg)
    } finally {
      setCleaningUp(false)
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
      setCreateDialogOpen(false)
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
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-4">
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

      {/* ===== アカウント作成 FAB（右下固定） ===== */}
      <Fab>
        <FabButton onClick={() => setCsvDialogOpen(true)} icon={<Upload size={16} />}>
          CSVで一括登録
        </FabButton>
        <FabButton onClick={() => setCreateDialogOpen(true)} icon={<Plus size={16} />}>
          アカウントを追加
        </FabButton>
      </Fab>

      <MemberCsvImportDialog
        open={csvDialogOpen}
        onOpenChange={setCsvDialogOpen}
        onCompleted={() => {
          setPageCache(cacheKey, null as unknown as AdminMembersCache)
          fetchData()
        }}
      />

      {/* ===== アカウント作成モーダル ===== */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>アカウント作成</DialogTitle>
            <DialogDescription>名刺プロフィールも同時に作成されます</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateMember} className="space-y-4">
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
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                キャンセル
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? '作成中...' : <><Plus size={16} />アカウントを追加</>}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ===== 招待リンク ===== */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-4">
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
                  <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] border-collapse text-sm">
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
                          <td className="px-4 py-2 border-b border-border whitespace-nowrap">
                            <span className={`inline-block py-0.5 px-2 rounded text-xs font-bold whitespace-nowrap ${link.is_active ? 'bg-green-50 text-green-600' : 'bg-muted text-muted-foreground'}`}>
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
                  </div>
                )}
                {inviteLinks.length === 0 && (
                  <p className="text-xs text-muted-foreground">招待リンクはまだありません</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== 孤立アカウントクリーンアップ ===== */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-4">
        <CardContent className="p-0">
          <button
            onClick={() => setShowCleanup(!showCleanup)}
            className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Trash2 size={16} className="text-muted-foreground" />
              <h3 className="text-sm font-bold text-foreground">残存アカウントの削除</h3>
              <span className="text-xs text-muted-foreground">— 「既に登録されています」エラーが出る時に使用</span>
            </div>
            {showCleanup ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
          </button>

          {showCleanup && (
            <div className="px-5 pb-5 border-t">
              <div className="pt-4">
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                  メンバー削除後にAuthデータが残ってしまい、同じメールアドレスで再登録できないケース用の復旧機能です。<br />
                  メンバー一覧に存在するアカウントには使えません（先に通常の削除を実行してください）。
                </p>
                <div className="flex gap-2 items-start">
                  <Input
                    type="email"
                    placeholder="member@example.com"
                    value={cleanupEmail}
                    onChange={(e) => setCleanupEmail(e.target.value)}
                    className="max-w-xs"
                    disabled={cleaningUp}
                  />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        disabled={!cleanupEmail.trim() || cleaningUp}
                      >
                        {cleaningUp ? '削除中...' : '残存アカウントを削除'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>残存アカウントを削除しますか？</AlertDialogTitle>
                        <AlertDialogDescription>
                          「{cleanupEmail}」に紐づくSupabase Authアカウント（およびprofilesの残骸）を削除します。<br />
                          メンバー一覧にこのメールアドレスが存在する場合はエラーになります（先に通常の削除を実行してください）。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>キャンセル</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleCleanupOrphan}
                          className="bg-destructive text-white hover:bg-destructive/90"
                        >
                          削除する
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== 参加リクエスト ===== */}
      {joinRequests.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 shadow-none mb-4">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <UserPlus size={16} className="text-amber-600" />
              <h3 className="text-sm font-bold text-foreground">
                参加リクエスト
                <span className="ml-2 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-amber-500 text-white text-xs font-bold">
                  {joinRequests.length}
                </span>
              </h3>
            </div>
            <div className="space-y-2">
              {joinRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-border">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground m-0 truncate">{req.display_name}</p>
                    <p className="text-xs text-muted-foreground m-0 truncate">{req.email}</p>
                    <p className="text-xs text-muted-foreground m-0">
                      {new Date(req.created_at).toLocaleDateString('ja-JP')} 申請
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                      disabled={processingRequestId === req.id}
                      onClick={() => handleJoinRequest(req.id, 'approve')}
                    >
                      <CheckCircle2 size={14} />
                      承認
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                      disabled={processingRequestId === req.id}
                      onClick={() => handleJoinRequest(req.id, 'reject')}
                    >
                      <XCircle size={14} />
                      拒否
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== アカウント一覧 ===== */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-0">
          {fetchError ? (
            <div className="text-center p-10">
              <p className="text-red-600 text-sm mb-3">{fetchError}</p>
              <Button variant="outline" size="sm" onClick={() => fetchData()}>再読み込み</Button>
            </div>
          ) : members.length === 0 ? (
            <p className="text-muted-foreground text-center p-10">アカウントが登録されていません</p>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">名前</th>
                  <th className="px-4 py-3 font-medium">メール</th>
                  <th className="px-4 py-3 font-medium">区分</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">名刺</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">管理者</th>
                  {/* 「ステータス」「有効」は幅が詰まると1文字ずつ折り返してしまう */}
                  <th className="px-4 py-3 font-medium whitespace-nowrap">ステータス</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">登録日</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">操作</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const cardEnabled = member.profile?.card_enabled ?? false
                  const profileId = member.profile?.id
                  const isAdminMember = adminAuthIds.includes(member.auth_id)
                  return (
                    <tr key={member.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="size-9 shrink-0">
                            {member.profile?.photo_url && <AvatarImage src={member.profile.photo_url} alt={member.display_name} />}
                            <AvatarFallback className="text-xs">{member.display_name.slice(0, 1)}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-bold text-foreground whitespace-nowrap">{member.display_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-foreground">{member.email}</span>
                      </td>
                      <td className="px-4 py-3">
                        {profileId ? (
                          <select
                            value={member.profile?.role_category ?? 'staff'}
                            onChange={(e) => updateRoleCategory(profileId, e.target.value)}
                            className="h-8 rounded-md border border-input bg-white px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            {MEMBER_ROLE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
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
                        {/* 管理画面に入れるかどうか。区分（経営層/管理職/従業員）とは別軸で、
                            区分は「ポータルで何が見えるか」、こちらは「管理画面に入れるか」 */}
                        <button
                          onClick={() => toggleAdmin(member.auth_id, isAdminMember)}
                          disabled={togglingAdminId === member.auth_id}
                          className={`py-1 px-3 rounded-xl border-none text-xs font-bold cursor-pointer ${isAdminMember ? 'bg-green-50 text-green-600' : 'bg-muted text-muted-foreground'} ${togglingAdminId === member.auth_id ? 'opacity-50 cursor-default' : ''}`}
                        >
                          {isAdminMember ? <><Check size={14} className="inline" /> ON</> : 'OFF'}
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-block py-0.5 px-2 rounded text-xs font-bold whitespace-nowrap ${member.is_active ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
