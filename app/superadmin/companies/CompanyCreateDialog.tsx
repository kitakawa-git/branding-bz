'use client'

// 新規企業登録モーダル（企業一覧の FAB から開く）
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import CompanyCreateForm from './_components/CompanyCreateForm'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void // 作成成功後に一覧を再取得
}

export function CompanyCreateDialog({ open, onOpenChange, onCreated }: Props) {
  const handleSuccess = () => {
    onOpenChange(false)
    onCreated()
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新規企業を登録</DialogTitle>
        </DialogHeader>

        {/* CompanyCreateForm を再利用。onSuccess / onCancel を渡すとモーダルモードで動作 */}
        <CompanyCreateForm onSuccess={handleSuccess} onCancel={handleCancel} />
      </DialogContent>
    </Dialog>
  )
}
