'use client'

// 会社目標・チーム目標の作成／編集ダイアログ（管理画面とポータルのチームタブで共用）
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { goalsApi } from '@/lib/goals/client'
import { GOAL_LEVEL_LABELS, type Goal } from '@/lib/goals/types'

const NONE = 'none'

export type GoalFormTarget =
  | { mode: 'create'; level: 'company' }
  | { mode: 'create'; level: 'team'; teamId: string; teamName: string }
  | { mode: 'edit'; goal: Goal; teamName?: string }

type Props = {
  target: GoalFormTarget | null
  onClose: () => void
  /** チーム目標の親にできる会社目標（今の期間） */
  companyGoals: Goal[]
  onSaved: () => void
}

export function GoalFormDialog({ target, onClose, companyGoals, onSaved }: Props) {
  return (
    <Dialog open={!!target} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-[520px]">
        {/* 開くたびに入力欄を作り直す（前回の入力を残さない） */}
        {target && <GoalForm key={target.mode === 'edit' ? target.goal.id : `${target.level}-${'teamId' in target ? target.teamId : ''}`} target={target} companyGoals={companyGoals} onClose={onClose} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  )
}

function GoalForm({ target, companyGoals, onClose, onSaved }: { target: GoalFormTarget; companyGoals: Goal[]; onClose: () => void; onSaved: () => void }) {
  const editing = target.mode === 'edit' ? target.goal : null
  const level = editing ? editing.level : (target as { level: 'company' | 'team' }).level
  const teamName = target.mode === 'edit' ? target.teamName : target.level === 'team' ? target.teamName : undefined

  const [title, setTitle] = useState(editing?.title ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [parentId, setParentId] = useState(editing?.parent_goal_id ?? NONE)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title.trim()) { toast.error('目標を入力してください'); return }
    setSaving(true)
    try {
      const fields = {
        title: title.trim(),
        description: description.trim() || null,
        ...(level === 'team' ? { parent_goal_id: parentId === NONE ? null : parentId } : {}),
      }
      if (editing) {
        await goalsApi(`/api/goals/${editing.id}`, 'PATCH', fields)
      } else {
        await goalsApi('/api/goals', 'POST', {
          ...fields,
          level,
          ...(target.mode === 'create' && target.level === 'team' ? { team_id: target.teamId } : {}),
        })
      }
      toast.success(editing ? '目標を更新しました' : '目標を作成しました')
      onClose()
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <DialogTitle>
        {GOAL_LEVEL_LABELS[level]}を{editing ? '編集' : '作成'}{teamName ? `（${teamName}）` : ''}
      </DialogTitle>
      <div className="space-y-4 mt-2">
        <div>
          <Label className="text-xs font-bold mb-1.5 block">目標</Label>
          <Textarea value={title} onChange={e => setTitle(e.target.value)} rows={3} className="resize-none" placeholder={level === 'company' ? '例：ブランド認知度を業界トップ3に引き上げる' : '例：問い合わせ対応でブランドらしさを体現し、満足度90%を達成する'} />
        </div>
        <div>
          <Label className="text-xs font-bold mb-1.5 block">補足（任意）</Label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="resize-none" placeholder="背景や狙いなど" />
        </div>
        {level === 'team' && (
          <div>
            <Label className="text-xs font-bold mb-1.5 block">つながる会社目標（任意）</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger className="h-10"><SelectValue placeholder="選択してください" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>つなげない</SelectItem>
                {companyGoals.map(g => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="flex justify-end mt-4">
        <Button onClick={handleSave} disabled={saving || !title.trim()} className="min-w-[100px]">{saving ? '保存中...' : '保存する'}</Button>
      </div>
    </>
  )
}
