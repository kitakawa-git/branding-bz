// 投稿フォーム（モーダル）の状態・画像選択・投稿/編集処理をまとめたフック
import { useEffect, useState, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useSearchParams } from 'next/navigation'
import type { TimelinePost } from './PostCard'

export const MAX_IMAGES = 3
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

type UsePostComposerArgs = {
  companyId: string | null
  user: User | null
  fetchPosts: (offset?: number, append?: boolean) => Promise<void>
}

export function usePostComposer({ companyId, user, fetchPosts }: UsePostComposerArgs) {
  // Post form
  const [formContent, setFormContent] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formAnonymous, setFormAnonymous] = useState(false)
  const [formImages, setFormImages] = useState<File[]>([])
  const [formImagePreviews, setFormImagePreviews] = useState<string[]>([])
  const [posting, setPosting] = useState(false)
  // 投稿フォーム（モーダル）の開閉
  const [composerOpen, setComposerOpen] = useState(false)
  // 初回セットアップ案内のステップ②から ?compose=1 で直接開く。
  // 投稿UIはダイアログなので、URL から開ける口が無いと案内の導線が1手増える
  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('compose') === '1') setComposerOpen(true)
  }, [searchParams])

  // Edit mode
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editExistingImages, setEditExistingImages] = useState<string[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ============================================
  // Image handling
  // ============================================
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const currentCount = formImages.length + editExistingImages.length
    const remaining = MAX_IMAGES - currentCount

    if (remaining <= 0) {
      toast.error(`画像は最大${MAX_IMAGES}枚までです`)
      return
    }

    const validFiles: File[] = []
    for (const file of files.slice(0, remaining)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error('JPG、PNG、WebP形式の画像を選択してください')
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error('ファイルサイズは5MB以下にしてください')
        continue
      }
      validFiles.push(file)
    }

    if (validFiles.length > 0) {
      setFormImages(prev => [...prev, ...validFiles])
      const newPreviews = validFiles.map(f => URL.createObjectURL(f))
      setFormImagePreviews(prev => [...prev, ...newPreviews])
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeImage = (index: number) => {
    URL.revokeObjectURL(formImagePreviews[index])
    setFormImages(prev => prev.filter((_, i) => i !== index))
    setFormImagePreviews(prev => prev.filter((_, i) => i !== index))
  }

  const removeExistingImage = (index: number) => {
    setEditExistingImages(prev => prev.filter((_, i) => i !== index))
  }

  // ============================================
  // Upload images to Storage
  // ============================================
  const uploadImages = async (postId: string, files: File[]): Promise<string[]> => {
    if (!companyId || files.length === 0) return []
    const urls: string[] = []

    for (const file of files) {
      const ext = file.name.split('.').pop()
      const fileName = `${companyId}/${postId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error } = await supabase.storage
        .from('timeline-images')
        .upload(fileName, file, { upsert: true })

      if (error) {
        console.error('[Timeline] Image upload error:', error.message)
        toast.error(`画像のアップロードに失敗: ${error.message}`)
        continue
      }

      const { data: { publicUrl } } = supabase.storage
        .from('timeline-images')
        .getPublicUrl(fileName)

      urls.push(publicUrl)
    }

    return urls
  }

  // ============================================
  // Submit post
  // ============================================
  const handleSubmit = async () => {
    if (!companyId || !user || !formContent.trim() || !formCategory) return

    setPosting(true)
    try {
      if (editingPostId) {
        // Edit existing post
        const newImageUrls = await uploadImages(editingPostId, formImages)
        const allImages = [...editExistingImages, ...newImageUrls]

        const { data: updateData, error } = await supabase
          .from('timeline_posts')
          .update({
            content: formContent.trim(),
            category: formCategory,
            is_anonymous: formAnonymous,
            images: allImages,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingPostId)
          .select()

        if (error) throw error
        if (!updateData || updateData.length === 0) {
          throw new Error('更新対象の投稿が見つかりません（権限不足の可能性があります）')
        }
        toast.success('投稿を更新しました')
        setEditingPostId(null)
        setEditExistingImages([])
      } else {
        // Create new post: 先に画像アップロード → URL付きでINSERT（UPDATEステップ不要）
        const postId = crypto.randomUUID()
        const imageUrls = await uploadImages(postId, formImages)

        const { error } = await supabase
          .from('timeline_posts')
          .insert({
            id: postId,
            company_id: companyId,
            user_id: user.id,
            content: formContent.trim(),
            category: formCategory,
            is_anonymous: formAnonymous,
            images: imageUrls,
          })

        if (error) throw error
        toast.success('投稿しました')
      }

      // Reset form & close modal
      resetForm()
      setComposerOpen(false)
      // Refresh posts
      await fetchPosts()
    } catch (err) {
      console.error('Post error:', err)
      const msg = err && typeof err === 'object' && 'message' in err ? (err as { message: string }).message : String(err)
      toast.error('投稿に失敗しました: ' + msg)
    } finally {
      setPosting(false)
    }
  }

  const resetForm = () => {
    setFormContent('')
    setFormCategory('')
    setFormAnonymous(false)
    formImagePreviews.forEach(url => URL.revokeObjectURL(url))
    setFormImages([])
    setFormImagePreviews([])
    setEditingPostId(null)
    setEditExistingImages([])
  }

  // ============================================
  // Edit post
  // ============================================
  const startEdit = (post: TimelinePost) => {
    setEditingPostId(post.id)
    setFormContent(post.content)
    setFormCategory(post.category)
    setFormAnonymous(post.is_anonymous)
    setEditExistingImages(post.images || [])
    setFormImages([])
    setFormImagePreviews([])
    // 編集も同じ投稿モーダルを開く
    setComposerOpen(true)
  }

  return {
    formContent,
    setFormContent,
    formCategory,
    setFormCategory,
    formAnonymous,
    setFormAnonymous,
    formImages,
    formImagePreviews,
    posting,
    composerOpen,
    setComposerOpen,
    editingPostId,
    editExistingImages,
    fileInputRef,
    handleImageSelect,
    removeImage,
    removeExistingImage,
    handleSubmit,
    resetForm,
    startEdit,
  }
}
