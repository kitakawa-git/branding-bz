'use client'

// バリュー評価シート管理 一覧ページ（理解度テスト一覧をミラー）
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAuth } from '../../components/AdminDataProvider'
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
} from '@/components/ui/alert-dialog'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { Plus, ListChecks, CalendarDays, Trash2, Loader2 } from 'lucide-react'
import { Fab, FabButton } from '@/components/ui/fab'

type Sheet = {
  id: string
  title: string
  status: string
  version: number
  created_at: string
  updated_at: string
  criteria_count?: number
}

type ListCache = {
  sheets: Sheet[]
}

// ステータスバッジ（理解度テストと統一）
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: '下書き', className: 'bg-gray-100 text-gray-700' },
  active: { label: '運用中', className: 'bg-green-100 text-green-700' },
  archived: { label: 'アーカイブ', className: 'bg-gray-100 text-gray-500' },
}

export default function EvaluationsListPage() {
  const { companyId } = useAuth()
  const router = useRouter()
  const cacheKey = `admin-evaluations-${companyId}`
  const cached = companyId ? getPageCache<ListCache>(cacheKey) : null
  const [sheets, setSheets] = useState<Sheet[]>(cached?.sheets ?? [])
  const [loading, setLoading] = useState(!cached)
  const [creating, setCreating] = useState(false)
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // 一覧取得（company_id はセッションから解決＝クエリに渡さない）
  const fetchSheets = async () => {
    try {
      const res = await fetch('/api/brand-score/evaluation-sheets')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const list: Sheet[] = data.sheets || []
      setSheets(list)
      setPageCache(cacheKey, { sheets: list })
    } catch (err) {
      console.error('[Evaluations] データ取得エラー:', err)
      toast.error('評価シート一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!companyId) return
    if (getPageCache<ListCache>(cacheKey)) return
    fetchSheets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, cacheKey])

  // 新規作成（POST → 詳細へ遷移。バリューから評価項目が初期生成される）
  const handleCreate = async () => {
    if (!companyId || creating) return
    setCreating(true)
    try {
      const res = await fetch('/api/brand-score/evaluation-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      const count = data.criteria_count ?? 0
      toast.success(
        count > 0
          ? `評価シートを作成しました（バリュー${count}件から評価項目を生成）`
          : '評価シートを作成しました'
      )
      setPageCache(cacheKey, null as unknown as ListCache)
      router.push(`/admin/brand-score/evaluations/${data.sheet.id}`)
    } catch (err) {
      console.error('[Evaluations] 作成エラー:', err)
      toast.error('評価シートの作成に失敗しました')
    } finally {
      setCreating(false)
    }
  }

  // 削除
  const handleDelete = async () => {
    if (!deleteDialogId || deleting) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/brand-score/evaluation-sheets/${deleteDialogId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      toast.success('評価シートを削除しました')
      setDeleteDialogId(null)
      setPageCache(cacheKey, null as unknown as ListCache)
      await fetchSheets()
    } catch (err) {
      console.error('[Evaluations] 削除エラー:', err)
      toast.error('評価シートの削除に失敗しました')
    } finally {
      setDeleting(false)
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
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-[hsl(0_0%_97%)] border shadow-none">
              <CardContent className="p-5">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* 新規作成 FAB */}
      <Fab>
        <FabButton
          onClick={handleCreate}
          disabled={creating}
          icon={creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
        >
          {creating ? '作成中...' : '評価シートを作成'}
        </FabButton>
      </Fab>

      {/* 削除確認 */}
      <AlertDialog
        open={!!deleteDialogId}
        onOpenChange={(open) => {
          if (!open) setDeleteDialogId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>この評価シートを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              評価項目もすべて削除されます。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? '削除中...' : '削除する'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {sheets.length === 0 ? (
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-10 text-center">
            <ListChecks size={40} className="mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm mb-1">まだ評価シートがありません</p>
            <p className="text-muted-foreground/60 text-xs">
              「評価シートを作成」ボタンから、自社のバリューを評価軸に変換したシートを作成しましょう
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sheets.map((sheet) => {
            const statusConfig = STATUS_CONFIG[sheet.status] || STATUS_CONFIG.draft
            return (
              <Card
                key={sheet.id}
                className="bg-[hsl(0_0%_97%)] border shadow-none cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => router.push(`/admin/brand-score/evaluations/${sheet.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-sm font-semibold text-foreground flex-1">{sheet.title}</h3>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] px-1.5 py-0 ${statusConfig.className}`}
                    >
                      {statusConfig.label}
                    </Badge>
                    {sheet.status !== 'active' && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteDialogId(sheet.id)
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <ListChecks size={12} />
                      評価項目 {sheet.criteria_count ?? 0}件
                    </span>
                    <span className="flex items-center gap-1" suppressHydrationWarning>
                      <CalendarDays size={12} />
                      更新 {formatDate(sheet.updated_at)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
