'use client'

// ラーニング管理: 動画（カテゴリー>テーマでグルーピング・登録/編集/削除/公開切替/並び替え）＋ カテゴリー・テーマ管理
import { useEffect, useState, useCallback, useMemo } from 'react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { Plus, Pencil, Trash2, GripVertical, Youtube, FolderOpen, Layers } from 'lucide-react'
import type { LearningVideo, LearningCategory, LearningTheme } from '@/lib/types/learning'
import { LearningVideoDialog } from './LearningVideoDialog'
import { LearningStructureManager } from './LearningStructureManager'
import { useAuth } from '../components/AdminDataProvider'
import { isFeatureEnabled } from '@/lib/constants/feature-toggles'
import { PlanUpsell } from '@/components/billing/plan-gate'
import { can } from '@/lib/billing/entitlements'

type ThemeWithVideos = Pick<LearningTheme, 'id' | 'category_id' | 'name' | 'description' | 'sort_order'> & {
  video_count: number
  videos: LearningVideo[]
}
type CategoryWithThemes = Pick<LearningCategory, 'id' | 'name' | 'sort_order'> & {
  direct_videos: LearningVideo[]
  themes: ThemeWithVideos[]
}
type Structure = { categories: CategoryWithThemes[]; uncategorized: LearningVideo[] }

function formatDuration(sec: number | null): string | null {
  if (!sec || sec <= 0) return null
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function SortableVideoRow({
  video,
  busy,
  onTogglePublish,
  onEdit,
  onDelete,
}: {
  video: LearningVideo
  busy: boolean
  onTogglePublish: (v: LearningVideo, next: boolean) => void
  onEdit: (v: LearningVideo) => void
  onDelete: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: video.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const duration = formatDuration(video.duration_seconds)

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0">
      <button {...attributes} {...listeners} className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none" aria-label="並び替え">
        <GripVertical size={16} />
      </button>
      <div className="relative shrink-0 w-24 aspect-video rounded-md overflow-hidden bg-muted">
        {video.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground"><Youtube size={18} /></div>
        )}
        {duration && (
          <span className="absolute bottom-0.5 right-0.5 rounded bg-black/75 px-1 text-[10px] font-medium text-white">{duration}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate m-0">{video.title}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Switch checked={video.is_published} onCheckedChange={(next) => onTogglePublish(video, next)} disabled={busy} aria-label="公開切替" />
        <span className={`text-[10px] w-8 ${video.is_published ? 'text-green-600' : 'text-muted-foreground'}`}>{video.is_published ? '公開' : '非公開'}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="size-8" onClick={() => onEdit(video)}><Pencil size={14} /></Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" disabled={busy}><Trash2 size={14} /></Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>動画を削除しますか？</AlertDialogTitle>
              <AlertDialogDescription>この操作は取り消せません。「{video.title}」と、その視聴記録をすべて削除します。</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(video.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">削除する</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

function VideoGroup({
  videos,
  busyId,
  onReorder,
  onTogglePublish,
  onEdit,
  onDelete,
}: {
  videos: LearningVideo[]
  busyId: string | null
  onReorder: (videos: LearningVideo[], activeId: string, overId: string) => void
  onTogglePublish: (v: LearningVideo, next: boolean) => void
  onEdit: (v: LearningVideo) => void
  onDelete: (id: string) => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  if (videos.length === 0) {
    return <p className="px-4 py-3 text-xs text-muted-foreground">この中に動画はありません</p>
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={(e: DragEndEvent) => {
        const { active, over } = e
        if (over && active.id !== over.id) onReorder(videos, String(active.id), String(over.id))
      }}
    >
      <SortableContext items={videos.map((v) => v.id)} strategy={verticalListSortingStrategy}>
        {videos.map((v) => (
          <SortableVideoRow key={v.id} video={v} busy={busyId === v.id} onTogglePublish={onTogglePublish} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </SortableContext>
    </DndContext>
  )
}

export default function AdminLearningPage() {
  const { company } = useAuth()
  const learningEnabled = isFeatureEnabled(company, 'learning_enabled')
  const [structure, setStructure] = useState<Structure | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<LearningVideo | null>(null)

  const fetchStructure = useCallback(async () => {
    // プラン外の会社では API が 403（plan_required）を返す。取りに行けば必ず失敗し、
    // アップセル面の上に「取得に失敗しました」という無関係なエラーが重なる
    if (!company || !can(company, 'videoLearning')) {
      setLoading(false)
      return
    }
    try {
      const res = await fetch('/api/learning/structure')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setStructure({ categories: data.categories || [], uncategorized: data.uncategorized || [] })
    } catch (err) {
      console.error('[AdminLearning] 取得エラー:', err)
      toast.error('ラーニング構成の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [company])

  useEffect(() => { fetchStructure() }, [fetchStructure])

  const categoriesTree = useMemo(
    () =>
      (structure?.categories ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        themes: c.themes.map((t) => ({ id: t.id, name: t.name, category_id: t.category_id })),
      })),
    [structure]
  )

  const totalVideos = useMemo(() => {
    if (!structure) return 0
    const inThemes = structure.categories.reduce(
      (s, c) => s + c.themes.reduce((ss, t) => ss + t.videos.length, 0) + c.direct_videos.length,
      0
    )
    return inThemes + structure.uncategorized.length
  }, [structure])

  const handleTogglePublish = async (video: LearningVideo, next: boolean) => {
    setBusyId(video.id)
    try {
      const res = await fetch(`/api/learning/videos/${video.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_published: next }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success(next ? '公開しました' : '非公開にしました')
      await fetchStructure()
    } catch (err) {
      console.error('[AdminLearning] 公開切替エラー:', err)
      toast.error('公開状態の変更に失敗しました')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (id: string) => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/learning/videos/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success('動画を削除しました')
      await fetchStructure()
    } catch (err) {
      console.error('[AdminLearning] 削除エラー:', err)
      toast.error('削除に失敗しました')
    } finally {
      setBusyId(null)
    }
  }

  const handleReorder = async (groupVideos: LearningVideo[], activeId: string, overId: string) => {
    const oldIndex = groupVideos.findIndex((v) => v.id === activeId)
    const newIndex = groupVideos.findIndex((v) => v.id === overId)
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove(groupVideos, oldIndex, newIndex).map((v, i) => ({ id: v.id, sort_order: i + 1 }))
    try {
      const res = await fetch('/api/learning/videos/reorder', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reordered),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await fetchStructure()
    } catch (err) {
      console.error('[AdminLearning] 並び替えエラー:', err)
      toast.error('並び替えの保存に失敗しました')
      fetchStructure()
    }
  }

  const openCreate = () => { setEditing(null); setDialogOpen(true) }
  const openEdit = (v: LearningVideo) => { setEditing(v); setDialogOpen(true) }

  // 機能トグル: 無効なら案内のみ表示（フックより後に置くこと）
  // プラン外: 隠さずアップセル面を出す（実効プランで判定＝期限切れならロック）
  if (!can(company, 'videoLearning')) {
    return (
      <div>
        <PlanUpsell
          company={company}
          feature="videoLearning"
          title="ビデオラーニングを使うには"
          benefits={[
            'カテゴリ・テーマで動画を体系立てて配信',
            'メンバーごとの視聴状況と完了率を把握',
            'ポータルから各自が視聴',
            '理解度テストと組み合わせて浸透を設計',
          ]}
        />
      </div>
    )
  }

  if (!learningEnabled) {
    return (
      <div className="max-w-4xl mx-auto px-5 pt-4 pb-10">
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground text-[15px] m-0">
              この機能は現在ご利用いただけません
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <Tabs defaultValue="videos">
        <TabsList className="mb-4">
          <TabsTrigger value="videos">動画</TabsTrigger>
          <TabsTrigger value="structure">カテゴリー・テーマ</TabsTrigger>
        </TabsList>

        <TabsContent value="videos">
          <Fab>
            <FabButton onClick={openCreate} icon={<Plus size={16} />}>動画を登録</FabButton>
          </Fab>

          {loading ? (
            <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
              <CardContent className="p-5 space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-5 w-5" /><Skeleton className="h-14 w-24 rounded-md" /><Skeleton className="h-5 flex-1" /><Skeleton className="h-6 w-16" /><Skeleton className="h-8 w-16" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : totalVideos === 0 && (structure?.categories.length ?? 0) === 0 ? (
            <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
              <CardContent className="p-10 text-center">
                <p className="text-muted-foreground text-sm">動画はまだ登録されていません。右下のボタンから登録できます。カテゴリー・テーマを作ると整理できます。</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {structure!.categories.map((cat) => (
                <div key={cat.id} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <FolderOpen size={16} className="text-foreground" />
                    <h2 className="text-sm font-bold text-foreground m-0">{cat.name}</h2>
                  </div>
                  {cat.themes.length === 0 && cat.direct_videos.length === 0 ? (
                    <p className="text-xs text-muted-foreground pl-6">テーマ・動画がありません（「カテゴリー・テーマ」タブでテーマ追加、または動画の編集でこのカテゴリーに割当）</p>
                  ) : (
                    <>
                      {cat.themes.map((theme) => (
                        <div key={theme.id} className="pl-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Layers size={13} className="text-muted-foreground" />
                            <h3 className="text-xs font-semibold text-foreground m-0">{theme.name}</h3>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{theme.videos.length}本</Badge>
                          </div>
                          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
                            <CardContent className="p-0">
                              <VideoGroup videos={theme.videos} busyId={busyId} onReorder={handleReorder} onTogglePublish={handleTogglePublish} onEdit={openEdit} onDelete={handleDelete} />
                            </CardContent>
                          </Card>
                        </div>
                      ))}
                      {cat.direct_videos.length > 0 && (
                        <div className="pl-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Layers size={13} className="text-muted-foreground/60" />
                            <h3 className="text-xs font-semibold text-muted-foreground m-0">（テーマ未設定）</h3>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{cat.direct_videos.length}本</Badge>
                          </div>
                          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
                            <CardContent className="p-0">
                              <VideoGroup videos={cat.direct_videos} busyId={busyId} onReorder={handleReorder} onTogglePublish={handleTogglePublish} onEdit={openEdit} onDelete={handleDelete} />
                            </CardContent>
                          </Card>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}

              {structure!.uncategorized.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <FolderOpen size={16} className="text-muted-foreground" />
                    <h2 className="text-sm font-bold text-muted-foreground m-0">未分類</h2>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{structure!.uncategorized.length}本</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground pl-6 -mt-1">編集からテーマを割り当ててください</p>
                  <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
                    <CardContent className="p-0">
                      <VideoGroup videos={structure!.uncategorized} busyId={busyId} onReorder={handleReorder} onTogglePublish={handleTogglePublish} onEdit={openEdit} onDelete={handleDelete} />
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="structure">
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <LearningStructureManager categories={structure?.categories ?? []} onChanged={fetchStructure} />
          )}
        </TabsContent>
      </Tabs>

      <LearningVideoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        video={editing}
        categoriesTree={categoriesTree}
        onSaved={fetchStructure}
      />
    </div>
  )
}
