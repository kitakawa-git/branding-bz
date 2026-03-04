'use client'

// キーワード選択コンポーネント（チップUI + ドラッグ並び替え）
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Check, GripVertical, X } from 'lucide-react'
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
import {
  BRAND_KEYWORDS,
  KEYWORD_CATEGORY_LABELS,
  type KeywordCategory,
  type KeywordSelection,
} from '@/lib/types/color-tool'

interface KeywordSelectorProps {
  value: KeywordSelection[]
  onChange: (keywords: KeywordSelection[]) => void
}

function SortableKeywordItem({
  keyword,
  priority,
  onRemove,
}: {
  keyword: string
  priority: number
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: keyword,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2"
    >
      <button {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600">
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
        {priority}
      </span>
      <span className="flex-1 text-sm text-gray-700">{keyword}</span>
      <button onClick={onRemove} className="text-gray-400 hover:text-red-500">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function KeywordSelector({ value, onChange }: KeywordSelectorProps) {
  const [freeText, setFreeText] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const selectedWords = value.map(k => k.word)
  const canAdd = value.length < 5

  const toggleKeyword = (word: string) => {
    if (selectedWords.includes(word)) {
      // 削除
      const filtered = value.filter(k => k.word !== word)
      onChange(filtered.map((k, i) => ({ ...k, priority: i + 1 })))
    } else if (canAdd) {
      // 追加
      onChange([...value, { word, priority: value.length + 1 }])
    }
  }

  const removeKeyword = (word: string) => {
    const filtered = value.filter(k => k.word !== word)
    onChange(filtered.map((k, i) => ({ ...k, priority: i + 1 })))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = value.findIndex(k => k.word === active.id)
    const newIndex = value.findIndex(k => k.word === over.id)
    const reordered = arrayMove(value, oldIndex, newIndex)
    onChange(reordered.map((k, i) => ({ ...k, priority: i + 1 })))
  }

  const addFreeText = () => {
    const word = freeText.trim()
    if (!word || selectedWords.includes(word) || !canAdd) return
    onChange([...value, { word, priority: value.length + 1 }])
    setFreeText('')
  }

  return (
    <div className="space-y-6">
      {/* キーワードチップ */}
      <div className="space-y-4">
        {(Object.keys(BRAND_KEYWORDS) as KeywordCategory[]).map((category) => (
          <div key={category}>
            <h4 className="mb-2 text-xs font-bold text-gray-500">
              {KEYWORD_CATEGORY_LABELS[category]}
            </h4>
            <div className="flex flex-wrap gap-2">
              {BRAND_KEYWORDS[category].map((word) => {
                const isSelected = selectedWords.includes(word)
                return (
                  <button
                    key={word}
                    onClick={() => toggleKeyword(word)}
                    disabled={!isSelected && !canAdd}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : canAdd
                          ? 'border border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                          : 'cursor-not-allowed border border-gray-100 bg-gray-50 text-gray-300'
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                    {word}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 自由入力 */}
      <div>
        <h4 className="mb-2 text-xs font-bold text-gray-500">自由入力（任意）</h4>
        <div className="flex gap-2">
          <Input
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFreeText())}
            placeholder="独自のキーワードを入力"
            className="h-8 text-sm"
            disabled={!canAdd}
          />
          <button
            onClick={addFreeText}
            disabled={!freeText.trim() || !canAdd}
            className="whitespace-nowrap rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-40"
          >
            追加
          </button>
        </div>
      </div>

      {/* 選択済みキーワード（優先順位ドラッグ） */}
      {value.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-bold text-gray-500">
            選択済み（ドラッグで優先順位を変更）
            <span className="ml-1 font-normal text-gray-400">
              {value.length}/5
            </span>
          </h4>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={value.map(k => k.word)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5">
                {value.map((kw) => (
                  <SortableKeywordItem
                    key={kw.word}
                    keyword={kw.word}
                    priority={kw.priority}
                    onRemove={() => removeKeyword(kw.word)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  )
}
