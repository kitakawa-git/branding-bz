'use client'

// ニュース新規作成モーダル（一覧ページの FAB から開く）
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import NewsForm from './_components/NewsForm'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void // 作成成功後に一覧を再取得
}

export function NewsCreateDialog({ open, onOpenChange, onCreated }: Props) {
  const handleSuccess = () => {
    onOpenChange(false)
    onCreated()
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ニュース新規作成</DialogTitle>
        </DialogHeader>

        {/* NewsForm を再利用。onSuccess / onCancel を渡すとモーダルモードで動作 */}
        <NewsForm onSuccess={handleSuccess} onCancel={handleCancel} />
      </DialogContent>
    </Dialog>
  )
}
