'use client'

// ラーニング管理: 動画管理（一覧・登録・編集・削除・公開切替・並び替え）＋ 視聴分析タブ
import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
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
import { Fab, FabButton } from '@/components/ui/fab'
import { Plus, Pencil, Trash2, GripVertical, Youtube } from 'lucide-react'
import type { LearningVideo } from '@/lib/types/learning'
import { LearningVideoDialog } from './LearningVideoDialog'

// 秒数を mm:ss 表記に
function formatDuration(sec: number | null): string | null {
  if (!sec || sec <= 0) return null
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// ── ソート可能な動画行 ──
function SortableVideoRow({
  video,
  onTogglePublish,
  onEdit,
  onDelete,
  busy,
}: {
  video: LearningVideo
  onTogglePublish: (v: LearningVideo, next: boolean) => void
  onEdit: (v: LearningVideo) => void
  onDelete: (id: string) => void
  busy: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: video.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  const duration = formatDuration(video.duration_seconds)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0"
    >
      {/* ドラッグハンドル */}
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        aria-label="並び替え"
      >
        <GripVertical size={16} />
      </button>

      {/* サムネ */}
      <div className="relative shrink-0 w-24 aspect-video rounded-md overflow-hidden bg-muted">
        {video.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Youtube size={18} />
          </div>
        )}
        {duration && (
          <span className="absolute bottom-0.5 right-0.5 rounded bg-black/75 px-1 text-[10px] font-medium text-white">
            {duration}
          </span>
        )}
      </div>

      {/* タイトル + カテゴリ */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate m-0">{video.title}</p>
        {video.category && (
          <Badge variant="secondary" className="mt-1 text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700">
            {video.category}
          </Badge>
        )}
      </div>

      {/* 公開トグル */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Switch
          checked={video.is_published}
          onCheckedChange={(next) => onTogglePublish(video, next)}
          disabled={busy}
          aria-label="公開切替"
        />
        <span className={`text-[10px] w-8 ${video.is_published ? 'text-green-600' : 'text-muted-foreground'}`}>
          {video.is_published ? '公開' : '非公開'}
        </span>
      </div>

      {/* 操作 */}
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="size-8" onClick={() => onEdit(video)}>
          <Pencil size={14} />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-destructive hover:text-destructive"
              disabled={busy}
            >
              <Trash2 size={14} />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>動画を削除しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                この操作は取り消せません。「{video.title}」と、その視聴記録をすべて削除します。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(video.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                削除する
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

export default function AdminLearningPage() {
  const [videos, setVideos] = useState<LearningVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<LearningVideo | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const fetchVideos = useCallback(async () => {
    try {
      const res = await fetch('/api/learning/videos')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setVideos(data.videos || [])
    } catch (err) {
      console.error('[AdminLearning] 取得エラー:', err)
      toast.error('動画一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchVideos()
  }, [fetchVideos])

  const categories = Array.from(
    new Set(videos.map((v) => v.category).filter((c): c is string => !!c))
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = videos.findIndex((v) => v.id === active.id)
    const newIndex = videos.findIndex((v) => v.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const reordered = arrayMove(videos, oldIndex, newIndex).map((v, i) => ({
      ...v,
      sort_order: i + 1,
    }))
    setVideos(reordered) // 楽観的更新

    try {
      const res = await fetch('/api/learning/videos/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reordered.map((v) => ({ id: v.id, sort_order: v.sort_order }))),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (err) {
      console.error('[AdminLearning] 並び替えエラー:', err)
      toast.error('並び替えの保存に失敗しました')
      fetchVideos() // 失敗時はサーバー状態に戻す
    }
  }

  const handleTogglePublish = async (video: LearningVideo, next: boolean) => {
    setBusyId(video.id)
    // 楽観的更新
    setVideos((prev) => prev.map((v) => (v.id === video.id ? { ...v, is_published: next } : v)))
    try {
      const res = await fetch(`/api/learning/videos/${video.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_published: next }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success(next ? '公開しました' : '非公開にしました')
    } catch (err) {
      console.error('[AdminLearning] 公開切替エラー:', err)
      toast.error('公開状態の変更に失敗しました')
      setVideos((prev) => prev.map((v) => (v.id === video.id ? { ...v, is_published: !next } : v)))
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (id: string) => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/learning/videos/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setVideos((prev) => prev.filter((v) => v.id !== id))
      toast.success('動画を削除しました')
    } catch (err) {
      console.error('[AdminLearning] 削除エラー:', err)
      toast.error('削除に失敗しました')
    } finally {
      setBusyId(null)
    }
  }

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }
  const openEdit = (v: LearningVideo) => {
    setEditing(v)
    setDialogOpen(true)
  }

  return (
    <div>
      {/* 新規登録 FAB */}
          <Fab>
            <FabButton onClick={openCreate} icon={<Plus size={16} />}>
              動画を登録
            </FabButton>
          </Fab>

          {loading ? (
            <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
              <CardContent className="p-5 space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-5 w-5" />
                    <Skeleton className="h-14 w-24 rounded-md" />
                    <Skeleton className="h-5 flex-1" />
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : videos.length === 0 ? (
            <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
              <CardContent className="p-10 text-center">
                <p className="text-muted-foreground text-sm">
                  動画はまだ登録されていません。右下のボタンから登録できます。
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
              <CardContent className="p-0">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={videos.map((v) => v.id)} strategy={verticalListSortingStrategy}>
                    {videos.map((v) => (
                      <SortableVideoRow
                        key={v.id}
                        video={v}
                        busy={busyId === v.id}
                        onTogglePublish={handleTogglePublish}
                        onEdit={openEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </CardContent>
            </Card>
          )}

      {/* 作成／編集モーダル */}
      <LearningVideoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        video={editing}
        categories={categories}
        onSaved={fetchVideos}
      />
    </div>
  )
}
