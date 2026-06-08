'use client'

// ラーニング動画 作成／編集モーダル
// YouTube URL 貼り付け → ID抽出 → サムネ・タイトル候補プレビュー → カテゴリー/テーマ選択・説明入力 → 保存
import { useEffect, useState, useMemo } from 'react'
import { toast } from 'sonner'
import { extractVideoId, getThumbnailUrl } from '@/lib/youtube'
import type { LearningVideo, LearningCategory, LearningTheme } from '@/lib/types/learning'
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
import { Check, Youtube } from 'lucide-react'

// 階層（カテゴリー＋配下テーマ）。structure API の categories をそのまま渡せる
type CategoryTree = (Pick<LearningCategory, 'id' | 'name'> & {
  themes: Pick<LearningTheme, 'id' | 'name' | 'category_id'>[]
})

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  video?: LearningVideo | null // 指定時は編集モード
  categoriesTree: CategoryTree[] // カテゴリー＞テーマの階層
  onSaved: () => void
}

const UNASSIGNED = '__none__' // 未分類を表す Select 値

export function LearningVideoDialog({ open, onOpenChange, video, categoriesTree, onSaved }: Props) {
  const isEdit = !!video

  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState<string>(UNASSIGNED)
  const [themeId, setThemeId] = useState<string>(UNASSIGNED)
  const [isPublished, setIsPublished] = useState(true)
  const [saving, setSaving] = useState(false)

  // 動画ID（プレビュー用）
  const videoId = extractVideoId(youtubeUrl)

  // theme_id → 所属 category_id を逆引きするマップ
  const themeToCategory = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of categoriesTree) for (const t of c.themes) m.set(t.id, c.id)
    return m
  }, [categoriesTree])

  // 選択中カテゴリー配下のテーマ
  const themesOfCategory = useMemo(
    () => categoriesTree.find((c) => c.id === categoryId)?.themes ?? [],
    [categoriesTree, categoryId]
  )

  // ダイアログを開くたびに初期化（編集なら既存値）
  useEffect(() => {
    if (!open) return
    if (video) {
      setYoutubeUrl(video.youtube_url || `https://www.youtube.com/watch?v=${video.youtube_video_id}`)
      setTitle(video.title)
      setDescription(video.description || '')
      setIsPublished(video.is_published)
      if (video.theme_id && themeToCategory.has(video.theme_id)) {
        setCategoryId(themeToCategory.get(video.theme_id)!)
        setThemeId(video.theme_id)
      } else {
        setCategoryId(UNASSIGNED)
        setThemeId(UNASSIGNED)
      }
    } else {
      setYoutubeUrl('')
      setTitle('')
      setDescription('')
      setCategoryId(UNASSIGNED)
      setThemeId(UNASSIGNED)
      setIsPublished(true) // 登録＝即公開
    }
  }, [open, video, themeToCategory])

  // URL からタイトル候補を取得（best-effort・CORSで失敗しても無視）
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

  // カテゴリー変更時はテーマをリセット
  const handleCategoryChange = (v: string) => {
    setCategoryId(v)
    setThemeId(UNASSIGNED)
  }

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
        theme_id: themeId === UNASSIGNED ? null : themeId,
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

              {/* カテゴリー → テーマ（2段選択） */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">カテゴリー</Label>
                  <Select value={categoryId} onValueChange={handleCategoryChange}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="未分類" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>未分類</SelectItem>
                      {categoriesTree.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">テーマ</Label>
                  <Select
                    value={themeId}
                    onValueChange={setThemeId}
                    disabled={categoryId === UNASSIGNED || themesOfCategory.length === 0}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue
                        placeholder={
                          categoryId === UNASSIGNED
                            ? 'カテゴリーを選択'
                            : themesOfCategory.length === 0
                              ? 'テーマ未作成'
                              : '未選択'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>未選択</SelectItem>
                      {themesOfCategory.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 公開設定 */}
              <div className="flex items-center gap-2">
                <Switch id="lv-published" checked={isPublished} onCheckedChange={setIsPublished} />
                <Label htmlFor="lv-published" className="text-xs text-muted-foreground cursor-pointer">
                  {isPublished ? '公開' : '非公開'}
                </Label>
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
