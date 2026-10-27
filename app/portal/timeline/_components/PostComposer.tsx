// 投稿フォーム（右下FAB＋投稿/編集モーダル）の表示部分
import type { RefObject, ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  ImagePlus,
  X,
  Pencil,
  UserRound,
} from 'lucide-react'
import { Fab, FabButton } from '@/components/ui/fab'
import { MAX_IMAGES } from './usePostComposer'

type PostComposerProps = {
  categories: string[]
  profileName: string | null
  profilePhotoUrl: string | null
  memberDisplayName: string | undefined
  composerOpen: boolean
  setComposerOpen: (open: boolean) => void
  resetForm: () => void
  editingPostId: string | null
  formContent: string
  setFormContent: (value: string) => void
  formCategory: string
  setFormCategory: (value: string) => void
  formAnonymous: boolean
  setFormAnonymous: (value: boolean) => void
  formImages: File[]
  formImagePreviews: string[]
  editExistingImages: string[]
  posting: boolean
  fileInputRef: RefObject<HTMLInputElement | null>
  handleImageSelect: (e: ChangeEvent<HTMLInputElement>) => void
  removeImage: (index: number) => void
  removeExistingImage: (index: number) => void
  handleSubmit: () => void
}

export function PostComposer({
  categories,
  profileName,
  profilePhotoUrl,
  memberDisplayName,
  composerOpen,
  setComposerOpen,
  resetForm,
  editingPostId,
  formContent,
  setFormContent,
  formCategory,
  setFormCategory,
  formAnonymous,
  setFormAnonymous,
  formImages,
  formImagePreviews,
  editExistingImages,
  posting,
  fileInputRef,
  handleImageSelect,
  removeImage,
  removeExistingImage,
  handleSubmit,
}: PostComposerProps) {
  return (
    <>
      {/* 右下のFABボタン: クリックで投稿モーダルを開く */}
      <Fab>
        <FabButton onClick={() => { resetForm(); setComposerOpen(true) }} icon={<Pencil size={18} />}>
          投稿する
        </FabButton>
      </Fab>

      {/* 投稿モーダル */}
      <Dialog open={composerOpen} onOpenChange={(o) => { if (!o) resetForm(); setComposerOpen(o) }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogTitle>{editingPostId ? '投稿を編集' : '投稿する'}</DialogTitle>
          <DialogDescription>
            行動指針に基づく取り組みを共有し、互いに称賛しましょう
          </DialogDescription>
          <div className="space-y-4">
          <div className="flex items-center gap-3 mb-1">
            <Avatar className="size-9 shrink-0">
              {!formAnonymous && profilePhotoUrl && (
                <AvatarImage src={profilePhotoUrl} alt={profileName || ''} />
              )}
              <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                {formAnonymous ? <UserRound className="size-4" /> : (profileName?.slice(0, 1) || '?')}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-foreground">
              {formAnonymous ? '匿名メンバー' : (profileName || memberDisplayName || '')}
            </span>
          </div>

          {/* Text */}
          <div>
            <Textarea
              placeholder="行動指針に基づいた取り組みを共有しましょう..."
              value={formContent}
              onChange={(e) => setFormContent(e.target.value.slice(0, 1000))}
              className="min-h-[100px] resize-none bg-background"
            />
            <p className="text-xs text-muted-foreground text-right mt-1 m-0">
              {formContent.length}/1000
            </p>
          </div>

          {/* Image previews */}
          {(formImagePreviews.length > 0 || editExistingImages.length > 0) && (
            <div className="flex gap-2 flex-wrap">
              {editExistingImages.map((url, i) => (
                <div key={`existing-${i}`} className="relative">
                  <img
                    src={url}
                    alt=""
                    className="w-20 h-20 object-cover rounded-lg border border-border"
                  />
                  <button
                    type="button"
                    onClick={() => removeExistingImage(i)}
                    className="absolute -top-1.5 -right-1.5 size-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
              {formImagePreviews.map((url, i) => (
                <div key={`new-${i}`} className="relative">
                  <img
                    src={url}
                    alt=""
                    className="w-20 h-20 object-cover rounded-lg border border-border"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute -top-1.5 -right-1.5 size-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Bottom row: category + image + anonymous + submit */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Category select */}
            <Select value={formCategory} onValueChange={setFormCategory}>
              <SelectTrigger className="w-[200px] bg-background">
                <SelectValue placeholder="行動指針を選択" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Image upload button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={formImages.length + editExistingImages.length >= MAX_IMAGES}
            >
              <ImagePlus className="size-4 mr-1.5" />
              画像
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleImageSelect}
              className="hidden"
            />

            {/* Anonymous toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="anonymous"
                checked={formAnonymous}
                onCheckedChange={setFormAnonymous}
              />
              <Label htmlFor="anonymous" className="text-xs text-muted-foreground cursor-pointer">
                匿名で投稿
              </Label>
            </div>

            {/* Submit button + hint */}
            <div className="flex items-center gap-2 ml-auto">
              {formContent.trim() && !formCategory && (
                <span className="text-xs text-amber-600">← 行動指針を選択してください</span>
              )}
              <Button
                onClick={handleSubmit}
                disabled={!formContent.trim() || !formCategory || posting}
                size="sm"
              >
                {posting ? '投稿中...' : editingPostId ? '更新する' : '投稿する'}
              </Button>
            </div>

            {/* Cancel edit */}
            {editingPostId && (
              <Button variant="outline" size="sm" onClick={() => { resetForm(); setComposerOpen(false) }}>
                キャンセル
              </Button>
            )}
          </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
