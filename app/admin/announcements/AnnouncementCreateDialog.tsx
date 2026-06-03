'use client'

// お知らせ新規作成モーダル（一覧ページの FAB から開く）
import { useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { MultiImageUpload, ImagePreviews, ImageUploadButton } from '../components/MultiImageUpload'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Check } from 'lucide-react'

const CATEGORIES = ['重要', 'イベント', '更新', 'その他']

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string | null
  userId: string | undefined
  onCreated: () => void // 作成成功後に一覧を再取得
}

export function AnnouncementCreateDialog({ open, onOpenChange, companyId, userId, onCreated }: Props) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('その他')
  const [content, setContent] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [isPublished, setIsPublished] = useState(true)
  const [saving, setSaving] = useState(false)

  const resetForm = () => {
    setTitle('')
    setCategory('その他')
    setContent('')
    setImages([])
    setIsPublished(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('タイトルを入力してください')
      return
    }
    if (!content.trim()) {
      toast.error('本文を入力してください')
      return
    }
    if (!companyId || !userId) return

    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/announcements`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            'Authorization': `Bearer ${token}`,
            'Prefer': 'return=representation',
          },
          body: JSON.stringify({
            company_id: companyId,
            author_id: userId,
            title: title.trim(),
            content: content.trim(),
            category,
            images,
            is_published: isPublished,
          }),
        }
      )

      if (!res.ok) {
        const body = await res.text()
        throw new Error(`HTTP ${res.status}: ${body}`)
      }

      toast.success(isPublished ? 'お知らせを公開しました' : 'お知らせを下書き保存しました')
      resetForm()
      onOpenChange(false)
      onCreated()
    } catch (err) {
      console.error('[Announcement Create] エラー:', err)
      const msg = err instanceof Error ? err.message : '不明なエラー'
      toast.error('保存に失敗しました: ' + msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>お知らせ作成</DialogTitle>
        </DialogHeader>

        <form id="announcement-create-form" onSubmit={handleSubmit}>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <MultiImageUpload
              bucket="announcement-images"
              folder={companyId || 'temp'}
              currentUrls={images}
              onUpdate={setImages}
              maxImages={3}
            >
              <CardContent className="p-5 space-y-4">
                {/* タイトル */}
                <div>
                  <Input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="お知らせのタイトル"
                    className="bg-background"
                    required
                  />
                </div>

                {/* 本文 */}
                <div>
                  <Textarea
                    value={content}
                    onChange={e => setContent(e.target.value.slice(0, 2000))}
                    placeholder="お知らせの内容を入力してください"
                    className="min-h-[100px] resize-none bg-background"
                  />
                  <p className="text-xs text-muted-foreground text-right mt-1 m-0">
                    {content.length}/2000
                  </p>
                </div>

                {/* 画像プレビュー */}
                <ImagePreviews />

                {/* カテゴリ・画像ボタン・公開設定 */}
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="w-[200px] bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <ImageUploadButton />

                  <div className="flex items-center gap-2">
                    <Switch
                      id="is-published-modal"
                      checked={isPublished}
                      onCheckedChange={setIsPublished}
                    />
                    <Label htmlFor="is-published-modal" className="text-xs text-muted-foreground cursor-pointer">
                      {isPublished ? '公開' : '下書き保存'}
                    </Label>
                  </div>
                </div>
              </CardContent>
            </MultiImageUpload>
          </Card>
        </form>

        {/* フッター: キャンセル＋保存 */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="flex items-center justify-center h-10 px-5 rounded-full hover:scale-105 transition-transform cursor-pointer text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 bg-white text-foreground border border-gray-300 shadow-sm"
          >
            キャンセル
          </button>
          <button
            type="submit"
            form="announcement-create-form"
            disabled={saving}
            className="flex items-center justify-center gap-1 h-10 px-5 rounded-full hover:scale-105 transition-transform cursor-pointer text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 bg-foreground text-background shadow-sm"
          >
            <Check size={16} />
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
