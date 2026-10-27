'use client'

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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GripVertical, Trash2 } from 'lucide-react'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export type LogoItem = { url: string; caption: string; added_index: number }

export type GuidelineImage = { url: string; caption: string; added_index: number }

export type LogoBaseImage = { url: string; caption: string }

// 画像登録カード（サムネイル＋削除確認＋キャプション）共通コンポーネント
// ロゴ基本形・ロゴガイドライン・ビジュアルガイドラインで共用。
// dragHandle を渡すと並べ替え用グリップを左上に表示（並べ替え不要な箇所は省略）。
export function CaptionedImageCard({
  url,
  caption,
  onCaptionChange,
  onRemove,
  innerRef,
  style,
  dragHandle,
}: {
  url: string
  caption: string
  onCaptionChange: (caption: string) => void
  onRemove: () => void
  innerRef?: (node: HTMLElement | null) => void
  style?: React.CSSProperties
  dragHandle?: React.ReactNode
}) {
  return (
    <div ref={innerRef} style={style} className="border border-border rounded-lg overflow-hidden bg-gray-50 relative">
      <div className="p-2 flex items-center justify-center min-h-[100px] bg-gray-100">
        {dragHandle}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute top-1 right-1 size-7 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive bg-background/80 z-10"
            >
              <Trash2 size={12} />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>画像を削除しますか？</AlertDialogTitle>
              <AlertDialogDescription>この画像を削除します。この操作は保存後に確定されます。</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={onRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">削除する</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <img src={url} alt={caption || ''} className="max-w-full max-h-[100px] object-contain" />
      </div>
      <div className="p-2">
        <Input
          type="text"
          value={caption}
          onChange={(e) => onCaptionChange(e.target.value)}
          placeholder="キャプション"
          className="text-xs py-1.5 px-2"
        />
      </div>
    </div>
  )
}

// 並べ替え用グリップ（共通）。attributes/listeners は dnd-kit useSortable の戻り値をそのまま渡す
export function DragHandle({ attributes, listeners }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attributes: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listeners: any
}) {
  return (
    <button
      type="button"
      className="absolute top-1 left-1 p-1 rounded hover:bg-gray-200 cursor-grab active:cursor-grabbing text-muted-foreground z-10"
      {...attributes}
      {...listeners}
    >
      <GripVertical size={16} />
    </button>
  )
}

export function SortableGuidelineItem({
  id,
  img,
  index,
  onCaptionChange,
  onRemove,
}: {
  id: string
  img: GuidelineImage
  index: number
  onCaptionChange: (index: number, caption: string) => void
  onRemove: (index: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <CaptionedImageCard
      innerRef={setNodeRef}
      style={style}
      url={img.url}
      caption={img.caption}
      onCaptionChange={(c) => onCaptionChange(index, c)}
      onRemove={() => onRemove(index)}
      dragHandle={<DragHandle attributes={attributes} listeners={listeners} />}
    />
  )
}

export function SortableLogoItem({
  id,
  item,
  sIdx,
  iIdx,
  onCaptionChange,
  onRemove,
}: {
  id: string
  item: LogoItem
  sIdx: number
  iIdx: number
  onCaptionChange: (sIdx: number, iIdx: number, caption: string) => void
  onRemove: (sIdx: number, iIdx: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <CaptionedImageCard
      innerRef={setNodeRef}
      style={style}
      url={item.url}
      caption={item.caption}
      onCaptionChange={(c) => onCaptionChange(sIdx, iIdx, c)}
      onRemove={() => onRemove(sIdx, iIdx)}
      dragHandle={<DragHandle attributes={attributes} listeners={listeners} />}
    />
  )
}

export function SortableLogoBaseItem({
  id,
  img,
  index,
  onCaptionChange,
  onRemove,
}: {
  id: string
  img: LogoBaseImage
  index: number
  onCaptionChange: (index: number, caption: string) => void
  onRemove: (index: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style} className="w-[180px]">
      <CaptionedImageCard
        url={img.url}
        caption={img.caption}
        onCaptionChange={(c) => onCaptionChange(index, c)}
        onRemove={() => onRemove(index)}
        dragHandle={<DragHandle attributes={attributes} listeners={listeners} />}
      />
    </div>
  )
}

// ロゴガイドラインのセクション自体を並べ替えるためのラッパー。
// setNodeRef を外枠に、ドラッグハンドル用の attributes/listeners を children に渡す。
export function SortableSection({
  id,
  children,
}: {
  id: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  children: (handle: { attributes: any; listeners: any }) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners })}
    </div>
  )
}
