'use client'

// お知らせ新規作成ページ
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../../components/AdminDataProvider'
import { MultiImageUpload, ImagePreviews, ImageUploadButton } from '../../components/MultiImageUpload'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const CATEGORIES = ['重要', 'イベント', '更新', 'その他']

export default function AnnouncementNewPage() {
  const router = useRouter()
  const { companyId, user } = useAuth()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('その他')
  const [content, setContent] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [isPublished, setIsPublished] = useState(true)
  const [saving, setSaving] = useState(false)

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
    if (!companyId || !user?.id) return

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
            author_id: user.id,
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
      router.push('/admin/announcements')
    } catch (err) {
      console.error('[Announcement Create] エラー:', err)
      const msg = err instanceof Error ? err.message : '不明なエラー'
      toast.error('保存に失敗しました: ' + msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/announcements"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 no-underline mb-3"
        >
          <ArrowLeft size={14} />
          お知らせ管理に戻る
        </Link>
        <h1 className="text-2xl font-bold text-foreground">お知らせ作成</h1>
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
      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-3 flex justify-end">
        <Button
          type="submit"
          form="announcement-form"
          disabled={saving}
          className={`${saving ? 'opacity-60' : ''}`}
        >
          {saving ? '保存中...' : '保存する'}
        </Button>
      </div>
    </div>
  )
}
