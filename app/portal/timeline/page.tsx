'use client'

// Good Action投稿
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchPhilosophy } from '@/lib/brand/philosophy'
import { usePortalAuth } from '../components/PortalDataProvider'
import { isFeatureEnabled } from '@/lib/constants/feature-toggles'
import { isPortalPageVisibleForRole } from '@/lib/constants/member-roles'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { toast } from 'sonner'
import { PlanUpsell } from '@/components/billing/plan-gate'
import { can } from '@/lib/billing/entitlements'
import { useRegisterPortalSearch } from '@/components/portal/portal-search'
import { PostProfile, TimelinePost } from './_components/PostCard'
import { usePostComposer } from './_components/usePostComposer'
import { useTimelineComments } from './_components/useTimelineComments'
import { PostComposer } from './_components/PostComposer'
import { CategoryFilter } from './_components/CategoryFilter'
import { PostList } from './_components/PostList'
import { ImageDialog, DeletePostDialog, DeleteCommentDialog } from './_components/TimelineDialogs'
import { TimelineNotice, TimelineSkeleton } from './_components/TimelineStates'

const PAGE_SIZE = 20

// ============================================
// Main Page Component
// ============================================

type TimelineCache = { categories: string[]; posts: TimelinePost[] }

export default function PortalTimelinePage() {
  const { companyId, user, member, profileName, profilePhotoUrl, isAdmin, company, roleCategory } = usePortalAuth()

  // 機能トグル: タイムラインが無効なら案内のみ表示（リダイレクトはしない）
  const timelineEnabled = isFeatureEnabled(company, 'timeline_enabled')

  // Data states
  const cacheKey = `portal-timeline-${companyId}`
  const cached = companyId ? getPageCache<TimelineCache>(cacheKey, { persist: true }) : null
  const [categories, setCategories] = useState<string[]>(cached?.categories ?? [])
  const categoriesRef = useRef<string[]>(cached?.categories ?? [])
  const [posts, setPosts] = useState<TimelinePost[]>(cached?.posts ?? [])
  const [loading, setLoading] = useState(!cached)
  const [hasMore, setHasMore] = useState(true)

  // Filter
  const [filterCategory, setFilterCategory] = useState<string>('all')
  // 検索フィールドはヘッダーの虫眼鏡。ここでは入力された文字列だけを受け取る
  const searchQuery = useRegisterPortalSearch('投稿を検索...')

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
          setPageCache(cacheKey, { categories: categoriesRef.current, posts: merged }, { persist: true })
          return merged
        })
      } else {
        setPosts(newPosts)
        setPageCache(cacheKey, { categories: categoriesRef.current, posts: newPosts }, { persist: true })
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

  // 投稿フォーム（モーダル）: 状態・画像選択・投稿/編集処理
  const {
    formContent, setFormContent, formCategory, setFormCategory, formAnonymous, setFormAnonymous,
    formImages, formImagePreviews, posting, composerOpen, setComposerOpen, editingPostId, editExistingImages,
    fileInputRef, handleImageSelect, removeImage, removeExistingImage, handleSubmit, resetForm, startEdit,
  } = usePostComposer({ companyId, user, fetchPosts })

  // Image dialog
  const [dialogImage, setDialogImage] = useState<string | null>(null)

  // Delete confirm
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // コメント: 開閉・読み込み・投稿・削除
  const {
    expandedComments, commentsByPost, commentInputs, setCommentInputs, commentSubmitting,
    deleteCommentTarget, setDeleteCommentTarget, toggleComments, submitComment, handleDeleteComment,
  } = useTimelineComments({ companyId, user, setPosts })

  // ============================================
  // Fetch categories (action guidelines)
  // ============================================
  useEffect(() => {
    if (!companyId) return
    // 再読込前の保存分（表示用）ではなく、この読み込み以降に取得済みのときだけスキップ（lib/page-cache.ts）
    if (getPageCache<TimelineCache>(cacheKey)) return
    fetchPhilosophy(supabase, companyId).then((phil) => {
      let cats = ['未分類']
      const titles = phil.action_guidelines.map(g => g.title).filter(Boolean)
      if (titles.length > 0) cats = titles
      setCategories(cats)
      categoriesRef.current = cats
      // カテゴリが1つだけの場合は自動選択
      if (cats.length === 1) {
        setFormCategory(cats[0])
      }
      // キャッシュが既に存在する場合、カテゴリを更新
      const existingCache = getPageCache<TimelineCache>(cacheKey)
      if (existingCache) {
        setPageCache(cacheKey, { ...existingCache, categories: cats }, { persist: true })
      }
    })
  // setFormCategory は useState のセッター（参照は不変）。カスタムフック経由のため依存に明示
  }, [companyId, cacheKey, setFormCategory])

  useEffect(() => {
    if (companyId && user?.id && !getPageCache<TimelineCache>(cacheKey)) {
      fetchPosts()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, user?.id, fetchPosts])

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

      // RLS 0行対策: 弾かれても error は null なので影響行で判定する
      const { data, error } = await supabase
        .from('timeline_posts')
        .delete()
        .eq('id', deleteTargetId)
        .select('id')

      if (error) throw error
      if (!data?.length) {
        toast.error('削除する権限がありません')
        return
      }

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
        // RLS 0行対策: 弾かれても error は null なので影響行で判定する。
        // 0 件なら下の catch と同じくロールバックさせたいので throw に寄せる
        const { data, error } = await supabase
          .from('timeline_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .select('post_id')
        if (error) throw error
        if (!data?.length) throw new Error('削除する権限がありません')
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
  // 機能トグルがオフ: 内容は表示せず、案内のみ（URL直打ち時に状況が分かるように）
  if (!timelineEnabled) {
    return <TimelineNotice message="この機能は現在ご利用いただけません" />
  }

  // 区分ごとの表示設定で非表示（URL直打ち時の防御）
  // プラン外: 隠さずアップセル面を出す（実効プランで判定）
  if (!can(company, 'timeline')) {
    return (
      <div className="max-w-4xl mx-auto px-5 pt-4 pb-10">
        <PlanUpsell
          readOnly={!isAdmin}
          company={company}
          feature="timeline"
          title="Good Action投稿を使うには"
          benefits={[
            '行動指針に沿った取り組みを社内でシェア',
            'いいね・コメントで称え合う',
            '行動指針別に投稿を集計',
            'ブランドを体現する文化を育てる',
          ]}
        />
      </div>
    )
  }

  if (!isPortalPageVisibleForRole(company, 'timeline', roleCategory, isAdmin)) {
    return <TimelineNotice message="このページはご利用の区分では表示されません" />
  }

  if (loading) {
    return <TimelineSkeleton showCategoryPills={categories.length > 1} />
  }

  return (
    <div className="max-w-4xl mx-auto px-5 pt-4 pb-10 space-y-6">
      {/* Post Form (右下FAB + モーダル) */}
      <PostComposer
        categories={categories}
        profileName={profileName}
        profilePhotoUrl={profilePhotoUrl}
        memberDisplayName={member?.display_name}
        composerOpen={composerOpen}
        setComposerOpen={setComposerOpen}
        resetForm={resetForm}
        editingPostId={editingPostId}
        formContent={formContent}
        setFormContent={setFormContent}
        formCategory={formCategory}
        setFormCategory={setFormCategory}
        formAnonymous={formAnonymous}
        setFormAnonymous={setFormAnonymous}
        formImages={formImages}
        formImagePreviews={formImagePreviews}
        editExistingImages={editExistingImages}
        posting={posting}
        fileInputRef={fileInputRef}
        handleImageSelect={handleImageSelect}
        removeImage={removeImage}
        removeExistingImage={removeExistingImage}
        handleSubmit={handleSubmit}
      />

      {/* Category Filter */}
      <CategoryFilter
        categories={categories}
        filterCategory={filterCategory}
        setFilterCategory={setFilterCategory}
      />

      {/* Posts list */}
      <PostList
        filteredPosts={filteredPosts}
        currentUserId={user?.id}
        isAdmin={isAdmin}
        hasMore={hasMore}
        filterCategory={filterCategory}
        onLoadMore={() => fetchPosts(posts.length, true)}
        toggleLike={toggleLike}
        toggleComments={toggleComments}
        startEdit={startEdit}
        setDeleteTargetId={setDeleteTargetId}
        setDialogImage={setDialogImage}
        expandedComments={expandedComments}
        commentsByPost={commentsByPost}
        commentInputs={commentInputs}
        setCommentInputs={setCommentInputs}
        submitComment={submitComment}
        commentSubmitting={commentSubmitting}
        setDeleteCommentTarget={setDeleteCommentTarget}
      />

      {/* Dialogs: 画像拡大 / 投稿削除確認 / コメント削除確認 */}
      <ImageDialog dialogImage={dialogImage} setDialogImage={setDialogImage} />
      <DeletePostDialog
        deleteTargetId={deleteTargetId}
        setDeleteTargetId={setDeleteTargetId}
        handleDelete={handleDelete}
        deleting={deleting}
      />
      <DeleteCommentDialog
        deleteCommentTarget={deleteCommentTarget}
        setDeleteCommentTarget={setDeleteCommentTarget}
        handleDeleteComment={handleDeleteComment}
      />
    </div>
  )
}
