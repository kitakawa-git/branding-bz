'use client'

// カード4: ビジュアルガイドライン（説明文・表示順・参考画像の並べ替え／追加）
import { useRef } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
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
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import { Plus, Trash2 } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { type GuidelineImage, SortableGuidelineItem } from './sortable'

export function GuidelineCard({
  visualGuidelines,
  images,
  sort,
  sensors,
  uploadingMap,
  onGuidelinesChange,
  onSortChange,
  onDragEnd,
  onCaptionChange,
  onRemove,
  onUpload,
}: {
  visualGuidelines: string
  images: GuidelineImage[]
  sort: 'registered' | 'custom'
  sensors: ReturnType<typeof useSensors>
  uploadingMap: Record<string, boolean>
  onGuidelinesChange: (value: string) => void
  onSortChange: (sort: 'registered' | 'custom') => void
  onDragEnd: (event: DragEndEvent) => void
  onCaptionChange: (index: number, caption: string) => void
  onRemove: (index: number) => void
  onUpload: (file: File) => Promise<void>
}) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  return (
    <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
      <CardContent className="p-5">
        <h2 className="text-xs font-bold mb-3">ビジュアルガイドライン</h2>
        <AutoResizeTextarea
          value={visualGuidelines}
          onChange={(e) => onGuidelinesChange(e.target.value)}
          placeholder="写真のトーン、イラストのスタイルなど"
          className="min-h-[100px] mb-4"
        />

        {/* 表示順設定 */}
        {images.length > 0 && (
          <div className="flex items-center gap-3 mb-3">
            <p className="text-xs text-muted-foreground m-0">表示順:</p>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => onSortChange('registered')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${sort === 'registered' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
              >
                登録順
              </button>
              <button
                type="button"
                onClick={() => onSortChange('custom')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${sort === 'custom' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
              >
                カスタム
              </button>
            </div>
          </div>
        )}

        {/* 参考画像 */}
        {images.length > 0 && sort === 'custom' && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={images.map((_, i) => `guideline-${i}`)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 mb-3">
                {images.map((img, idx) => (
                  <SortableGuidelineItem
                    key={`guideline-${idx}`}
                    id={`guideline-${idx}`}
                    img={img}
                    index={idx}
                    onCaptionChange={onCaptionChange}
                    onRemove={onRemove}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
        {images.length > 0 && sort === 'registered' && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 mb-3">
            {[...images].sort((a, b) => a.added_index - b.added_index).map((img, idx) => {
              const realIdx = images.indexOf(img)
              return (
                <div key={idx} className="border border-border rounded-lg overflow-hidden bg-gray-50 relative">
                  <div className="p-2 flex items-center justify-center min-h-[100px] bg-gray-100">
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
                          <AlertDialogAction onClick={() => onRemove(realIdx)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">削除する</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <img
                      src={img.url}
                      alt={img.caption || ''}
                      className="max-w-full max-h-[100px] object-contain"
                    />
                  </div>
                  <div className="p-2">
                    <Input
                      type="text"
                      value={img.caption}
                      onChange={(e) => onCaptionChange(realIdx, e.target.value)}
                      placeholder="キャプション"
                      className="text-xs py-1.5 px-2"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {images.length < 10 && (
          <div>
            <input
              ref={(el) => { fileInputRefs.current['guideline'] = el }}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              multiple
              className="hidden"
              onChange={async (e) => {
                const input = e.target
                const remaining = 10 - images.length
                const all = Array.from(input.files ?? [])
                const files = all.slice(0, remaining)
                if (all.length > files.length) toast.error(`参考画像は最大10枚までです（${files.length}枚のみ追加します）`)
                for (const file of files) { await onUpload(file) }
                input.value = ''
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={uploadingMap['guideline']}
              onClick={() => fileInputRefs.current['guideline']?.click()}
              className="py-2 px-4 text-[13px]"
            >
              {uploadingMap['guideline'] ? 'アップロード中...' : <><Plus size={16} />参考画像を追加</>}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
