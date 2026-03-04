'use client'

// 従業員フォーム（新規追加・編集共通）
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ImageUpload } from './ImageUpload'
import { CoverImageUpload } from './CoverImageUpload'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

type ProfileData = {
  id?: string
  name: string
  position: string
  department: string
  bio: string
  email: string
  phone: string
  slug: string
  photo_url: string
  cover_image_url: string
  company_id: string
  sns_x: string
  sns_linkedin: string
  sns_facebook: string
  sns_instagram: string
}

type Props = {
  initialData?: ProfileData
  companyId: string
}

export function MemberForm({ initialData, companyId }: Props) {
  const isEdit = !!initialData?.id
  const router = useRouter()

  const [form, setForm] = useState<ProfileData>({
    name: initialData?.name || '',
    position: initialData?.position || '',
    department: initialData?.department || '',
    bio: initialData?.bio || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    slug: initialData?.slug || '',
    photo_url: initialData?.photo_url || '',
    cover_image_url: initialData?.cover_image_url || '',
    company_id: companyId,
    sns_x: initialData?.sns_x || '',
    sns_linkedin: initialData?.sns_linkedin || '',
    sns_facebook: initialData?.sns_facebook || '',
    sns_instagram: initialData?.sns_instagram || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (field: keyof ProfileData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    if (!form.name || !form.slug) {
      setError('名前とスラッグは必須です')
      setSaving(false)
      return
    }

    const payload = {
      name: form.name,
      position: form.position,
      department: form.department,
      bio: form.bio,
      email: form.email,
      phone: form.phone,
      slug: form.slug,
      photo_url: form.photo_url,
      cover_image_url: form.cover_image_url || null,
      company_id: form.company_id,
      sns_x: form.sns_x || null,
      sns_linkedin: form.sns_linkedin || null,
      sns_facebook: form.sns_facebook || null,
      sns_instagram: form.sns_instagram || null,
    }

    if (isEdit) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', initialData!.id)

      if (updateError) {
        setError('更新に失敗しました: ' + updateError.message)
        setSaving(false)
        return
      }
    } else {
      const { error: insertError } = await supabase
        .from('profiles')
        .insert(payload)

      if (insertError) {
        setError('保存に失敗しました: ' + insertError.message)
        setSaving(false)
        return
      }
    }

    router.push('/admin/members')
  }

  return (
    <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
      <CardContent className="p-5">
        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <h2 className="text-sm font-bold mb-3">プロフィール写真</h2>
            <ImageUpload
              bucket="avatars"
              folder="profiles"
              currentUrl={form.photo_url}
              onUpload={(url) => handleChange('photo_url', url)}
            />
          </div>

          <div className="mb-5">
            <h2 className="text-sm font-bold mb-3">カバー写真</h2>
            <CoverImageUpload
              bucket="avatars"
              folder="covers"
              currentUrl={form.cover_image_url}
              onUpload={(url) => handleChange('cover_image_url', url)}
              onRemove={() => handleChange('cover_image_url', '')}
            />
          </div>

          <div className="mb-5">
            <h2 className="text-sm font-bold mb-3">名前 *</h2>
            <Input type="text" value={form.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="山田太郎" required className="h-10" />
          </div>

          <div className="mb-5">
            <h2 className="text-sm font-bold mb-3">役職</h2>
            <Input type="text" value={form.position} onChange={(e) => handleChange('position', e.target.value)} placeholder="代表取締役" className="h-10" />
          </div>

          <div className="mb-5">
            <h2 className="text-sm font-bold mb-3">部署</h2>
            <Input type="text" value={form.department} onChange={(e) => handleChange('department', e.target.value)} placeholder="経営企画部" className="h-10" />
          </div>

          <div className="mb-5">
            <h2 className="text-sm font-bold mb-3">自己紹介</h2>
            <textarea
              value={form.bio}
              onChange={(e) => handleChange('bio', e.target.value)}
              placeholder="自己紹介を入力してください"
              className="flex w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[100px] resize-y"
            />
          </div>

          <div className="mb-5">
            <h2 className="text-sm font-bold mb-3">メールアドレス</h2>
            <Input type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="taro@example.com" className="h-10" />
          </div>

          <div className="mb-5">
            <h2 className="text-sm font-bold mb-3">電話番号</h2>
            <Input type="tel" value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} placeholder="090-1234-5678" className="h-10" />
          </div>

          {/* SNSリンクセクション */}
          <Separator className="my-5" />
          <h3 className="text-sm font-bold text-foreground mb-4">SNSリンク</h3>

          <div className="mb-5">
            <h2 className="text-sm font-bold mb-3">X (Twitter)</h2>
            <Input type="url" value={form.sns_x} onChange={(e) => handleChange('sns_x', e.target.value)} placeholder="https://x.com/username" className="h-10" />
          </div>

          <div className="mb-5">
            <h2 className="text-sm font-bold mb-3">LinkedIn</h2>
            <Input type="url" value={form.sns_linkedin} onChange={(e) => handleChange('sns_linkedin', e.target.value)} placeholder="https://linkedin.com/in/username" className="h-10" />
          </div>

          <div className="mb-5">
            <h2 className="text-sm font-bold mb-3">Facebook</h2>
            <Input type="url" value={form.sns_facebook} onChange={(e) => handleChange('sns_facebook', e.target.value)} placeholder="https://facebook.com/username" className="h-10" />
          </div>

          <div className="mb-5">
            <h2 className="text-sm font-bold mb-3">Instagram</h2>
            <Input type="url" value={form.sns_instagram} onChange={(e) => handleChange('sns_instagram', e.target.value)} placeholder="https://instagram.com/username" className="h-10" />
          </div>

          <Separator className="my-5" />

          <div className="mb-5">
            <h2 className="text-sm font-bold mb-3">スラッグ（URL） *</h2>
            <Input type="text" value={form.slug} onChange={(e) => handleChange('slug', e.target.value)} placeholder="taro-yamada" required className="h-10" />
            <p className="text-xs text-muted-foreground mt-1 m-0">
              名刺ページURL: branding.bz/card/{form.slug || '...'}
            </p>
          </div>

          <div className="flex gap-3 mt-6">
            <Button type="submit" disabled={saving}>
              {saving ? '保存中...' : (isEdit ? '更新する' : '追加する')}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push('/admin/members')}>
              キャンセル
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
