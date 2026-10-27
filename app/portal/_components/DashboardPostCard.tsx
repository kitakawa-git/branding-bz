'use client'

import Link from 'next/link'
import { getRelativeTime } from '@/lib/time-utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Heart,
  MessageCircle,
} from 'lucide-react'

export type DashboardPost = {
  id: string
  content: string
  category: string
  created_at: string
  is_anonymous: boolean
  like_count: number
  comment_count: number
  display_name: string | null
}

// ============================================
// Helpers
// ============================================

export function calculateCurrentStreak(posts: { created_at: string }[]): number {
  const dateSet = new Set(posts.map(p => p.created_at.slice(0, 10)))
  const sortedDates = [...dateSet].sort().reverse()

  if (sortedDates.length === 0) return 0

  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  if (sortedDates[0] !== today && sortedDates[0] !== yesterday) return 0

  let streak = 1
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1])
    const curr = new Date(sortedDates[i])
    const diffDays = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24)
    if (Math.round(diffDays) === 1) {
      streak++
    } else {
      break
    }
  }
  return streak
}

// ============================================
// Sub-component: DashboardPostCard
// ============================================

export function DashboardPostCard({
  post,
  showAuthor,
}: {
  post: DashboardPost
  showAuthor?: boolean
}) {
  return (
    <Link href="/portal/timeline" className="no-underline block">
      <Card className="border shadow-none hover:shadow-sm transition-shadow">
        <CardContent className="px-3 py-2.5">
          {showAuthor && !post.is_anonymous && post.display_name && (
            <p className="text-xs font-semibold text-foreground mb-1 m-0">
              {post.display_name}
            </p>
          )}
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {post.category}
            </Badge>
            <span
              className="text-[11px] text-muted-foreground"
              suppressHydrationWarning
            >
              {getRelativeTime(post.created_at)}
            </span>
          </div>
          <p className="text-base text-foreground/80 leading-relaxed line-clamp-2 m-0 whitespace-pre-wrap">
            {post.content}
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Heart
                size={14}
                className={post.like_count > 0 ? 'text-red-500' : ''}
              />
              {post.like_count > 0 && post.like_count}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle size={14} />
              {post.comment_count > 0 && post.comment_count}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
