'use client'

import { getRelativeTime } from '@/lib/time-utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Heart,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Trash2,
  Send,
  UserRound,
} from 'lucide-react'

// ============================================
// Types
// ============================================

export type PostProfile = {
  name: string | null
  photo_url: string | null
  position: string | null
}

export type TimelinePost = {
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

export type TimelineComment = {
  id: string
  user_id: string
  content: string
  created_at: string
  profile_name: string | null
  profile_photo_url: string | null
}

// ============================================
// PostCard Component
// ============================================

export type PostCardProps = {
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

export function PostCard({
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
      {/* ⚠️ p-3 と書くと globals.css のカード統一ルールで 16px に上書きされる。
          12px にしたいので方向指定（px-3 py-3）で書く＝ルールの除外条件に当たる */}
      <CardContent className="px-3 py-3">
        {/* Header */}
        <div className="flex items-start gap-3 mb-2">
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
                <Button variant="ghost" size="icon" className="size-11 shrink-0">
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
          <Badge variant="secondary" className="text-xs bg-gray-200 text-gray-700">
            {post.category}
          </Badge>
        </div>

        {/* Content */}
        <p className="text-base text-foreground/80 leading-relaxed whitespace-pre-wrap m-0 mb-3">
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
        <div className="flex items-center gap-4">
          <button
            onClick={onLike}
            className={`flex items-center gap-1.5 min-h-11 md:min-h-9 text-sm transition-colors ${
              post.is_liked
                ? 'text-red-500'
                : 'text-muted-foreground hover:text-red-500'
            }`}
          >
            <Heart className={`size-5 ${post.is_liked ? 'fill-current' : ''}`} />
            <span>{post.like_count > 0 ? post.like_count : ''}</span>
          </button>
          <button
            onClick={onToggleComments}
            className="flex items-center gap-1.5 min-h-11 md:min-h-9 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageCircle className="size-5" />
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
                      <p className="text-base text-foreground/80 leading-relaxed m-0 mt-0.5">
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
                className="flex-1 h-11 bg-background"
              />
              <Button
                size="icon"
                className="size-11 shrink-0"
                disabled={!commentInput.trim() || commentSubmitting}
                onClick={onCommentSubmit}
              >
                <Send className="size-5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
