// 目標の編集ダイアログ（テキストのみ）
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
}

export function GoalEditDialog({ goalEditOpen, setGoalEditOpen, goalEditText, setGoalEditText, saving, handleGoalEditSave }: Props) {
  return (
    <Dialog open={goalEditOpen} onOpenChange={setGoalEditOpen}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogTitle>目標を編集</DialogTitle>
        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-xs font-bold mb-1.5 block">目標</Label>
            <Textarea value={goalEditText} onChange={e => setGoalEditText(e.target.value)} rows={3} className="resize-none" placeholder="ブランドにどう貢献するかを宣言..." />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <Button onClick={handleGoalEditSave} disabled={saving || !goalEditText.trim()} className="min-w-[100px]">{saving ? '保存中...' : '保存する'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
