'use client'

// お知らせ管理 一覧ページ
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../components/AuthProvider'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
import { Plus, Pencil, BarChart3, Trash2 } from 'lucide-react'

const CATEGORY_COLORS: Record<string, string> = {
  '重要': 'bg-red-100 text-red-700',
  'イベント': 'bg-blue-100 text-blue-700',
  '更新': 'bg-green-100 text-green-700',
  'その他': 'bg-gray-100 text-gray-700',
}

type Announcement = {
  id: string
  title: string
  category: string
  is_published: boolean
  created_at: string
  read_count: number
}

type ListCache = {
  announcements: Announcement[]
  totalMembers: number
}

export default function AnnouncementsListPage() {
  const { companyId, user } = useAuth()
  const cacheKey = `admin-announcements-${companyId}`
  const cached = companyId ? getPageCache<ListCache>(cacheKey) : null
  const [announcements, setAnnouncements] = useState<Announcement[]>(cached?.announcements ?? [])
  const [totalMembers, setTotalMembers] = useState(cached?.totalMembers ?? 0)
  const [loading, setLoading] = useState(!cached)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchData = async () => {
    if (!companyId) return
    try {
      const [announcementsRes, readsRes, membersRes] = await Promise.all([
        supabase
          .from('announcements')
          .select('id, title, category, is_published, created_at')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false }),
        supabase
          .from('announcement_reads')
          .select('announcement_id')
          .eq('company_id', companyId),
        supabase
          .from('members')
          .select('id')
          .eq('company_id', companyId),
      ])

      const items = announcementsRes.data || []
      const reads = readsRes.data || []
      const memberCount = membersRes.data?.length || 0

      // 各お知らせの既読数を集計
      const readCountMap = new Map<string, number>()
      reads.forEach(r => {
        readCountMap.set(r.announcement_id, (readCountMap.get(r.announcement_id) || 0) + 1)
      })

      const announcementsWithReads = items.map(a => ({
        ...a,
        read_count: readCountMap.get(a.id) || 0,
      }))

      setAnnouncements(announcementsWithReads)
      setTotalMembers(memberCount)
      setPageCache(cacheKey, { announcements: announcementsWithReads, totalMembers: memberCount })
    } catch (err) {
      console.error('[Announcements] データ取得エラー:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!companyId) return
    if (getPageCache<ListCache>(cacheKey)) return
    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, cacheKey])

  const handleDelete = async (id: string) => {
    setDeleting(id)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/announcements?id=eq.${id}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            'Authorization': `Bearer ${token}`,
            'Prefer': 'return=minimal',
          },
        }
      )

      if (!res.ok) {
        const body = await res.text()
        throw new Error(`HTTP ${res.status}: ${body}`)
      }

      setAnnouncements(prev => prev.filter(a => a.id !== id))
      toast.success('お知らせを削除しました')
    } catch (err) {
      console.error('[Announcements] 削除エラー:', err)
      toast.error('削除に失敗しました')
    } finally {
      setDeleting(null)
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-24" />
        </div>
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-5 w-48 flex-1" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">お知らせ管理</h1>
        <Button asChild>
          <Link href="/admin/announcements/new">
            <Plus size={16} />
            新規作成
          </Link>
        </Button>
      </div>

      {announcements.length === 0 ? (
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-10 text-center">
            <p className="text-muted-foreground text-sm">お知らせはまだありません</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">タイトル</th>
                  <th className="px-4 py-3 font-medium w-24">カテゴリ</th>
                  <th className="px-4 py-3 font-medium w-20">状態</th>
                  <th className="px-4 py-3 font-medium w-28">投稿日</th>
                  <th className="px-4 py-3 font-medium w-24">既読率</th>
                  <th className="px-4 py-3 font-medium w-28">操作</th>
                </tr>
              </thead>
              <tbody>
                {announcements.map(a => {
                  const readRate = totalMembers > 0
                    ? Math.round((a.read_count / totalMembers) * 100)
                    : 0
                  return (
                    <tr key={a.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-foreground">{a.title}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${CATEGORY_COLORS[a.category] || CATEGORY_COLORS['その他']}`}>
                          {a.category}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`py-0.5 px-2 rounded text-xs font-bold ${a.is_published ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                          {a.is_published ? '公開' : '下書き'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                          {formatDate(a.created_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">
                          {a.read_count}/{totalMembers} ({readRate}%)
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="size-8" asChild>
                            <Link href={`/admin/announcements/${a.id}`}>
                              <BarChart3 size={14} />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8" asChild>
                            <Link href={`/admin/announcements/${a.id}/edit`}>
                              <Pencil size={14} />
                            </Link>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive hover:text-destructive"
                                disabled={deleting === a.id}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>お知らせを削除しますか？</AlertDialogTitle>
                                <AlertDialogDescription>
                                  この操作は取り消せません。お知らせ「{a.title}」を完全に削除します。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(a.id)}
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
          </CardContent>
        </Card>
      )}
    </div>
  )
}
