'use client'

// チームのメンバー割り当てダイアログ（管理画面）
// 部署（profiles.department）は「候補をまとめて選ぶ」ためだけに使う。チームの自動作成はしない
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import { goalsApi } from '@/lib/goals/client'
import type { Team, TeamMember, TeamRole } from '@/lib/goals/types'

export type CompanyMember = { authId: string; name: string; department: string | null }

type Props = {
  team: Team | null
  onClose: () => void
  members: CompanyMember[]
  teamMembers: TeamMember[]
  onSaved: () => void
}

export function TeamMembersDialog({ team, onClose, members, teamMembers, onSaved }: Props) {
  return (
    <Dialog open={!!team} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] flex flex-col">
        {team && (
          <MembersForm
            key={team.id}
            team={team}
            members={members}
            initial={teamMembers.filter(m => m.team_id === team.id)}
            onClose={onClose}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function MembersForm({ team, members, initial, onClose, onSaved }: { team: Team; members: CompanyMember[]; initial: TeamMember[]; onClose: () => void; onSaved: () => void }) {
  // 選んでいる人 → 役割。入っていない人はキーが無い
  const [selected, setSelected] = useState<Map<string, TeamRole>>(() => new Map(initial.map(m => [m.user_id, m.role])))
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)

  const departments = [...new Set(members.map(m => m.department).filter((d): d is string => !!d))].sort()
  const q = query.trim().toLowerCase()
  const visible = members.filter(m => !q || m.name.toLowerCase().includes(q) || (m.department ?? '').toLowerCase().includes(q))

  const toggle = (authId: string) => {
    setSelected(prev => {
      const next = new Map(prev)
      if (next.has(authId)) next.delete(authId)
      else next.set(authId, 'member')
      return next
    })
  }
  const setRole = (authId: string, role: TeamRole) => setSelected(prev => new Map(prev).set(authId, role))
  // 部署の人をまとめて候補に入れる（外すのは1人ずつ）
  const addDepartment = (dept: string) => {
    setSelected(prev => {
      const next = new Map(prev)
      members.filter(m => m.department === dept).forEach(m => { if (!next.has(m.authId)) next.set(m.authId, 'member') })
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await goalsApi(`/api/teams/${team.id}/members`, 'PUT', {
        members: [...selected].map(([user_id, role]) => ({ user_id, role })),
      })
      toast.success('メンバーを更新しました')
      onClose()
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const leaderCount = [...selected.values()].filter(r => r === 'leader').length

  return (
    <>
      <DialogTitle>メンバーを割り当てる（{team.name}）</DialogTitle>
      <div className="space-y-3 mt-2 min-h-0 flex flex-col">
        {departments.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground m-0 mb-1.5">部署の人をまとめて選ぶ</p>
            <div className="flex flex-wrap gap-1.5">
              {departments.map(d => (
                <button key={d} type="button" onClick={() => addDepartment(d)} className="px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="名前・部署で絞り込む" className="h-9 pl-8 text-sm" />
        </div>
        <div className="border rounded-lg divide-y overflow-y-auto min-h-0 max-h-[45vh]">
          {visible.length === 0 && <p className="text-xs text-muted-foreground m-0 p-4 text-center">該当するメンバーがいません</p>}
          {visible.map(m => {
            const role = selected.get(m.authId)
            return (
              <div key={m.authId} className="flex items-center gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  id={`tm-${m.authId}`}
                  checked={!!role}
                  onChange={() => toggle(m.authId)}
                  className="size-4 accent-foreground cursor-pointer"
                />
                <label htmlFor={`tm-${m.authId}`} className="flex-1 min-w-0 cursor-pointer">
                  <span className="text-sm font-semibold text-foreground">{m.name}</span>
                  {m.department && <span className="text-xs text-muted-foreground ml-2">{m.department}</span>}
                </label>
                {role && (
                  <Select value={role} onValueChange={v => setRole(m.authId, v as TeamRole)}>
                    <SelectTrigger className="h-8 w-[104px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="leader">リーダー</SelectItem>
                      <SelectItem value="member">メンバー</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{selected.size}名</Badge>
          うちリーダー {leaderCount}名（リーダーはチーム目標を作成・編集できます）
        </div>
      </div>
      <div className="flex justify-end mt-4">
        <Button onClick={handleSave} disabled={saving} className="min-w-[100px]">{saving ? '保存中...' : '保存する'}</Button>
      </div>
    </>
  )
}
