// 投稿コメントの開閉・読み込み・投稿・削除をまとめたフック
import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/supabase-fetch'
import { toast } from 'sonner'
import type { TimelinePost, TimelineComment } from './PostCard'

type UseTimelineCommentsArgs = {
  companyId: string | null
  user: User | null
  setPosts: Dispatch<SetStateAction<TimelinePost[]>>
}

export function useTimelineComments({ companyId, user, setPosts }: UseTimelineCommentsArgs) {
  // Comment states
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [commentsByPost, setCommentsByPost] = useState<Record<string, TimelineComment[]>>({})
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  const [commentSubmitting, setCommentSubmitting] = useState<Record<string, boolean>>({})

  // Delete comment confirm
  const [deleteCommentTarget, setDeleteCommentTarget] = useState<{ postId: string; commentId: string } | null>(null)

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
      // RLS 0行対策: 弾かれても error は null なので影響行で判定する
      const { data, error } = await supabase
        .from('timeline_comments')
        .delete()
        .eq('id', commentId)
        .select('id')

      if (error) throw error
      if (!data?.length) {
        toast.error('削除する権限がありません')
        return
      }

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

  return {
    expandedComments,
    commentsByPost,
    commentInputs,
    setCommentInputs,
    commentSubmitting,
    deleteCommentTarget,
    setDeleteCommentTarget,
    toggleComments,
    submitComment,
    handleDeleteComment,
  }
}
