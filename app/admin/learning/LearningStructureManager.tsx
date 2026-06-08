'use client'

// ラーニング カテゴリー・テーマ管理（作成・リネーム・削除・並び替え）
// 親 (page.tsx) が structure を保持。表示は props 由来、変更は API→onChanged() で再取得する
// （ローカルmirror状態を持たないことでリネーム未反映等のズレを防ぐ）
import { useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { GripVertical, Plus, Trash2, Check, X, FolderPlus, Layers } from 'lucide-react'

type ThemeNode = { id: string; name: string; description: string | null; sort_order: number; video_count: number }
type CategoryNode = { id: string; name: string; sort_order: number; themes: ThemeNode[] }

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    throw new Error(d.error || `HTTP ${res.status}`)
  }
  return res.json().catch(() => ({}))
}

// インライン編集できる名前ラベル
function EditableName({
  value,
  onSave,
  className,
}: {
  value: string
  onSave: (v: string) => void
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  if (editing) {
    return (
      <form
        className="flex-1 flex items-center gap-1"
        onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { onSave(draft.trim()); setEditing(false) } }}
      >
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} className="h-7 text-sm bg-background" autoFocus />
        <Button type="submit" variant="ghost" size="icon" className="size-7"><Check size={14} /></Button>
        <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => { setDraft(value); setEditing(false) }}><X size={14} /></Button>
      </form>
    )
  }
  return (
    <button className={`flex-1 min-w-0 text-left truncate hover:underline ${className ?? ''}`} onClick={() => { setDraft(value); setEditing(true) }}>
      {value}
    </button>
  )
}

// ── ソート可能なテーマ行 ──
function SortableThemeRow({ theme, onRename, onDelete }: { theme: ThemeNode; onRename: (id: string, name: string) => void; onDelete: (t: ThemeNode) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: theme.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 px-3 py-2 border-b last:border-b-0 bg-background/60">
      <button {...attributes} {...listeners} className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none" aria-label="並び替え">
        <GripVertical size={14} />
      </button>
      <Layers size={14} className="text-muted-foreground shrink-0" />
      <EditableName value={theme.name} onSave={(n) => onRename(theme.id, n)} className="text-sm font-medium text-foreground" />
      <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">{theme.video_count}本</Badge>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive"><Trash2 size={13} /></Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>テーマを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{theme.name}」を削除します。配下の動画 {theme.video_count} 本は削除されず「未分類」に戻ります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete(theme)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">削除する</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── ソート可能なカテゴリーカード ──
function SortableCategoryCard({ category, onChanged }: { category: CategoryNode; onChanged: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const themeSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const [addingTheme, setAddingTheme] = useState(false)
  const [newTheme, setNewTheme] = useState('')

  const totalVideos = category.themes.reduce((s, t) => s + t.video_count, 0)

  const renameCategory = async (n: string) => {
    try { await api(`/api/learning/categories/${category.id}`, 'PATCH', { name: n }); onChanged() }
    catch (e) { toast.error('リネーム失敗: ' + (e instanceof Error ? e.message : '')) }
  }
  const deleteCategory = async () => {
    try { await api(`/api/learning/categories/${category.id}`, 'DELETE'); toast.success('カテゴリーを削除しました'); onChanged() }
    catch (e) { toast.error('削除失敗: ' + (e instanceof Error ? e.message : '')) }
  }
  const addTheme = async () => {
    if (!newTheme.trim()) return
    try { await api('/api/learning/themes', 'POST', { category_id: category.id, name: newTheme.trim() }); setNewTheme(''); setAddingTheme(false); onChanged() }
    catch (e) { toast.error('テーマ作成失敗: ' + (e instanceof Error ? e.message : '')) }
  }
  const renameTheme = async (id: string, n: string) => {
    try { await api(`/api/learning/themes/${id}`, 'PATCH', { name: n }); onChanged() }
    catch (e) { toast.error('リネーム失敗: ' + (e instanceof Error ? e.message : '')) }
  }
  const deleteTheme = async (t: ThemeNode) => {
    try { await api(`/api/learning/themes/${t.id}`, 'DELETE'); toast.success('テーマを削除しました'); onChanged() }
    catch (e) { toast.error('削除失敗: ' + (e instanceof Error ? e.message : '')) }
  }
  const handleThemeDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = category.themes.findIndex((t) => t.id === active.id)
    const newIndex = category.themes.findIndex((t) => t.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove(category.themes, oldIndex, newIndex).map((t, i) => ({ id: t.id, sort_order: i + 1 }))
    try { await api('/api/learning/themes/reorder', 'PATCH', reordered); onChanged() }
    catch { toast.error('テーマ並び替えの保存に失敗'); onChanged() }
  }

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <button {...attributes} {...listeners} className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none" aria-label="並び替え">
              <GripVertical size={16} />
            </button>
            <EditableName value={category.name} onSave={renameCategory} className="text-sm font-bold text-foreground" />
            <span className="shrink-0 text-[10px] text-muted-foreground">{category.themes.length}テーマ / {totalVideos}本</span>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive"><Trash2 size={14} /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>カテゴリーを削除しますか？</AlertDialogTitle>
                  <AlertDialogDescription>
                    「{category.name}」を削除します。配下の {category.themes.length} テーマも削除され、所属していた動画 {totalVideos} 本は削除されず「未分類」に戻ります。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteCategory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">削除する</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {category.themes.length > 0 && (
            <div className="rounded-md border overflow-hidden mb-2">
              <DndContext sensors={themeSensors} collisionDetection={closestCenter} onDragEnd={handleThemeDragEnd}>
                <SortableContext items={category.themes.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  {category.themes.map((t) => (
                    <SortableThemeRow key={t.id} theme={t} onRename={renameTheme} onDelete={deleteTheme} />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          )}

          {addingTheme ? (
            <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); addTheme() }}>
              <Input value={newTheme} onChange={(e) => setNewTheme(e.target.value)} placeholder="テーマ名（例：基礎編）" className="h-8 text-sm bg-background" autoFocus />
              <Button type="submit" variant="ghost" size="icon" className="size-8"><Check size={15} /></Button>
              <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => { setNewTheme(''); setAddingTheme(false) }}><X size={15} /></Button>
            </form>
          ) : (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground gap-1" onClick={() => setAddingTheme(true)}>
              <Plus size={13} /> テーマを追加
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function LearningStructureManager({ categories, onChanged }: { categories: CategoryNode[]; onChanged: () => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const [newCategory, setNewCategory] = useState('')
  const [adding, setAdding] = useState(false)

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = categories.findIndex((c) => c.id === active.id)
    const newIndex = categories.findIndex((c) => c.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove(categories, oldIndex, newIndex).map((c, i) => ({ id: c.id, sort_order: i + 1 }))
    try { await api('/api/learning/categories/reorder', 'PATCH', reordered); onChanged() }
    catch { toast.error('カテゴリー並び替えの保存に失敗'); onChanged() }
  }

  const addCategory = async () => {
    if (!newCategory.trim()) return
    try { await api('/api/learning/categories', 'POST', { name: newCategory.trim() }); setNewCategory(''); setAdding(false); onChanged() }
    catch (e) { toast.error('カテゴリー作成失敗: ' + (e instanceof Error ? e.message : '')) }
  }

  return (
    <div className="space-y-3">
      {categories.length === 0 && (
        <p className="text-sm text-muted-foreground">カテゴリーがまだありません。下のボタンから追加してください。</p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {categories.map((c) => (
              <SortableCategoryCard key={c.id} category={c} onChanged={onChanged} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {adding ? (
        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); addCategory() }}>
          <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="カテゴリー名（例：ブランディング）" className="bg-background" autoFocus />
          <Button type="submit" size="sm" className="rounded-full gap-1"><Check size={15} /> 追加</Button>
          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => { setNewCategory(''); setAdding(false) }}>キャンセル</Button>
        </form>
      ) : (
        <Button variant="outline" size="sm" className="rounded-full gap-1" onClick={() => setAdding(true)}>
          <FolderPlus size={15} /> カテゴリーを追加
        </Button>
      )}
    </div>
  )
}
