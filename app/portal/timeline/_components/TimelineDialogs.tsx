// 画像拡大・投稿削除確認・コメント削除確認の各ダイアログ
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'

// ============================================
// Image Dialog
// ============================================
type ImageDialogProps = {
  dialogImage: string | null
  setDialogImage: (url: string | null) => void
}

export function ImageDialog({ dialogImage, setDialogImage }: ImageDialogProps) {
  return (
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
  )
}

// ============================================
// Delete Post Confirm Dialog
// ============================================
type DeletePostDialogProps = {
  deleteTargetId: string | null
  setDeleteTargetId: (postId: string | null) => void
  handleDelete: () => void
  deleting: boolean
}

export function DeletePostDialog({ deleteTargetId, setDeleteTargetId, handleDelete, deleting }: DeletePostDialogProps) {
  return (
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
  )
}

// ============================================
// Delete Comment Confirm Dialog
// ============================================
type DeleteCommentDialogProps = {
  deleteCommentTarget: { postId: string; commentId: string } | null
  setDeleteCommentTarget: (target: { postId: string; commentId: string } | null) => void
  handleDeleteComment: () => void
}

export function DeleteCommentDialog({ deleteCommentTarget, setDeleteCommentTarget, handleDeleteComment }: DeleteCommentDialogProps) {
  return (
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
  )
}
