'use client'

// 事業内容 編集UI 共通コンポーネント
// philosophy_elements の service 行（{id,title,description,added_index}）を編集する自己完結UI。
// 登録順/カスタムのトグル・ドラッグ並べ替え対応。基本情報ページ（app/admin/company）で使用。
// 見た目・挙動は旧「ブランド方針」ページの事業内容セクションと同一。
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import { TitleDescriptionList } from '@/components/shared/TitleDescriptionList'
import { GripVertical, Trash2 } from 'lucide-react'
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

// id は philosophy_elements の行ID（新規追加項目では undefined → 保存時INSERT）
export type BusinessContentItem = { id?: string; title: string; description: string; added_index: number }

function SortableBusinessItem({
  id, item, index, onUpdate, onRemove,
}: {
  id: string; item: BusinessContentItem; index: number
  onUpdate: (index: number, field: 'title' | 'description', value: string) => void
  onRemove: (index: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style} className="border border-border rounded-xl p-3 mb-2 bg-background">
      <div className="flex gap-2 mb-2 items-center">
        <button type="button" className="p-1 rounded hover:bg-gray-200 cursor-grab active:cursor-grabbing text-muted-foreground shrink-0" {...attributes} {...listeners}>
          <GripVertical size={16} />
        </button>
        <Input type="text" value={item.title} onChange={(e) => onUpdate(index, 'title', e.target.value)} placeholder="事業タイトル" className="h-10 flex-1" />
        <Button type="button" variant="outline" size="icon" onClick={() => onRemove(index)} className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"><Trash2 size={14} /></Button>
      </div>
      <AutoResizeTextarea
        value={item.description}
        onChange={(e) => onUpdate(index, 'description', e.target.value)}
        placeholder="事業の説明"
        className="min-h-[60px]"
      />
    </div>
  )
}

export function BusinessContentEditor({
  items,
  sort,
  onSortChange,
  onItemsChange,
}: {
  items: BusinessContentItem[]
  sort: 'registered' | 'custom'
  onSortChange: (s: 'registered' | 'custom') => void
  onItemsChange: (items: BusinessContentItem[]) => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const updateBusiness = (index: number, field: 'title' | 'description', value: string) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    onItemsChange(updated)
  }
  const removeBusiness = (index: number) => {
    onItemsChange(items.filter((_, i) => i !== index))
  }
  const handleBusinessDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((_, i) => `business-${i}` === active.id)
    const newIndex = items.findIndex((_, i) => `business-${i}` === over.id)
    if (oldIndex !== -1 && newIndex !== -1) {
      onItemsChange(arrayMove(items, oldIndex, newIndex))
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold">事業内容</h2>
        {items.length > 1 && (
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button type="button" onClick={() => onSortChange('registered')}
              className={`px-3 py-1 text-xs font-medium transition-colors ${sort === 'registered' ? 'bg-foreground text-background' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
              登録順
            </button>
            <button type="button" onClick={() => onSortChange('custom')}
              className={`px-3 py-1 text-xs font-medium transition-colors ${sort === 'custom' ? 'bg-foreground text-background' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
              カスタム
            </button>
          </div>
        )}
      </div>
      {sort === 'custom' ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleBusinessDragEnd}>
          <SortableContext items={items.map((_, i) => `business-${i}`)} strategy={verticalListSortingStrategy}>
            {items.map((item, index) => (
              <SortableBusinessItem key={`business-${index}`} id={`business-${index}`} item={item} index={index} onUpdate={updateBusiness} onRemove={removeBusiness} />
            ))}
          </SortableContext>
        </DndContext>
      ) : (
        <TitleDescriptionList
          label=""
          items={[...items]
            .sort((a, b) => (a.added_index ?? 0) - (b.added_index ?? 0))
            .map(item => ({ title: item.title, description: item.description }))}
          onChange={(newItems) => {
            // added_index を保持してマージ
            const sorted = [...items].sort((a, b) => (a.added_index ?? 0) - (b.added_index ?? 0))
            const maxIndex = sorted.reduce((max, b) => Math.max(max, b.added_index ?? 0), -1)
            const result: BusinessContentItem[] = newItems.map((item, i) => ({
              title: item.title,
              description: item.description,
              added_index: i < sorted.length ? sorted[i].added_index : maxIndex + 1 + (i - sorted.length),
            }))
            onItemsChange(result)
          }}
          addButtonLabel="事業内容を追加"
          titlePlaceholder="事業タイトル"
          descriptionPlaceholder="事業の説明"
          required={false}
        />
      )}
    </div>
  )
}
