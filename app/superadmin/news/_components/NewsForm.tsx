'use client'

// ニュース作成・編集フォーム
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Check, X } from 'lucide-react'
import { Fab, FabButton } from '@/components/ui/fab'
import { Textarea } from '@/components/ui/textarea'
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { NewsItem, NewsCategory } from '@/lib/types/news'
import { NEWS_CATEGORY_LABELS } from '@/lib/types/news'

interface NewsFormProps {
  initialData?: NewsItem
  /**
   * 保存成功後の挙動カスタマイズ。
   * モーダル利用時は { onSuccess, onCancel } を渡して router.push を抑止する。
   */
  onSuccess?: () => void
  onCancel?: () => void
}

export default function NewsForm({ initialData, onSuccess, onCancel }: NewsFormProps) {
  const router = useRouter()
  const isEditing = !!initialData
  const isModal = !!onSuccess

  const [title, setTitle] = useState(initialData?.title || '')
  const [slug, setSlug] = useState(initialData?.slug || `news-${Date.now()}`)
  const [category, setCategory] = useState<NewsCategory>(initialData?.category || 'announcement')
  const [summary, setSummary] = useState(initialData?.summary || '')
  const [body, setBody] = useState(initialData?.body || '')
  const [publishedAt, setPublishedAt] = useState(() => {
    if (initialData?.published_at) {
      // ISO → datetime-local 形式に変換
      const d = new Date(initialData.published_at)
      const offset = d.getTimezoneOffset()
      const local = new Date(d.getTime() - offset * 60000)
      return local.toISOString().slice(0, 16)
    }
    return ''
  })
  const [isPublished, setIsPublished] = useState(initialData?.is_published ?? false)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      toast.error('タイトルを入力してください')
      return
    }
    if (!slug.trim()) {
      toast.error('スラッグを入力してください')
      return
    }

    setSaving(true)

    try {
      const record = {
        title: title.trim(),
        slug: slug.trim(),
        category,
        summary: summary.trim() || null,
        body: body.trim() || null,
        published_at: publishedAt ? new Date(publishedAt).toISOString() : null,
        is_published: isPublished,
        updated_at: new Date().toISOString(),
      }

      if (isEditing && initialData) {
        const { error } = await supabase
          .from('news')
          .update(record)
          .eq('id', initialData.id)

        if (error) throw error
        toast.success('ニュースを更新しました')
      } else {
        const { error } = await supabase
          .from('news')
          .insert({ ...record, created_at: new Date().toISOString() })

        if (error) throw error
        toast.success('ニュースを作成しました')
      }

      // モーダル利用時はコールバック・通常は一覧へ遷移
      if (onSuccess) {
        onSuccess()
      } else {
        router.push('/superadmin/news')
      }
    } catch (err) {
      console.error('[NewsForm] 保存エラー:', err)
      toast.error(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="bg-muted/50 border shadow-none">
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* タイトル */}
          <div>
            <Label className="mb-1.5 font-bold">タイトル <span className="text-red-500">*</span></Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ニュースのタイトルを入力"
              required
              className="h-10"
            />
          </div>

          {/* スラッグ */}
          <div>
            <Label className="mb-1.5 font-bold">スラッグ <span className="text-red-500">*</span></Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="news-example"
              required
              className="h-10 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              URLに使用されます: /news/{slug}
            </p>
          </div>

          {/* カテゴリ */}
          <div>
            <Label className="mb-1.5 font-bold">カテゴリ</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as NewsCategory)}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(NEWS_CATEGORY_LABELS) as [NewsCategory, string][]).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* サマリー */}
          <div>
            <Label className="mb-1.5 font-bold">サマリー</Label>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="一覧ページに表示される短い説明文"
              rows={2}
              className="text-sm"
            />
          </div>

          {/* 本文 */}
          <div>
            <Label className="mb-1.5 font-bold">本文</Label>
            <AutoResizeTextarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="ニュースの本文を入力"
              style={{ minHeight: '200px' }}
            />
          </div>

          {/* 公開日時 */}
          <div>
            <Label className="mb-1.5 font-bold">公開日時</Label>
            <Input
              type="datetime-local"
              value={publishedAt}
              onChange={(e) => setPublishedAt(e.target.value)}
              className="h-10 w-auto"
            />
          </div>

          {/* 公開状態 */}
          <div className="flex items-center gap-3">
            <Switch
              checked={isPublished}
              onCheckedChange={setIsPublished}
            />
            <Label className="font-bold cursor-pointer" onClick={() => setIsPublished(!isPublished)}>
              {isPublished ? '公開中' : '下書き'}
            </Label>
          </div>

          {/* モーダル時は Dialog フッターに合わせて通常配置、通常時は FAB（右下固定） */}
          {isModal ? (
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onCancel ?? (() => router.push('/superadmin/news'))}
                disabled={saving}
                className="flex items-center justify-center h-10 px-5 rounded-full hover:scale-105 transition-transform cursor-pointer text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 bg-white text-foreground border border-gray-300 shadow-sm"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center justify-center gap-1 h-10 px-5 rounded-full hover:scale-105 transition-transform cursor-pointer text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 bg-foreground text-background shadow-sm"
              >
                <Check size={16} />
                {saving ? '保存中...' : isEditing ? '更新' : '作成'}
              </button>
            </div>
          ) : (
            <>
              {/* FabBar との重なりを防ぐスペーサー */}
              <div className="h-16" />

              {/* キャンセル＋保存 FAB（右下固定・include-bz node の FabButton と同装飾） */}
              <Fab>
                <FabButton variant="secondary" onClick={() => router.push('/superadmin/news')} disabled={saving} icon={<X size={16} />}>
                  キャンセル
                </FabButton>
                <FabButton type="submit" disabled={saving} icon={<Check size={16} />}>
                  {saving ? '保存中...' : isEditing ? '更新' : '作成'}
                </FabButton>
              </Fab>
            </>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
