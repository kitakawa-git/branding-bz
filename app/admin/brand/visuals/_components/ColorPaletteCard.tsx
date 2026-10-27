'use client'

// カード2: ブランドカラー（カテゴリ別のカラー追加・編集・削除）
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
import { Plus, Trash2 } from 'lucide-react'
import { COLOR_CATEGORIES, type ColorCategory, type ColorPalette } from './types'

export function ColorPaletteCard({
  colorPalette,
  onAddColor,
  onRemoveColor,
  onUpdateColor,
}: {
  colorPalette: ColorPalette
  onAddColor: (category: ColorCategory) => void
  onRemoveColor: (category: ColorCategory, index: number) => void
  onUpdateColor: (category: ColorCategory, index: number, field: 'name' | 'hex', value: string) => void
}) {
  return (
    <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
      <CardContent className="p-5">
        <h2 className="text-xs font-bold mb-5">ブランドカラー</h2>

        {COLOR_CATEGORIES.map((cat, catIdx) => (
          <div key={cat.key} className={catIdx < COLOR_CATEGORIES.length - 1 ? 'mb-6' : ''}>
            <h3 className="text-[11px] text-gray-500 mb-3">{cat.label}</h3>

            <div className="space-y-2">
              {colorPalette[cat.key].map((color, cIdx) => (
                <div key={cIdx} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color.hex}
                    onChange={(e) => onUpdateColor(cat.key, cIdx, 'hex', e.target.value)}
                    className="w-10 h-10 border border-border rounded-lg cursor-pointer p-0.5 shrink-0"
                  />
                  <Input
                    type="text"
                    value={color.hex}
                    onChange={(e) => onUpdateColor(cat.key, cIdx, 'hex', e.target.value)}
                    className="h-10 w-[120px] font-mono text-sm shrink-0"
                  />
                  <Input
                    type="text"
                    value={color.name}
                    onChange={(e) => onUpdateColor(cat.key, cIdx, 'name', e.target.value)}
                    placeholder="色名"
                    className="h-10 flex-1"
                  />
                  {colorPalette[cat.key].length > cat.minColors && (
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
                          <AlertDialogTitle>カラーを削除しますか？</AlertDialogTitle>
                          <AlertDialogDescription>「{color.name || color.hex}」を削除します。</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>キャンセル</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onRemoveColor(cat.key, cIdx)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">削除する</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              ))}
            </div>

            {colorPalette[cat.key].length < 10 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => onAddColor(cat.key)}
                className="py-2 px-4 text-[13px] mt-2"
              >
                <Plus size={16} />色を追加
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
