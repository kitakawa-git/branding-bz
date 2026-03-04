'use client'

// Good Job タイムライン
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/supabase-fetch'
import { usePortalAuth } from '../components/PortalAuthProvider'
import { getRelativeTime } from '@/lib/time-utils'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Heart,
  MessageCircle,
  ImagePlus,
  X,
  MoreHorizontal,
  Pencil,
  Trash2,
  Send,
  UserRound,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'

// ============================================
// Types
// ============================================

type ActionGuideline = {
  title: string
  description: string
}

type PostProfile = {
  name: string | null
  photo_url: string | null
  position: string | null
}

type TimelinePost = {
  id: string
  user_id: string
  content: string
  images: string[]
  category: string
  is_anonymous: boolean
  created_at: string
  updated_at: string
  // joined data
  profile: PostProfile | null
  member_display_name: string | null
  like_count: number
  comment_count: number
  is_liked: boolean
}

type TimelineComment = {
  id: string
  user_id: string
  content: string
  created_at: string
  profile_name: string | null
  profile_photo_url: string | null
}

const PAGE_SIZE = 20
const MAX_IMAGES = 3
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// ============================================
// Main Page Component
// ============================================

type TimelineCache = { categories: string[]; posts: TimelinePost[] }

export default function PortalTimelinePage() {
  const { companyId, user, member, profileName, profilePhotoUrl, isAdmin } = usePortalAuth()

  // Data states
  const cacheKey = `portal-timeline-${companyId}`
  const cached = companyId ? getPageCache<TimelineCache>(cacheKey) : null
  const [categories, setCategories] = useState<string[]>(cached?.categories ?? [])
  const categoriesRef = useRef<string[]>(cached?.categories ?? [])
  const [posts, setPosts] = useState<TimelinePost[]>(cached?.posts ?? [])
  const [loading, setLoading] = useState(!cached)
  const [hasMore, setHasMore] = useState(true)

  // Filter
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Post form
  const [formContent, setFormContent] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formAnonymous, setFormAnonymous] = useState(false)
  const [formImages, setFormImages] = useState<File[]>([])
  const [formImagePreviews, setFormImagePreviews] = useState<string[]>([])
  const [posting, setPosting] = useState(false)

  // Edit mode
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editExistingImages, setEditExistingImages] = useState<string[]>([])

  // Image dialog
  const [dialogImage, setDialogImage] = useState<string | null>(null)

  // Delete confirm
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Comment states
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [commentsByPost, setCommentsByPost] = useState<Record<string, TimelineComment[]>>({})
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  const [commentSubmitting, setCommentSubmitting] = useState<Record<string, boolean>>({})

  // Delete comment confirm
  const [deleteCommentTarget, setDeleteCommentTarget] = useState<{ postId: string; commentId: string } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ============================================
  // Fetch categories (action guidelines)
  // ============================================
  useEffect(() => {
    if (!companyId) return
    if (cached) return // キャッシュ済みならスキップ
    fetchWithRetry(() =>
      supabase
        .from('brand_personas')
        .select('action_guidelines')
        .eq('company_id', companyId)
        .order('sort_order')
        .limit(1)
    ).then(({ data }) => {
      let cats = ['未分類']
      if (data && Array.isArray(data) && data.length > 0) {
        const first = data[0] as Record<string, unknown>
        const guidelines = (first.action_guidelines as ActionGuideline[]) || []
        const titles = guidelines.map(g => g.title).filter(Boolean)
        if (titles.length > 0) cats = titles
      }
      setCategories(cats)
      categoriesRef.current = cats
      // カテゴリが1つだけの場合は自動選択
      if (cats.length === 1) {
        setFormCategory(cats[0])
      }
      // キャッシュが既に存在する場合、カテゴリを更新
      const existingCache = getPageCache<TimelineCache>(cacheKey)
      if (existingCache) {
        setPageCache(cacheKey, { ...existingCache, categories: cats })
      }
    })
  }, [companyId, cacheKey])

  // ============================================
  // Fetch posts
  // ============================================
  const fetchPosts = useCallback(async (offset = 0, append = false) => {
    if (!companyId || !user?.id) return

    try {
      const { data: postsData, error: postsError } = await supabase
        .from('timeline_posts')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)

      if (postsError || !postsData || postsData.length === 0) {
        if (!append) setPosts([])
        setLoading(false)
        setHasMore(false)
        return
      }

      const userIds = [...new Set(postsData.map((p: Record<string, unknown>) => p.user_id as string))]
      const postIds = postsData.map((p: Record<string, unknown>) => p.id as string)

      // サブクエリを並列実行（1つ失敗しても他は続行）
      const [membersResult, likeCountsResult, userLikesResult, commentCountsResult] = await Promise.allSettled([
        supabase
          .from('members')
          .select('auth_id, display_name, profile:profiles(name, photo_url, position)')
          .in('auth_id', userIds)
          .eq('company_id', companyId),
        supabase
          .from('timeline_likes')
          .select('post_id')
          .in('post_id', postIds),
        supabase
          .from('timeline_likes')
          .select('post_id')
          .eq('user_id', user.id)
          .in('post_id', postIds),
        supabase
          .from('timeline_comments')
          .select('post_id')
          .in('post_id', postIds),
      ])

      // メンバープロフィール
      const memberMap = new Map<string, { display_name: string; profile: PostProfile | null }>()
      if (membersResult.status === 'fulfilled' && membersResult.value.data) {
        for (const m of membersResult.value.data) {
          const rec = m as Record<string, unknown>
          const profileRaw = rec.profile as { name: string; photo_url: string; position: string } | { name: string; photo_url: string; position: string }[] | null
          const profile = Array.isArray(profileRaw) ? profileRaw[0] ?? null : profileRaw
          memberMap.set(rec.auth_id as string, {
            display_name: (rec.display_name as string) || '',
            profile: profile ? {
              name: profile.name || null,
              photo_url: profile.photo_url || null,
              position: profile.position || null,
            } : null,
          })
        }
      }

      // いいね数
      const likeCountMap = new Map<string, number>()
      if (likeCountsResult.status === 'fulfilled' && likeCountsResult.value.data) {
        for (const l of likeCountsResult.value.data) {
          const pid = (l as Record<string, unknown>).post_id as string
          likeCountMap.set(pid, (likeCountMap.get(pid) || 0) + 1)
        }
      }

      // ユーザーのいいね
      const userLikeSet = new Set<string>()
      if (userLikesResult.status === 'fulfilled' && userLikesResult.value.data) {
        for (const l of userLikesResult.value.data) {
          userLikeSet.add((l as Record<string, unknown>).post_id as string)
        }
      }

      // コメント数
      const commentCountMap = new Map<string, number>()
      if (commentCountsResult.status === 'fulfilled' && commentCountsResult.value.data) {
        for (const c of commentCountsResult.value.data) {
          const pid = (c as Record<string, unknown>).post_id as string
          commentCountMap.set(pid, (commentCountMap.get(pid) || 0) + 1)
        }
      }

      // 投稿オブジェクト構築
      const newPosts: TimelinePost[] = postsData.map((p: unknown) => {
        const rec = p as Record<string, unknown>
        const userId = rec.user_id as string
        const memberInfo = memberMap.get(userId)
        return {
          id: rec.id as string,
          user_id: userId,
          content: rec.content as string,
          images: (rec.images as string[]) || [],
          category: rec.category as string,
          is_anonymous: rec.is_anonymous as boolean,
          created_at: rec.created_at as string,
          updated_at: rec.updated_at as string,
          profile: memberInfo?.profile || null,
          member_display_name: memberInfo?.display_name || null,
          like_count: likeCountMap.get(rec.id as string) || 0,
          comment_count: commentCountMap.get(rec.id as string) || 0,
          is_liked: userLikeSet.has(rec.id as string),
        }
      })

      if (append) {
        setPosts(prev => {
          const merged = [...prev, ...newPosts]
          setPageCache(cacheKey, { categories: categoriesRef.current, posts: merged })
          return merged
        })
      } else {
        setPosts(newPosts)
        setPageCache(cacheKey, { categories: categoriesRef.current, posts: newPosts })
      }
      setHasMore(newPosts.length === PAGE_SIZE)
    } catch (err) {
      console.error('[Timeline] fetchPosts error:', err)
      if (!append) setPosts([])
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, user?.id])

  useEffect(() => {
    if (companyId && user?.id && !getPageCache<TimelineCache>(cacheKey)) {
      fetchPosts()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, user?.id, fetchPosts])

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

      // Reset form
      resetForm()
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
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ============================================
  // Delete post
  // ============================================
  const handleDelete = async () => {
    if (!deleteTargetId) return
    setDeleting(true)
    try {
      // Find the post to clean up images
      const post = posts.find(p => p.id === deleteTargetId)
      if (post && post.images.length > 0 && companyId) {
        // Clean up storage images
        const paths = post.images.map(url => {
          const match = url.match(/timeline-images\/(.+)$/)
          return match ? match[1] : null
        }).filter(Boolean) as string[]
        if (paths.length > 0) {
          await supabase.storage.from('timeline-images').remove(paths)
        }
      }

      const { error } = await supabase
        .from('timeline_posts')
        .delete()
        .eq('id', deleteTargetId)

      if (error) throw error

      setPosts(prev => prev.filter(p => p.id !== deleteTargetId))
      toast.success('投稿を削除しました')
    } catch (err) {
      console.error('Delete error:', err)
      toast.error('削除に失敗しました')
    } finally {
      setDeleting(false)
      setDeleteTargetId(null)
    }
  }

  // ============================================
  // Like toggle
  // ============================================
  const toggleLike = async (postId: string) => {
    if (!user || !companyId) return

    const post = posts.find(p => p.id === postId)
    if (!post) return

    const wasLiked = post.is_liked

    // Optimistic update
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, is_liked: !wasLiked, like_count: wasLiked ? p.like_count - 1 : p.like_count + 1 }
        : p
    ))

    try {
      if (wasLiked) {
        const { error } = await supabase
          .from('timeline_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('timeline_likes')
          .insert({ post_id: postId, user_id: user.id, company_id: companyId })
        if (error) throw error
      }
    } catch {
      // Rollback
      setPosts(prev => prev.map(p =>
        p.id === postId
          ? { ...p, is_liked: wasLiked, like_count: wasLiked ? p.like_count : p.like_count - 1 }
          : p
      ))
    }
  }

  // ============================================
  // Comments
  // ============================================
  const toggleComments = async (postId: string) => {
    setExpandedComments(prev => {
      const next = new Set(prev)
      if (next.has(postId)) {
        next.delete(postId)
      } else {
        next.add(postId)
        // Load comments if not loaded
        if (!commentsByPost[postId]) {
          loadComments(postId)
        }
      }
      return next
    })
  }

  const loadComments = async (postId: string) => {
    if (!companyId) return
    const { data } = await fetchWithRetry(() =>
      supabase
        .from('timeline_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })
    )

    if (!data || !Array.isArray(data)) {
      setCommentsByPost(prev => ({ ...prev, [postId]: [] }))
      return
    }

    // Fetch commenter profiles
    const userIds = [...new Set(data.map((c: Record<string, unknown>) => c.user_id as string))]
    const { data: membersData } = await fetchWithRetry(() =>
      supabase
        .from('members')
        .select('auth_id, display_name, profile:profiles(name, photo_url)')
        .in('auth_id', userIds)
        .eq('company_id', companyId)
    )

    const profileMap = new Map<string, { name: string | null; photo_url: string | null }>()
    if (membersData && Array.isArray(membersData)) {
      for (const m of membersData) {
        const rec = m as Record<string, unknown>
        const profileRaw = rec.profile as { name: string; photo_url: string } | { name: string; photo_url: string }[] | null
        const profile = Array.isArray(profileRaw) ? profileRaw[0] ?? null : profileRaw
        profileMap.set(rec.auth_id as string, {
          name: profile?.name || (rec.display_name as string) || null,
          photo_url: profile?.photo_url || null,
        })
      }
    }

    const comments: TimelineComment[] = data.map((c: unknown) => {
      const rec = c as Record<string, unknown>
      const uid = rec.user_id as string
      const info = profileMap.get(uid)
      return {
        id: rec.id as string,
        user_id: uid,
        content: rec.content as string,
        created_at: rec.created_at as string,
        profile_name: info?.name || null,
        profile_photo_url: info?.photo_url || null,
      }
    })

    setCommentsByPost(prev => ({ ...prev, [postId]: comments }))
  }

  const submitComment = async (postId: string) => {
    const text = commentInputs[postId]?.trim()
    if (!text || !user || !companyId) return

    setCommentSubmitting(prev => ({ ...prev, [postId]: true }))
    try {
      const { error } = await supabase
        .from('timeline_comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          company_id: companyId,
          content: text,
        })

      if (error) throw error

      setCommentInputs(prev => ({ ...prev, [postId]: '' }))

      // Update comment count
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p
      ))

      // Reload comments
      await loadComments(postId)
    } catch {
      toast.error('コメントの投稿に失敗しました')
    } finally {
      setCommentSubmitting(prev => ({ ...prev, [postId]: false }))
    }
  }

  const handleDeleteComment = async () => {
    if (!deleteCommentTarget) return
    const { postId, commentId } = deleteCommentTarget

    try {
      const { error } = await supabase
        .from('timeline_comments')
        .delete()
        .eq('id', commentId)

      if (error) throw error

      // Update comment count
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, comment_count: Math.max(0, p.comment_count - 1) } : p
      ))

      // Remove from local state
      setCommentsByPost(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).filter(c => c.id !== commentId),
      }))

      toast.success('コメントを削除しました')
    } catch {
      toast.error('コメントの削除に失敗しました')
    } finally {
      setDeleteCommentTarget(null)
    }
  }

  // ============================================
  // Filtered posts
  // ============================================
  const filteredPosts = useMemo(() => {
    let result = posts
    if (filterCategory !== 'all') {
      result = result.filter(p => p.category === filterCategory)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(p => {
        const name = p.is_anonymous ? '' : (p.profile?.name || p.member_display_name || '').toLowerCase()
        return p.content.toLowerCase().includes(q) ||
          name.includes(q) ||
          p.category.toLowerCase().includes(q)
      })
    }
    return result
  }, [posts, filterCategory, searchQuery])

  // ============================================
  // Render
  // ============================================
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-5 pt-4 pb-6 space-y-6">
        <div>
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72 mt-2" />
        </div>
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-24 w-full rounded-md" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-[200px]" />
              <Skeleton className="h-8 w-16" />
            </div>
          </CardContent>
        </Card>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="bg-[hsl(0_0%_97%)] border shadow-none">
              <CardContent className="p-5">
                <div className="flex items-start gap-3 mb-3">
                  <Skeleton className="size-9 rounded-full shrink-0" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-28 mb-1" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-5 w-20 rounded-full mb-3" />
                <Skeleton className="h-16 w-full mb-3" />
                <div className="flex gap-4 pt-2 border-t border-border">
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-4 w-10" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-5 pt-4 pb-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Good Job タイムライン</h1>
        <p className="text-sm text-muted-foreground">
          行動指針に基づく取り組みを共有し、互いに称賛しましょう
        </p>
      </div>

      {/* ============================================ */}
      {/* Post Form */}
      {/* ============================================ */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5 space-y-4">
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
              {formAnonymous ? '匿名メンバー' : (profileName || member?.display_name || '')}
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
                    <X className="size-3" />
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
                    <X className="size-3" />
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
              <Button variant="outline" size="sm" onClick={resetForm}>
                キャンセル
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ============================================ */}
      {/* Category Filter */}
      {/* ============================================ */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filterCategory === 'all'
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              すべて
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filterCategory === cat
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
        <div className="relative sm:ml-auto sm:w-[240px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="投稿を検索..."
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* ============================================ */}
      {/* Posts list */}
      {/* ============================================ */}
      {filteredPosts.length === 0 ? (
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground text-[15px] m-0">
              まだ投稿がありません。最初のGood Jobを共有しましょう！
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={user?.id || ''}
              isAdmin={isAdmin}
              onLike={() => toggleLike(post.id)}
              onToggleComments={() => toggleComments(post.id)}
              onEdit={() => startEdit(post)}
              onDelete={() => setDeleteTargetId(post.id)}
              onImageClick={setDialogImage}
              isCommentsExpanded={expandedComments.has(post.id)}
              comments={commentsByPost[post.id]}
              commentInput={commentInputs[post.id] || ''}
              onCommentInputChange={(val) => setCommentInputs(prev => ({ ...prev, [post.id]: val }))}
              onCommentSubmit={() => submitComment(post.id)}
              commentSubmitting={commentSubmitting[post.id] || false}
              onDeleteComment={(commentId) => setDeleteCommentTarget({ postId: post.id, commentId })}
            />
          ))}

          {/* Load more */}
          {hasMore && filterCategory === 'all' && (
            <div className="text-center pt-2">
              <Button
                variant="outline"
                onClick={() => fetchPosts(posts.length, true)}
              >
                もっと見る
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* Image Dialog */}
      {/* ============================================ */}
      <Dialog open={!!dialogImage} onOpenChange={() => setDialogImage(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 bg-transparent border-none shadow-none">
          <DialogTitle className="sr-only">画像拡大表示</DialogTitle>
          {dialogImage && (
            <img
              src={dialogImage}
              alt="拡大表示"
              className="max-w-full max-h-[85vh] object-contain rounded-lg mx-auto"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ============================================ */}
      {/* Delete Post Confirm Dialog */}
      {/* ============================================ */}
      <Dialog open={!!deleteTargetId} onOpenChange={() => setDeleteTargetId(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>投稿を削除</DialogTitle>
          <p className="text-sm text-muted-foreground">
            この投稿を削除しますか？この操作は取り消せません。
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setDeleteTargetId(null)}>
              キャンセル
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? '削除中...' : '削除する'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============================================ */}
      {/* Delete Comment Confirm Dialog */}
      {/* ============================================ */}
      <Dialog open={!!deleteCommentTarget} onOpenChange={() => setDeleteCommentTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>コメントを削除</DialogTitle>
          <p className="text-sm text-muted-foreground">
            このコメントを削除しますか？
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setDeleteCommentTarget(null)}>
              キャンセル
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteComment}>
              削除する
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================
// PostCard Component
// ============================================

type PostCardProps = {
  post: TimelinePost
  currentUserId: string
  isAdmin: boolean
  onLike: () => void
  onToggleComments: () => void
  onEdit: () => void
  onDelete: () => void
  onImageClick: (url: string) => void
  isCommentsExpanded: boolean
  comments: TimelineComment[] | undefined
  commentInput: string
  onCommentInputChange: (val: string) => void
  onCommentSubmit: () => void
  commentSubmitting: boolean
  onDeleteComment: (commentId: string) => void
}

function PostCard({
  post,
  currentUserId,
  isAdmin,
  onLike,
  onToggleComments,
  onEdit,
  onDelete,
  onImageClick,
  isCommentsExpanded,
  comments,
  commentInput,
  onCommentInputChange,
  onCommentSubmit,
  commentSubmitting,
  onDeleteComment,
}: PostCardProps) {
  const isOwner = post.user_id === currentUserId
  const canDelete = isOwner || isAdmin
  const canEdit = isOwner

  const displayName = post.is_anonymous
    ? '匿名メンバー'
    : post.profile?.name || post.member_display_name || '不明'
  const displayPhoto = post.is_anonymous ? null : post.profile?.photo_url
  const displayPosition = post.is_anonymous ? null : post.profile?.position

  return (
    <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <Avatar className="size-9 shrink-0">
            {displayPhoto && <AvatarImage src={displayPhoto} alt={displayName} />}
            <AvatarFallback className="bg-muted text-muted-foreground text-xs">
              {post.is_anonymous ? <UserRound className="size-4" /> : displayName.slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground truncate">{displayName}</span>
              {displayPosition && (
                <span className="text-xs text-muted-foreground truncate">{displayPosition}</span>
              )}
            </div>
            <span className="text-xs text-muted-foreground" suppressHydrationWarning>{getRelativeTime(post.created_at)}</span>
          </div>

          {/* Actions menu */}
          {(canEdit || canDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8 shrink-0">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && (
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="size-4 mr-2" />
                    編集
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash2 className="size-4 mr-2" />
                    削除
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Category badge */}
        <div className="mb-3">
          <Badge variant="secondary" className="text-xs bg-neutral-200 text-neutral-700">
            {post.category}
          </Badge>
        </div>

        {/* Content */}
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap m-0 mb-3">
          {post.content}
        </p>

        {/* Images */}
        {post.images && post.images.length > 0 && (
          <div className="mb-3">
            {post.images.length === 1 && (
              <img
                src={post.images[0]}
                alt=""
                onClick={() => onImageClick(post.images[0])}
                className="w-full aspect-video object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
              />
            )}
            {post.images.length === 2 && (
              <div className="grid grid-cols-2 gap-1 h-[280px]">
                {post.images.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt=""
                    onClick={() => onImageClick(url)}
                    className="w-full h-full object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                  />
                ))}
              </div>
            )}
            {post.images.length === 3 && (
              <div className="grid grid-cols-3 gap-1">
                <img
                  src={post.images[0]}
                  alt=""
                  onClick={() => onImageClick(post.images[0])}
                  className="col-span-2 w-full h-[320px] object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                />
                <div className="flex flex-col gap-1">
                  <img
                    src={post.images[1]}
                    alt=""
                    onClick={() => onImageClick(post.images[1])}
                    className="w-full h-[159px] object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                  />
                  <img
                    src={post.images[2]}
                    alt=""
                    onClick={() => onImageClick(post.images[2])}
                    className="w-full h-[157px] object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center gap-4 pt-2 border-t border-border">
          <button
            onClick={onLike}
            className={`flex items-center gap-1.5 text-xs transition-colors ${
              post.is_liked
                ? 'text-red-500'
                : 'text-muted-foreground hover:text-red-500'
            }`}
          >
            <Heart className={`size-4 ${post.is_liked ? 'fill-current' : ''}`} />
            <span>{post.like_count > 0 ? post.like_count : ''}</span>
          </button>
          <button
            onClick={onToggleComments}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageCircle className="size-4" />
            <span>{post.comment_count > 0 ? post.comment_count : ''}</span>
          </button>
        </div>

        {/* Comments section */}
        {isCommentsExpanded && (
          <div className="mt-4 pt-3 border-t border-border space-y-3">
            {/* Comment list */}
            {comments === undefined ? (
              <p className="text-xs text-muted-foreground m-0">読み込み中...</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-muted-foreground m-0">まだコメントはありません</p>
            ) : (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-2.5">
                    <Avatar className="size-7 shrink-0">
                      {comment.profile_photo_url && (
                        <AvatarImage src={comment.profile_photo_url} alt={comment.profile_name || ''} />
                      )}
                      <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
                        {comment.profile_name?.slice(0, 1) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          {comment.profile_name || '不明'}
                        </span>
                        <span className="text-[11px] text-muted-foreground" suppressHydrationWarning>
                          {getRelativeTime(comment.created_at)}
                        </span>
                        {(comment.user_id === currentUserId || isAdmin) && (
                          <button
                            onClick={() => onDeleteComment(comment.id)}
                            className="text-[11px] text-muted-foreground hover:text-destructive transition-colors ml-auto"
                          >
                            削除
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-foreground/80 leading-relaxed m-0 mt-0.5">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Comment input */}
            <div className="flex gap-2 items-center">
              <Input
                placeholder="コメントを入力..."
                value={commentInput}
                onChange={(e) => onCommentInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && commentInput.trim()) {
                    e.preventDefault()
                    onCommentSubmit()
                  }
                }}
                className="flex-1 h-9 text-sm bg-background"
              />
              <Button
                size="icon"
                className="size-9 shrink-0"
                disabled={!commentInput.trim() || commentSubmitting}
                onClick={onCommentSubmit}
              >
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
