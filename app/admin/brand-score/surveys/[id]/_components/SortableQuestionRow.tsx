'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Trash2,
  GripVertical,
} from 'lucide-react'

export type Question = {
  id: string
  survey_id: string
  category: string
  question_text: string
  source: string
  sort_order: number
  is_active: boolean
  reference_data: Record<string, unknown>
  created_at: string
}

// sourceバッジ定義
export const SOURCE_CONFIG: Record<string, { label: string; className: string }> = {
  template: { label: 'テンプレート', className: 'bg-gray-100 text-gray-600' },
  ai_generated: { label: 'AI生成', className: 'bg-purple-100 text-purple-700' },
  custom: { label: 'カスタム', className: 'bg-blue-100 text-ds-app-accent-hover' },
}

// カテゴリ表示名
export const CATEGORY_LABELS: Record<string, string> = {
  why: '理念浸透（WHY）',
  how: '方針共感（HOW）',
  what: '行動体現（WHAT）',
}

// ── ソート可能な設問行コンポーネント ──
export function SortableQuestionRow({
  q,
  isDraft,
  onCategoryChange,
  onDelete,
}: {
  q: Question
  isDraft: boolean
  onCategoryChange: (id: string, category: string) => void
  onDelete: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  const sourceConfig = SOURCE_CONFIG[q.source] || SOURCE_CONFIG.template

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2 px-4 py-3 border-b last:border-b-0">
      {/* ドラッグハンドル（draft時のみ） */}
      {isDraft ? (
        <button {...attributes} {...listeners} className="shrink-0 mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none">
          <GripVertical size={14} />
        </button>
      ) : (
        <span className="text-xs text-muted-foreground font-mono mt-0.5 w-5 shrink-0 text-right">
          {q.sort_order}
        </span>
      )}

      {/* 設問テキスト + メタ情報 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-relaxed">
          {q.question_text}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Badge
            variant="secondary"
            className={`text-[10px] px-1.5 py-0 ${sourceConfig.className}`}
          >
            {sourceConfig.label}
          </Badge>
          {/* カテゴリSelect（draft時のみ） */}
          {isDraft ? (
            <Select value={q.category} onValueChange={v => onCategoryChange(q.id, v)}>
              <SelectTrigger className="h-5 w-auto text-[10px] px-1.5 py-0 border-0 bg-transparent hover:bg-muted/50 gap-0.5 [&>svg]:h-3 [&>svg]:w-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="why">WHY（理念浸透）</SelectItem>
                <SelectItem value="how">HOW（方針共感）</SelectItem>
                <SelectItem value="what">WHAT（行動体現）</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <span className="text-[10px] text-muted-foreground">
              {CATEGORY_LABELS[q.category] || q.category}
            </span>
          )}
          {q.source === 'ai_generated' && q.reference_data?.field != null && (
            <span className="text-[10px] text-muted-foreground">
              参照: {String(q.reference_data.field)}
            </span>
          )}
        </div>
      </div>

      {/* 削除ボタン（draft時のみ） */}
      {isDraft && (
        <Button
          variant="outline"
          size="icon"
          className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onDelete(q.id)}
        >
          <Trash2 size={14} />
        </Button>
      )}
    </div>
  )
}
