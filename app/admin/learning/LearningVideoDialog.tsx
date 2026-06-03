'use client'

// ラーニング動画 作成／編集モーダル
// YouTube URL 貼り付け → ID抽出 → サムネ・タイトル候補プレビュー → カテゴリ・説明入力 → 保存
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { extractVideoId, getThumbnailUrl } from '@/lib/youtube'
import type { LearningVideo } from '@/lib/types/learning'
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
import { Check, Youtube } from 'lucide-react'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  video?: LearningVideo | null // 指定時は編集モード
  categories: string[] // 既存カテゴリ（サジェスト用）
  onSaved: () => void
}

export function LearningVideoDialog({ open, onOpenChange, video, categories, onSaved }: Props) {
  const isEdit = !!video

  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [isPublished, setIsPublished] = useState(true)
  const [saving, setSaving] = useState(false)

  // 動画ID（プレビュー用）
  const videoId = extractVideoId(youtubeUrl)

  // ダイアログを開くたびに初期化（編集なら既存値）
  useEffect(() => {
    if (!open) return
    if (video) {
      setYoutubeUrl(video.youtube_url || `https://www.youtube.com/watch?v=${video.youtube_video_id}`)
      setTitle(video.title)
      setDescription(video.description || '')
      setCategory(video.category || '')
      setIsPublished(video.is_published)
    } else {
      setYoutubeUrl('')
      setTitle('')
      setDescription('')
      setCategory('')
      setIsPublished(true) // 登録＝即公開（初期値を公開に）
    }
  }, [open, video])

  // URL からタイトル候補を取得（best-effort・CORSで失敗しても無視）。
  // 新規作成時かつタイトル未入力のときのみ自動補完する。
  useEffect(() => {
    if (isEdit) return
    if (!videoId) return
    if (title.trim()) return
    let cancelled = false
    const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${videoId}`
    )}&format=json`
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.title) return
        setTitle((prev) => (prev.trim() ? prev : data.title))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, isEdit])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!youtubeUrl.trim()) {
      toast.error('YouTube URL を入力してください')
      return
    }
    if (!videoId) {
      toast.error('有効な YouTube URL を入力してください')
      return
    }

    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        youtube_url: youtubeUrl.trim(),
        category: category.trim(),
        is_published: isPublished,
      }
      const res = await fetch(
        isEdit ? `/api/learning/videos/${video!.id}` : '/api/learning/videos',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      toast.success(isEdit ? '動画を更新しました' : '動画を登録しました')
      onOpenChange(false)
      onSaved()
    } catch (err) {
      console.error('[LearningVideoDialog] 保存エラー:', err)
      toast.error('保存に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? '動画を編集' : '動画を登録'}</DialogTitle>
        </DialogHeader>

        <form id="learning-video-form" onSubmit={handleSubmit}>
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5 space-y-4">
              {/* YouTube URL */}
              <div className="space-y-1.5">
                <Label htmlFor="lv-url" className="text-xs font-semibold text-muted-foreground">
                  YouTube URL
                </Label>
                <Input
                  id="lv-url"
                  type="text"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="bg-background"
                  required
                />
              </div>

              {/* サムネプレビュー */}
              <div className="rounded-xl overflow-hidden bg-muted aspect-video flex items-center justify-center">
                {videoId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={getThumbnailUrl(videoId)}
                    alt="サムネイル"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Youtube size={32} strokeWidth={1.5} />
                    <span className="text-xs">URL を入力するとプレビューが表示されます</span>
                  </div>
                )}
              </div>

              {/* タイトル */}
              <div className="space-y-1.5">
                <Label htmlFor="lv-title" className="text-xs font-semibold text-muted-foreground">
                  タイトル
                </Label>
                <Input
                  id="lv-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="未入力の場合は動画タイトルを自動取得します"
                  className="bg-background"
                />
              </div>

              {/* 説明 */}
              <div className="space-y-1.5">
                <Label htmlFor="lv-desc" className="text-xs font-semibold text-muted-foreground">
                  説明（任意）
                </Label>
                <Textarea
                  id="lv-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
                  placeholder="この動画の概要や視聴ポイントなど"
                  className="min-h-[80px] resize-none bg-background"
                />
              </div>

              {/* カテゴリ + 公開設定 */}
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1.5 flex-1 min-w-[180px]">
                  <Label htmlFor="lv-category" className="text-xs font-semibold text-muted-foreground">
                    カテゴリ（任意）
                  </Label>
                  <Input
                    id="lv-category"
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="例: 理念・行動指針"
                    className="bg-background"
                    list="lv-category-suggestions"
                  />
                  <datalist id="lv-category-suggestions">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <Switch id="lv-published" checked={isPublished} onCheckedChange={setIsPublished} />
                  <Label htmlFor="lv-published" className="text-xs text-muted-foreground cursor-pointer">
                    {isPublished ? '公開' : '非公開'}
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </form>

        {/* フッター */}
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
            form="learning-video-form"
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
