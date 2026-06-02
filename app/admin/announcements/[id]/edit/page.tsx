'use client'

// お知らせ編集ページ
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../../../components/AdminDataProvider'
import { MultiImageUpload, ImagePreviews, ImageUploadButton } from '../../../components/MultiImageUpload'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Check } from 'lucide-react'
import Link from 'next/link'

const CATEGORIES = ['重要', 'イベント', '更新', 'その他']

export default function AnnouncementEditPage() {
  const params = useParams()
  const router = useRouter()
  const { companyId, user } = useAuth()
  const id = params.id as string

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('その他')
  const [content, setContent] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [isPublished, setIsPublished] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id || !companyId) return
    const fetchAnnouncement = async () => {
      try {
        const { data, error } = await supabase
          .from('announcements')
          .select('*')
          .eq('id', id)
          .eq('company_id', companyId)
          .single()

        if (error) throw error
        if (data) {
          setTitle(data.title || '')
          setCategory(data.category || 'その他')
          setContent(data.content || '')
          setImages(data.images || [])
          setIsPublished(data.is_published || false)
        }
      } catch (err) {
        console.error('[Announcement Edit] データ取得エラー:', err)
        toast.error('お知らせの取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }
    fetchAnnouncement()
  }, [id, companyId])

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

    setSaving(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/announcements?id=eq.${id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            'Authorization': `Bearer ${token}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            title: title.trim(),
            content: content.trim(),
            category,
            images,
            is_published: isPublished,
            updated_at: new Date().toISOString(),
          }),
        }
      )

      if (!res.ok) {
        const body = await res.text()
        throw new Error(`HTTP ${res.status}: ${body}`)
      }

      toast.success('お知らせを更新しました')
      router.push('/admin/announcements')
    } catch (err) {
      console.error('[Announcement Edit] 保存エラー:', err)
      const msg = err instanceof Error ? err.message : '不明なエラー'
      toast.error('保存に失敗しました: ' + msg)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div>
        <Skeleton className="h-4 w-32 mb-3" />
        <Skeleton className="h-8 w-44 mb-6" />
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-[100px] w-full" />
            <div className="flex gap-3">
              <Skeleton className="h-9 w-[200px]" />
              <Skeleton className="h-9 w-20" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/announcements"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 no-underline"
        >
          <ArrowLeft size={14} />
          お知らせ管理に戻る
        </Link>
      </div>

      <form id="announcement-form" onSubmit={handleSubmit}>
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
                    id="is-published"
                    checked={isPublished}
                    onCheckedChange={setIsPublished}
                  />
                  <Label htmlFor="is-published" className="text-xs text-muted-foreground cursor-pointer">
                    {isPublished ? '公開' : '下書き保存'}
                  </Label>
                </div>

              </div>
            </CardContent>
          </MultiImageUpload>
        </Card>
      </form>

      {/* 固定保存バー */}
      {/* FabBar との重なりを防ぐスペーサー */}
      <div className="h-24" />

      {/* 保存 FAB（右下固定・include-bz node の FabButton と同装飾） */}
      <div className="fixed bottom-8 right-8 z-50 flex items-center gap-3">
        <button
          type="submit"
          form="announcement-form"
          disabled={saving}
          className="flex items-center justify-center gap-1 h-12 px-5 rounded-full hover:scale-105 transition-transform cursor-pointer text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 bg-foreground text-background shadow-lg"
        >
          <Check size={16} />
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  )
}
