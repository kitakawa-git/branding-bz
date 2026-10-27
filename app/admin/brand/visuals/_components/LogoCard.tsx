'use client'

// カード1: ロゴ基本形＆ロゴコンセプト＆ロゴガイドライン（セクション並べ替え・画像追加）
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
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { type LogoBaseImage, SortableLogoItem, SortableLogoBaseItem, SortableSection } from './sortable'
import { type LogoSection } from './types'

export function LogoCard({
  logoImages,
  logoConcept,
  logoSections,
  sensors,
  uploadingMap,
  onLogoBaseDragEnd,
  onLogoImageCaptionChange,
  onLogoImageRemove,
  onLogoImageUpload,
  onLogoConceptChange,
  onSectionDragEnd,
  onSectionTitleChange,
  onSectionRemove,
  onLogoDragEnd,
  onCaptionChange,
  onImageRemove,
  onImageUpload,
  onAddSection,
}: {
  logoImages: LogoBaseImage[]
  logoConcept: string
  logoSections: LogoSection[]
  sensors: ReturnType<typeof useSensors>
  uploadingMap: Record<string, boolean>
  onLogoBaseDragEnd: (event: DragEndEvent) => void
  onLogoImageCaptionChange: (index: number, caption: string) => void
  onLogoImageRemove: (index: number) => void
  onLogoImageUpload: (file: File) => Promise<void>
  onLogoConceptChange: (value: string) => void
  onSectionDragEnd: (event: DragEndEvent) => void
  onSectionTitleChange: (sIdx: number, title: string) => void
  onSectionRemove: (sIdx: number) => void
  onLogoDragEnd: (sIdx: number) => (event: DragEndEvent) => void
  onCaptionChange: (sIdx: number, iIdx: number, caption: string) => void
  onImageRemove: (sIdx: number, iIdx: number) => void
  onImageUpload: (sIdx: number, file: File) => Promise<void>
  onAddSection: () => void
}) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  return (
    <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
      <CardContent className="p-5">
        {/* ロゴ基本形（複数枚） */}
        <div className="mb-8">
          <h2 className="text-xs font-bold mb-2">ロゴ基本形</h2>
          <p className="text-[11px] text-muted-foreground mb-3">ロゴの基本形となる画像（複数登録可・推奨：背景透過PNG）</p>
          {logoImages.length > 0 && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onLogoBaseDragEnd}>
              <SortableContext items={logoImages.map((_, i) => `logobase-${i}`)} strategy={rectSortingStrategy}>
                <div className="flex flex-wrap gap-3 mb-3">
                  {logoImages.map((img, i) => (
                    <SortableLogoBaseItem
                      key={`logobase-${i}`}
                      id={`logobase-${i}`}
                      img={img}
                      index={i}
                      onCaptionChange={onLogoImageCaptionChange}
                      onRemove={onLogoImageRemove}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
          <input
            ref={(el) => { fileInputRefs.current['logo-base'] = el }}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={async (e) => {
              const input = e.target
              const files = Array.from(input.files ?? [])
              for (const file of files) { await onLogoImageUpload(file) }
              input.value = ''
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={uploadingMap['logo-base']}
            onClick={() => fileInputRefs.current['logo-base']?.click()}
            className="py-2 px-4 text-[13px]"
          >
            {uploadingMap['logo-base'] ? 'アップロード中...' : <><Plus size={16} />画像を追加</>}
          </Button>
        </div>

        {/* ロゴコンセプト */}
        <div className="mb-8">
          <h2 className="text-xs font-bold mb-3">ロゴコンセプト</h2>
          <AutoResizeTextarea
            value={logoConcept}
            onChange={(e) => onLogoConceptChange(e.target.value)}
            placeholder="ロゴに込めた意味やコンセプトを記述"
            className="min-h-[100px]"
          />
        </div>

        {/* ロゴガイドライン */}
        <div>
          <h2 className="text-xs font-bold mb-3">ロゴガイドライン</h2>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSectionDragEnd}>
            <SortableContext items={logoSections.map((_, i) => `section-${i}`)} strategy={verticalListSortingStrategy}>
              {logoSections.map((section, sIdx) => (
                <SortableSection key={sIdx} id={`section-${sIdx}`}>
                  {({ attributes, listeners }) => (
                    <div className="border border-border rounded-xl p-4 mb-3 bg-background">
                      {/* セクションヘッダー */}
                      <div className="flex items-center gap-2 mb-3">
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-gray-200 cursor-grab active:cursor-grabbing text-muted-foreground shrink-0"
                          {...attributes}
                          {...listeners}
                        >
                          <GripVertical size={16} />
                        </button>
                        <Input
                          type="text"
                          value={section.title}
                          onChange={(e) => onSectionTitleChange(sIdx, e.target.value)}
                          placeholder="セクションタイトル（例: ロゴ、余白の指定、禁止事項）"
                          className="h-10 flex-1"
                        />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>セクションを削除しますか？</AlertDialogTitle>
                              <AlertDialogDescription>「{section.title || `セクション ${sIdx + 1}`}」とその画像を全て削除します。</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>キャンセル</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onSectionRemove(sIdx)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">削除する</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>

                      {/* 画像一覧（ドラッグ&ドロップで並べ替え） */}
                      {section.items.length > 0 && (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onLogoDragEnd(sIdx)}>
                          <SortableContext items={section.items.map((_, i) => `logo-${sIdx}-${i}`)} strategy={rectSortingStrategy}>
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 mb-3">
                              {section.items.map((item, iIdx) => (
                                <SortableLogoItem
                                  key={`logo-${sIdx}-${iIdx}`}
                                  id={`logo-${sIdx}-${iIdx}`}
                                  item={item}
                                  sIdx={sIdx}
                                  iIdx={iIdx}
                                  onCaptionChange={onCaptionChange}
                                  onRemove={onImageRemove}
                                />
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>
                      )}

                      {/* 画像追加 */}
                      {section.items.length < 10 && (
                        <div>
                          <input
                            ref={(el) => { fileInputRefs.current[`file-${sIdx}`] = el }}
                            type="file"
                            accept="image/png,image/jpeg,image/svg+xml,image/webp"
                            multiple
                            className="hidden"
                            onChange={async (e) => {
                              const input = e.target
                              const remaining = 10 - section.items.length
                              const all = Array.from(input.files ?? [])
                              const files = all.slice(0, remaining)
                              if (all.length > files.length) toast.error(`このセクションは最大10枚までです（${files.length}枚のみ追加します）`)
                              for (const file of files) { await onImageUpload(sIdx, file) }
                              input.value = ''
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            disabled={uploadingMap[`${sIdx}`]}
                            onClick={() => fileInputRefs.current[`file-${sIdx}`]?.click()}
                            className="py-2 px-4 text-[13px]"
                          >
                            {uploadingMap[`${sIdx}`] ? 'アップロード中...' : <><Plus size={16} />画像を追加</>}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </SortableSection>
              ))}
            </SortableContext>
          </DndContext>

          {logoSections.length < 10 && (
            <Button
              type="button"
              variant="outline"
              onClick={onAddSection}
              className="py-2 px-4 text-[13px]"
            >
              <Plus size={16} />セクションを追加
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
