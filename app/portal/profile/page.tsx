'use client'

// マイプロフィール編集ページ
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { usePortalAuth } from '../components/PortalDataProvider'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
} from 'lucide-react'

// ============================================
// Types
// ============================================

type ProfileFormData = {
  id: string
  name: string
  position: string
  department: string
  bio: string
  email: string
  phone: string
  photo_url: string
  cover_image_url: string
  sns_x: string
  sns_linkedin: string
  sns_facebook: string
  sns_instagram: string
}

const EMPTY_FORM: ProfileFormData = {
  id: '',
  name: '',
  position: '',
  department: '',
  bio: '',
  email: '',
  phone: '',
  photo_url: '',
  cover_image_url: '',
  sns_x: '',
  sns_linkedin: '',
  sns_facebook: '',
  sns_instagram: '',
}

// ============================================
// Main Component
// ============================================

export default function ProfilePage() {
  const { user, companyId } = usePortalAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<ProfileFormData>(EMPTY_FORM)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)

  // パスワード変更
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  const photoInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const bioRef = useRef<HTMLTextAreaElement>(null)

  // 自動リサイズ
  const autoResizeBio = useCallback(() => {
    if (bioRef.current) {
      bioRef.current.style.height = 'auto'
      bioRef.current.style.height = bioRef.current.scrollHeight + 'px'
    }
  }, [])

  // データ取得
  useEffect(() => {
    if (!user?.id || !companyId) {
      setLoading(false)
      return
    }

    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('members')
          .select('*, profile:profiles(*)')
          .eq('auth_id', user.id)
          .eq('company_id', companyId)
          .single()

        if (error || !data) {
          console.error('プロフィール取得エラー:', error)
          setLoading(false)
          return
        }

        const profileRaw = data.profile as Record<string, string> | Record<string, string>[] | null
        const profile = Array.isArray(profileRaw) ? profileRaw[0] ?? null : profileRaw

        if (profile) {
          setForm({
            id: profile.id || '',
            name: profile.name || '',
            position: profile.position || '',
            department: profile.department || '',
            bio: profile.bio || '',
            email: profile.email || '',
            phone: profile.phone || '',
            photo_url: profile.photo_url || '',
            cover_image_url: profile.cover_image_url || '',
            sns_x: profile.sns_x || '',
            sns_linkedin: profile.sns_linkedin || '',
            sns_facebook: profile.sns_facebook || '',
            sns_instagram: profile.sns_instagram || '',
          })
        }
      } catch (err) {
        console.error('プロフィール取得エラー:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [user?.id, companyId])

  // bio 初回表示時の自動リサイズ
  useEffect(() => {
    if (!loading) {
      setTimeout(autoResizeBio, 0)
    }
  }, [loading, autoResizeBio])

  const handleChange = (field: keyof ProfileFormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // 画像アップロード共通処理
  const handleImageUpload = async (
    file: File,
    folder: string,
    field: 'photo_url' | 'cover_image_url',
    setUploading: (v: boolean) => void,
  ) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('ファイルサイズは5MB以下にしてください')
      return
    }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast.error('JPG、PNG、WebP形式の画像を選択してください')
      return
    }

    setUploading(true)
    const ext = file.name.split('.').pop()
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true })

    if (error) {
      toast.error('アップロードに失敗しました')
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName)

    handleChange(field, publicUrl)
    setUploading(false)
    toast.success('画像をアップロードしました')
  }

  // プロフィール保存
  const handleSave = async () => {
    if (!form.id) {
      toast.error('プロフィールが見つかりません')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: form.name,
          position: form.position,
          department: form.department,
          bio: form.bio,
          email: form.email,
          phone: form.phone,
          photo_url: form.photo_url || null,
          cover_image_url: form.cover_image_url || null,
          sns_x: form.sns_x || null,
          sns_linkedin: form.sns_linkedin || null,
          sns_facebook: form.sns_facebook || null,
          sns_instagram: form.sns_instagram || null,
        })
        .eq('id', form.id)

      if (error) {
        toast.error('保存に失敗しました: ' + error.message)
      } else {
        toast.success('プロフィールを更新しました')
      }
    } catch {
      toast.error('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  // パスワード変更
  const handlePasswordChange = async () => {
    setPasswordError('')

    if (!currentPassword) {
      setPasswordError('現在のパスワードを入力してください')
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('新しいパスワードは8文字以上にしてください')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('新しいパスワードが一致しません')
      return
    }

    setChangingPassword(true)
    try {
      // 現在のパスワードで再認証
      const email = user?.email
      if (!email) {
        setPasswordError('メールアドレスが取得できません')
        setChangingPassword(false)
        return
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      })

      if (signInError) {
        setPasswordError('現在のパスワードが正しくありません')
        setChangingPassword(false)
        return
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) {
        setPasswordError('パスワードの変更に失敗しました: ' + error.message)
      } else {
        toast.success('パスワードを変更しました')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setShowPasswordChange(false)
      }
    } catch {
      setPasswordError('パスワードの変更に失敗しました')
    } finally {
      setChangingPassword(false)
    }
  }

  // ============================================
  // Loading
  // ============================================

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-10 space-y-6">
        <Skeleton className="h-[160px] w-full rounded-xl" />
        <div className="flex justify-center -mt-12">
          <Skeleton className="w-24 h-24 rounded-full" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  // ============================================
  // Render
  // ============================================

  return (
    <div className="max-w-2xl mx-auto px-5 pt-4 pb-10">
      {/* ===== A. カバー写真 + プロフィール写真 ===== */}
      <div className="mb-8">
        {/* カバー写真 */}
        <div
          className="relative h-[160px] rounded-xl overflow-hidden cursor-pointer group"
          onClick={() => coverInputRef.current?.click()}
        >
          {form.cover_image_url ? (
            <img
              src={form.cover_image_url}
              alt="カバー写真"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-muted" />
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center text-white">
              <Camera size={24} />
              <span className="text-xs mt-1">
                {uploadingCover ? 'アップロード中...' : 'カバー写真を変更'}
              </span>
            </div>
          </div>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImageUpload(file, 'covers', 'cover_image_url', setUploadingCover)
              e.target.value = ''
            }}
          />
        </div>

        {/* プロフィール写真 */}
        <div className="flex justify-center -mt-12 relative z-[1]">
          <div
            className="relative cursor-pointer group"
            onClick={() => photoInputRef.current?.click()}
          >
            <Avatar className="w-24 h-24 border-4 border-background shadow-lg">
              {form.photo_url ? (
                <AvatarImage src={form.photo_url} alt={form.name} />
              ) : null}
              <AvatarFallback className="text-3xl font-semibold bg-muted text-muted-foreground">
                {form.name?.charAt(0) || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white">
                <Camera size={20} />
              </div>
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImageUpload(file, 'profiles', 'photo_url', setUploadingPhoto)
                e.target.value = ''
              }}
            />
            {uploadingPhoto && (
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                <span className="text-white text-xs">...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== B. 基本情報 ===== */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-6">
        <CardContent className="p-5 space-y-5">
          <h2 className="text-xs font-bold text-foreground">基本情報</h2>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">名前</label>
            <Input
              type="text"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="山田太郎"
              className="h-10"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">役職</label>
              <Input
                type="text"
                value={form.position}
                onChange={(e) => handleChange('position', e.target.value)}
                placeholder="代表取締役"
                className="h-10"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">部署</label>
              <Input
                type="text"
                value={form.department}
                onChange={(e) => handleChange('department', e.target.value)}
                placeholder="経営企画部"
                className="h-10"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">自己紹介</label>
            <textarea
              ref={bioRef}
              value={form.bio}
              onChange={(e) => {
                handleChange('bio', e.target.value)
                autoResizeBio()
              }}
              placeholder="自己紹介を入力してください"
              className="flex w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[80px] resize-none overflow-hidden"
            />
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">メールアドレス</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="taro@example.com"
                className="h-10"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">電話番号</label>
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="090-1234-5678"
                className="h-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== C. SNSリンク ===== */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-6">
        <CardContent className="p-5 space-y-5">
          <h2 className="text-xs font-bold text-foreground">SNSリンク</h2>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">X (Twitter)</label>
            <Input
              type="url"
              value={form.sns_x}
              onChange={(e) => handleChange('sns_x', e.target.value)}
              placeholder="https://x.com/username"
              className="h-10"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">LinkedIn</label>
            <Input
              type="url"
              value={form.sns_linkedin}
              onChange={(e) => handleChange('sns_linkedin', e.target.value)}
              placeholder="https://linkedin.com/in/username"
              className="h-10"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Facebook</label>
            <Input
              type="url"
              value={form.sns_facebook}
              onChange={(e) => handleChange('sns_facebook', e.target.value)}
              placeholder="https://facebook.com/username"
              className="h-10"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Instagram</label>
            <Input
              type="url"
              value={form.sns_instagram}
              onChange={(e) => handleChange('sns_instagram', e.target.value)}
              placeholder="https://instagram.com/username"
              className="h-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* ===== 保存ボタン ===== */}
      <div className="mb-8">
        <Button onClick={handleSave} disabled={saving} className="w-full h-11">
          {saving ? '保存中...' : '保存する'}
        </Button>
      </div>

      {/* ===== D. パスワード変更 ===== */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">
          <button
            type="button"
            onClick={() => setShowPasswordChange(!showPasswordChange)}
            className="flex items-center justify-between w-full border-0 bg-transparent cursor-pointer p-0"
          >
            <h2 className="text-xs font-bold text-foreground m-0">パスワード変更</h2>
            {showPasswordChange ? (
              <ChevronUp size={18} className="text-muted-foreground" />
            ) : (
              <ChevronDown size={18} className="text-muted-foreground" />
            )}
          </button>

          {showPasswordChange && (
            <div className="mt-4 space-y-4">
              {passwordError && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                  {passwordError}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  現在のパスワード
                </label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="現在のパスワード"
                  className="h-10"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  新しいパスワード（8文字以上）
                </label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="新しいパスワード"
                    className="h-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground border-0 bg-transparent cursor-pointer p-0"
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  新しいパスワード（確認）
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="もう一度入力してください"
                  className="h-10"
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-500 mt-1 m-0">パスワードが一致しません</p>
                )}
              </div>

              <Button
                onClick={handlePasswordChange}
                disabled={changingPassword}
                variant="outline"
                className="w-full h-10"
              >
                {changingPassword ? '変更中...' : 'パスワードを変更'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
