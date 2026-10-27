'use client'

// 会社目標・チーム目標の1行（タイトル・補足・つながる上位目標・編集／削除）
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Pencil, Trash2, CornerLeftUp } from 'lucide-react'
import type { Goal } from '@/lib/goals/types'

type Props = {
  goal: Goal
  /** つながる上位目標のタイトル（チーム目標 → 会社目標） */
  parentTitle?: string | null
  editable: boolean
  onEdit?: () => void
  onDelete?: () => void
}

export function GoalItem({ goal, parentTitle, editable, onEdit, onDelete }: Props) {
  return (
    <div className="flex items-start gap-2 rounded-lg border bg-background px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground m-0 leading-relaxed whitespace-pre-line">{goal.title}</p>
        {goal.description && <p className="text-xs text-muted-foreground m-0 mt-1 leading-relaxed whitespace-pre-line">{goal.description}</p>}
        {parentTitle && (
          <p className="text-[11px] text-muted-foreground m-0 mt-1.5 flex items-start gap-1">
            <CornerLeftUp size={12} className="shrink-0 mt-0.5" />
            <span>会社目標：{parentTitle}</span>
          </p>
        )}
      </div>
      {editable && (
        <div className="flex shrink-0 -mr-2 -my-1.5">
          <Button variant="ghost" size="icon" className="size-11" onClick={onEdit} aria-label="編集">
            <Pencil size={16} />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="size-11 text-destructive hover:text-destructive" aria-label="削除">
                <Trash2 size={16} />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>目標を削除しますか？</AlertDialogTitle>
                <AlertDialogDescription>
                  「{goal.title}」を削除します。この目標につないでいる下の目標は、つながりが外れます（目標自体は残ります）。この操作は取り消せません。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">削除する</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  )
}
