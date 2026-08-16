'use client'

// ① 基本: プロジェクト名＋ペルソナ（必須）＋ブリーフ（任意）。POST /api/superadmin/copy/projects。
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { Persona } from './types'

export default function ProjectSetup({
  companyId,
  onCreated,
}: {
  companyId: string
  onCreated: (projectId: string) => void
}) {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [personaId, setPersonaId] = useState('')
  const [brief, setBrief] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    // brand_personas は superadmin_all RLS が無く client直読みが0件になるため、
    // service_role API（RLSバイパス）経由で取得する。
    ;(async () => {
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token || ''
        const res = await fetch(`/api/superadmin/copy/personas?companyId=${companyId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json()
        if (!active) return
        setPersonas(res.ok ? (json.personas as Persona[]) ?? [] : [])
      } catch {
        if (active) setPersonas([])
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [companyId])

  const create = async () => {
    if (!name.trim()) return toast.error('プロジェクト名を入力してください')
    if (!personaId) return toast.error('ペルソナを選択してください（必須）')
    setSaving(true)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token || ''
      const res = await fetch('/api/superadmin/copy/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ companyId, name: name.trim(), personaId, brief: brief.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '作成に失敗しました')
      toast.success('プロジェクトを作成しました')
      onCreated(json.project.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '作成に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-[13px] text-muted-foreground">読み込み中…</p>

  if (personas.length === 0) {
    return (
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">
          <p className="text-sm font-bold mb-1">先にペルソナを登録してください</p>
          <p className="text-[13px] text-muted-foreground">
            コピーAIは登録ペルソナの pain_points を起点にインサイトを抽出します。ペルソナが無いと生成できません。
            ブランド詳細のブランドオントロジー（ペルソナ）から登録してください。
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
      <CardContent className="p-5">
        <div className="mb-5">
          <h2 className="text-sm font-bold mb-3">
            プロジェクト名 <span className="text-xs text-red-500 font-normal">*</span>
          </h2>
          <Input className="h-10" value={name} onChange={(e) => setName(e.target.value)} placeholder="例: コーポレートサイト LP コピー" />
        </div>

        <div className="mb-5">
          <h2 className="text-sm font-bold mb-3">
            ターゲットペルソナ <span className="text-xs text-red-500 font-normal">*</span>
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {personas.map((p) => {
              const selected = personaId === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPersonaId(p.id)}
                  className={`flex min-h-11 items-center rounded-lg border bg-white px-3 py-2 text-left text-sm transition-colors ${
                    selected ? 'border-ds-app-accent ring-1 ring-ds-app-accent' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className={`mr-2 h-3 w-3 flex-shrink-0 rounded-full border ${selected ? 'border-ds-app-accent bg-ds-app-accent' : 'border-gray-300'}`} />
                  <span className="truncate">{p.name || '（名称未設定）'}</span>
                </button>
              )
            })}
          </div>
          <p className="text-[13px] text-muted-foreground mt-1.5">
            選んだペルソナの pain_points が、インサイト抽出の起点になります。
          </p>
        </div>

        <div className="mb-5">
          <h2 className="text-sm font-bold mb-3">
            ブリーフ <span className="text-xs text-gray-400 font-normal">（任意）</span>
          </h2>
          <Textarea value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="この案件で達成したいこと・トーンの希望など" rows={3} />
        </div>

        <Button onClick={create} disabled={saving} className="w-full sm:w-auto">
          {saving ? '作成中…' : 'プロジェクトを作成'}
        </Button>
      </CardContent>
    </Card>
  )
}
