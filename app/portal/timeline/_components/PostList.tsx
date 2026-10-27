// 投稿一覧（空状態・投稿カード・もっと見る）の表示部分
import type { Dispatch, SetStateAction } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TimelinePost, TimelineComment, PostCard } from './PostCard'

type PostListProps = {
  filteredPosts: TimelinePost[]
  currentUserId: string | undefined
  isAdmin: boolean
  hasMore: boolean
  filterCategory: string
  onLoadMore: () => void
  toggleLike: (postId: string) => void
  toggleComments: (postId: string) => void
  startEdit: (post: TimelinePost) => void
  setDeleteTargetId: (postId: string) => void
  setDialogImage: (url: string) => void
  expandedComments: Set<string>
  commentsByPost: Record<string, TimelineComment[]>
  commentInputs: Record<string, string>
  setCommentInputs: Dispatch<SetStateAction<Record<string, string>>>
  submitComment: (postId: string) => void
  commentSubmitting: Record<string, boolean>
  setDeleteCommentTarget: (target: { postId: string; commentId: string }) => void
}

export function PostList({
  filteredPosts,
  currentUserId,
  isAdmin,
  hasMore,
  filterCategory,
  onLoadMore,
  toggleLike,
  toggleComments,
  startEdit,
  setDeleteTargetId,
  setDialogImage,
  expandedComments,
  commentsByPost,
  commentInputs,
  setCommentInputs,
  submitComment,
  commentSubmitting,
  setDeleteCommentTarget,
}: PostListProps) {
  return filteredPosts.length === 0 ? (
    <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
      <CardContent className="py-16 text-center">
        <p className="text-muted-foreground text-[15px] m-0">
          まだ投稿がありません。最初のGood Actionを共有しましょう！
        </p>
      </CardContent>
    </Card>
  ) : (
    // 投稿カード間は12px（space-y-3）
    <div className="space-y-3">
      {filteredPosts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={currentUserId || ''}
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
            onClick={onLoadMore}
          >
            もっと見る
          </Button>
        </div>
      )}
    </div>
  )
}
