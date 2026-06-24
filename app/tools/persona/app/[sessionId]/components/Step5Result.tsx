'use client'

// Step 5: 確認・出力（マルチペルソナのプレビュー + branding.bz連携）
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ArrowLeft, Link as LinkIcon, RotateCcw, Loader2, UserCircle, Target } from 'lucide-react'
import { type Persona, type BasicInfo } from './persona-types'

interface Step5Props {
  sessionId: string
  personas: Persona[]
  basicInfo: BasicInfo
  companyId: string | null
  onBack: () => void
}

export function Step5Result({ sessionId, personas, basicInfo, companyId, onBack }: Step5Props) {
  const router = useRouter()
  const [connecting, setConnecting] = useState(false)
  const [connected, setConnected] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [hasCompanyId, setHasCompanyId] = useState(!!companyId)

  const connectToBrandingBz = useCallback(async () => {
    setConnecting(true)
    try {
      let cid = companyId
      if (!cid) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { toast.error('ログインが必要です'); return }
        const { data: adminUser } = await supabase
          .from('admin_users').select('company_id').eq('auth_id', user.id).maybeSingle()
        if (!adminUser?.company_id) {
          toast.error('branding.bz本体のアカウントが必要です。管理画面から企業登録してください。')
          setConnecting(false)
          return
        }
        cid = adminUser.company_id
        setHasCompanyId(true)
      }
      const res = await fetch('/api/tools/persona/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, companyId: cid }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || '連携に失敗しました')
        return
      }
      setConnected(true)
      toast.success(`${personas.length}件のペルソナをbranding.bzに連携しました`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '連携中にエラーが発生しました')
    } finally {
      setConnecting(false)
    }
  }, [sessionId, companyId, personas.length])

  const handleNewSession = () => router.push('/tools/persona/app')

  const segments = (basicInfo.target_segments || []).filter(s => s?.name?.trim())
  const segNames = new Set(segments.map(s => s.name))
  const unclassified = personas.filter(p => !segNames.has(p.target_name))
  const groups: Array<{ name: string; description?: string; members: Persona[] }> = [
    ...segments.map(s => ({ name: s.name, description: s.description, members: personas.filter(p => p.target_name === s.name) })),
    ...(unclassified.length > 0 ? [{ name: '未分類', description: undefined, members: unclassified }] : []),
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Step 5: 確認・出力</h1>
      <p className="mb-4 text-[13px] text-muted-foreground">
        作成した{personas.length}件のペルソナを確認し、branding.bzに連携できます
      </p>

      <div className="space-y-8">
        {groups.map((group) => (
          <div key={group.name}>
            <div className="mb-2">
              <h2 className={`text-sm font-bold ${group.name === '未分類' ? 'text-amber-800' : 'text-gray-800'}`}>{group.name}</h2>
              {group.description && <p className="text-[12px] text-muted-foreground mt-0.5">{group.description}</p>}
            </div>
            <div className="space-y-4">
              {group.members.length === 0 && <p className="text-[13px] text-muted-foreground">このターゲットのペルソナはありません。</p>}
              {group.members.map((p, idx) => (
          <Card key={idx} className="border shadow-none">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <UserCircle className="h-8 w-8 text-gray-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{p.demographics.persona_name || `ペルソナ${idx + 1}`}</h2>
                  <p className="text-sm text-gray-500">
                    {p.demographics.age || ''} {p.demographics.gender} / {p.demographics.occupation}
                    {p.demographics.company_role ? ` / ${p.demographics.company_role}` : ''}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                <InfoItem label="勤務先規模" value={p.demographics.company_size} />
                <InfoItem label="居住地" value={p.demographics.location} />
              </div>

              {p.demographics.personality_traits?.length > 0 && (
                <div className="mb-4">
                  <span className="text-xs font-bold text-gray-500 mb-1 block">性格特性</span>
                  <div className="flex flex-wrap gap-1.5">
                    {p.demographics.personality_traits.map((t, i) => (
                      <span key={i} className="rounded-full bg-blue-50 border border-blue-100 px-2.5 py-0.5 text-xs text-ds-app-accent-hover">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 mb-2 mt-4">
                <Target className="h-4 w-4 text-gray-600" />
                <h3 className="text-sm font-bold text-gray-900">ゴール・課題</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TagList label="主な目標" items={p.goals.primary_goals} color="blue" />
                <TagList label="課題・悩み" items={p.goals.challenges} color="red" />
                <TagList label="ペインポイント" items={p.goals.pain_points} color="orange" />
                <TagList label="意思決定要因" items={p.goals.decision_factors} color="green" />
              </div>
            </CardContent>
          </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 my-6">
        {!connected ? (
          <Button onClick={() => setConfirmOpen(true)} disabled={connecting || personas.length === 0} className="gap-2 flex-1">
            {connecting ? <><Loader2 className="h-4 w-4 animate-spin" /> 連携中...</> : <><LinkIcon className="h-4 w-4" /> branding.bz に連携</>}
          </Button>
        ) : (
          <Button variant="outline" onClick={handleNewSession} className="gap-2 flex-1">
            <RotateCcw className="h-4 w-4" /> 新しいペルソナを作成
          </Button>
        )}
      </div>

      {connected && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 mb-6">
          ペルソナをbranding.bzに連携しました。管理画面の「ブランド戦略」からペルソナを確認できます。
        </div>
      )}

      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-4 flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="h-14 gap-2 px-6 text-base font-bold">
          <ArrowLeft className="h-4 w-4" /> 戻る
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>branding.bz に連携</AlertDialogTitle>
            <AlertDialogDescription>
              {personas.length}件のペルソナをbranding.bzに連携します（既存ペルソナは置き換えられます）。
              {!hasCompanyId && '（企業アカウントが必要です）'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={connectToBrandingBz}>連携する</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div>
      <span className="text-xs font-bold text-gray-500">{label}</span>
      <p className="text-sm text-gray-700">{value}</p>
    </div>
  )
}

function TagList({ label, items, color }: { label: string; items: string[]; color: string }) {
  if (!items?.length) return null
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-100 text-ds-app-accent-hover',
    red: 'bg-red-50 border-red-100 text-red-700',
    orange: 'bg-orange-50 border-orange-100 text-orange-700',
    green: 'bg-green-50 border-green-100 text-green-700',
  }
  const cls = colorMap[color] || colorMap.blue
  return (
    <div>
      <span className="text-xs font-bold text-gray-500 mb-1 block">{label}</span>
      <div className="flex flex-wrap gap-1">
        {items.filter(i => i.trim()).map((item, idx) => (
          <span key={idx} className={`rounded-full border px-2 py-0.5 text-xs ${cls}`}>{item}</span>
        ))}
      </div>
    </div>
  )
}
