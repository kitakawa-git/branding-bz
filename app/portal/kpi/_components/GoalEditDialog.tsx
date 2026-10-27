// 目標の編集ダイアログ（目標の文言 + つながり先）
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

type Props = {
  goalEditOpen: boolean
  setGoalEditOpen: (open: boolean) => void
  goalEditText: string
  setGoalEditText: (text: string) => void
  saving: boolean
  handleGoalEditSave: () => void
  /** つながるチーム目標・行動指針の入力欄（PersonalGoalLinkFields） */
  linkFields?: ReactNode
}

export function GoalEditDialog({ goalEditOpen, setGoalEditOpen, goalEditText, setGoalEditText, saving, handleGoalEditSave, linkFields }: Props) {
  return (
    <Dialog open={goalEditOpen} onOpenChange={setGoalEditOpen}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogTitle>目標を編集</DialogTitle>
        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-xs font-bold mb-1.5 block">目標</Label>
            <Textarea value={goalEditText} onChange={e => setGoalEditText(e.target.value)} rows={3} className="resize-none" placeholder="ブランドにどう貢献するかを宣言..." />
          </div>
          {linkFields}
        </div>
        <div className="flex justify-end mt-4">
          <Button onClick={handleGoalEditSave} disabled={saving || !goalEditText.trim()} className="min-w-[100px]">{saving ? '保存中...' : '保存する'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
