'use client'

// 本体連携モーダル（承認制）
// 項目ごとのチェックボックス＋書き込み内容プレビュー。
// 既存の traits / 期待タグ がある場合は上書き・置換の確認ダイアログを挟む。
import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Check, Unplug } from 'lucide-react'
import type { DiagnosisResult } from '../../../lib/diagnosis'
import type { FrameworkKey } from '../../../lib/questions'

interface ConnectModalProps {
  sessionId: string
  userId: string
  diagnosis: DiagnosisResult
  framework: FrameworkKey
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface PreflightExisting {
  traitsCount: number
  hasSummary: boolean
  expectedTags: string[]
  hasArchetype: boolean
}

interface Selections {
  traits: boolean
  summary: boolean
  tone: boolean
  tags: boolean
  archetype: boolean
  toneRuleIndexes: number[]
}

function ToggleRow({ checked, onToggle, title, children }: {
  checked: boolean
  onToggle: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <div className={`rounded-lg border p-4 transition-colors ${checked ? 'border-ds-app-accent bg-blue-50/40' : 'border-border bg-background'}`}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 text-left">
        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${checked ? 'border-ds-app-accent bg-ds-app-accent text-white' : 'border-gray-300 bg-white'}`}>
          {checked && <Check className="h-3.5 w-3.5" />}
        </span>
        <span className="text-sm font-bold text-foreground">{title}</span>
      </button>
      <div className="mt-2 pl-7">{children}</div>
    </div>
  )
}

export function ConnectModal({ sessionId, userId, diagnosis: d, framework, open, onOpenChange }: ConnectModalProps) {
  const [existing, setExisting] = useState<PreflightExisting | null>(null)
  const [loadingPreflight, setLoadingPreflight] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<{ traits: boolean; tags: boolean; archetype: boolean } | null>(null)
  const [selections, setSelections] = useState<Selections>({
    traits: true,
    summary: true,
    tone: true,
    tags: true,
    // アーキタイプ連携は「タイプで診断（archetype）」を選んだ場合のみ
    archetype: framework === 'archetype',
    toneRuleIndexes: d.tone_rules.map((_, i) => i),
  })

  // モーダルを開いたら既存値をプレフライト取得
  useEffect(() => {
    if (!open) return
    const fetchPreflight = async () => {
      setLoadingPreflight(true)
      try {
        const res = await fetch(`/api/tools/personality/connect?sessionId=${sessionId}&userId=${userId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.isAdmin) setExisting(data.existing)
        }
      } catch {
        // プレフライト失敗時は実行時の409で確認に倒す
      } finally {
        setLoadingPreflight(false)
      }
    }
    fetchPreflight()
  }, [open, sessionId, userId])

  const traitSource = framework === 'archetype' ? d.archetype_traits : d.aaker_scores
  const traitPreview = traitSource.map(item => ({
    name: 'label' in item ? item.label : (item as { name: string }).name,
    score: item.score,
  }))

  const toggleRule = (index: number) => {
    setSelections(prev => ({
      ...prev,
      toneRuleIndexes: prev.toneRuleIndexes.includes(index)
        ? prev.toneRuleIndexes.filter(i => i !== index)
        : [...prev.toneRuleIndexes, index].sort(),
    }))
  }

  const hasSelection =
    selections.traits || selections.summary || selections.tone || selections.tags || selections.archetype || selections.toneRuleIndexes.length > 0

  const executeConnect = useCallback(async (confirm: { overwriteTraits?: boolean; replaceTags?: boolean; overwriteArchetype?: boolean }) => {
    setConnecting(true)
    try {
      const res = await fetch('/api/tools/personality/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, userId, selections, confirm }),
      })
      const data = await res.json()

      if (res.status === 409 && data.needsConfirm) {
        // サーバー側の安全弁に当たった場合も確認ダイアログへ
        setConfirmTarget({
          traits: data.needsConfirm === 'traits',
          tags: data.needsConfirm === 'tags',
          archetype: data.needsConfirm === 'archetype',
        })
        return
      }
      if (!res.ok) {
        toast.error(data.error || '連携に失敗しました')
        return
      }

      toast.success('branding.bz に連携しました')
      onOpenChange(false)
    } catch {
      toast.error('連携中にエラーが発生しました')
    } finally {
      setConnecting(false)
    }
  }, [sessionId, userId, selections, onOpenChange])

  const handleConnectClick = () => {
    // 既存値があり、該当項目が選択されている場合は確認ダイアログを先に挟む
    const needsTraitsConfirm = selections.traits && (existing?.traitsCount ?? 0) > 0
    const needsTagsConfirm = selections.tags && (existing?.expectedTags.length ?? 0) > 0
    const needsArchetypeConfirm = selections.archetype && !!existing?.hasArchetype
    if (needsTraitsConfirm || needsTagsConfirm || needsArchetypeConfirm) {
      setConfirmTarget({ traits: needsTraitsConfirm, tags: needsTagsConfirm, archetype: needsArchetypeConfirm })
      return
    }
    executeConnect({})
  }

  const handleConfirmedConnect = () => {
    const confirm = {
      overwriteTraits: confirmTarget?.traits || undefined,
      replaceTags: confirmTarget?.tags || undefined,
      overwriteArchetype: confirmTarget?.archetype || undefined,
    }
    setConfirmTarget(null)
    executeConnect(confirm)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unplug className="h-5 w-5" />
              branding.bz に連携
            </DialogTitle>
            <DialogDescription>
              連携する項目を選択してください。チェックした内容だけが本体に書き込まれます。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* traits */}
            <ToggleRow
              checked={selections.traits}
              onToggle={() => setSelections(p => ({ ...p, traits: !p.traits }))}
              title={`特性スコア（${framework === 'archetype' ? 'アーキタイプ特性' : 'Aaker 5次元'}） → ブランドパーソナリティ`}
            >
              <div className="flex flex-wrap gap-2">
                {traitPreview.map((t, i) => (
                  <span key={i} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                    {t.name} <span className="font-bold text-ds-app-accent-hover">{t.score}</span>
                  </span>
                ))}
              </div>
              {(existing?.traitsCount ?? 0) > 0 && (
                <p className="mt-2 text-xs text-amber-600">
                  ⚠ 既存の特性 {existing?.traitsCount} 件を上書きします（実行前に確認があります）
                </p>
              )}
            </ToggleRow>

            {/* personality_summary */}
            <ToggleRow
              checked={selections.summary}
              onToggle={() => setSelections(p => ({ ...p, summary: !p.summary }))}
              title="パーソナリティ概要"
            >
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{d.personality_summary}</p>
            </ToggleRow>

            {/* archetype（主・副人格。framework=archetype のときのみ表示） */}
            {framework === 'archetype' && (
            <ToggleRow
              checked={selections.archetype}
              onToggle={() => setSelections(p => ({ ...p, archetype: !p.archetype }))}
              title="アーキタイプ（主・副人格）"
            >
              <div className="space-y-1">
                <p className="text-xs text-foreground">
                  主人格: <span className="font-bold">{d.archetype.primary.label}</span>
                  <span className="text-muted-foreground">　{d.archetype.primary.copy}</span>
                </p>
                <p className="text-xs text-foreground">
                  副人格: <span className="font-bold">{d.archetype.secondary.label}</span>
                  <span className="text-muted-foreground">　{d.archetype.secondary.copy}</span>
                </p>
              </div>
              {existing?.hasArchetype && (
                <p className="mt-2 text-xs text-amber-600">
                  ⚠ 既存のアーキタイプを上書きします（実行前に確認があります）
                </p>
              )}
            </ToggleRow>
            )}

            {/* tone */}
            <ToggleRow
              checked={selections.tone}
              onToggle={() => setSelections(p => ({ ...p, tone: !p.tone }))}
              title="トーンオブボイス / コミュニケーションスタイル"
            >
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{d.tone_of_voice}</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">{d.communication_style}</p>
            </ToggleRow>

            {/* tags */}
            <ToggleRow
              checked={selections.tags}
              onToggle={() => setSelections(p => ({ ...p, tags: !p.tags }))}
              title="期待される印象タグ"
            >
              <div className="flex flex-wrap gap-2">
                {d.expected_tags.map(t => (
                  <span key={t} className="rounded-full border border-ds-app-accent bg-blue-50 px-3 py-1 text-xs text-ds-app-accent-hover">{t}</span>
                ))}
              </div>
              {(existing?.expectedTags.length ?? 0) > 0 && (
                <p className="mt-2 text-xs text-amber-600">
                  ⚠ 既存の期待タグ（{existing?.expectedTags.join('・')}）を置換します（実行前に確認があります）
                </p>
              )}
            </ToggleRow>

            {/* tone_rules（1本ずつ選択可） */}
            {d.tone_rules.length > 0 && (
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm font-bold text-foreground mb-2">トーン制約ルール → 表現ルール（1本ずつ選択可）</p>
                <div className="space-y-2">
                  {d.tone_rules.map((r, i) => {
                    const checked = selections.toneRuleIndexes.includes(i)
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleRule(i)}
                        className={`w-full rounded-lg border p-3 text-left transition-colors ${checked ? 'border-ds-app-accent bg-blue-50/40' : 'border-border bg-background'}`}
                      >
                        <div className="flex items-start gap-2">
                          <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? 'border-ds-app-accent bg-ds-app-accent text-white' : 'border-gray-300 bg-white'}`}>
                            {checked && <Check className="h-3 w-3" />}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground">{r.rule_text}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">NG: {r.ng_example} ／ OK: {r.ok_example}</p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={connecting}>
              キャンセル
            </Button>
            <Button onClick={handleConnectClick} disabled={connecting || loadingPreflight || !hasSelection} className="gap-1.5">
              <Unplug className="h-4 w-4" />
              {connecting ? '連携中...' : '選択した項目を連携する'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 上書き・置換の確認ダイアログ */}
      <AlertDialog open={!!confirmTarget} onOpenChange={(o) => { if (!o) setConfirmTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>既存データを上書きします</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTarget?.traits && '本体に登録済みの特性（traits）が診断結果で上書きされます。'}
              {confirmTarget?.tags && `${confirmTarget?.traits ? ' また、' : ''}既存の期待タグが診断結果のタグに置換されます。`}
              {confirmTarget?.archetype && `${(confirmTarget?.traits || confirmTarget?.tags) ? ' また、' : ''}既存のアーキタイプが診断結果で上書きされます。`}
              {' '}この操作は元に戻せません。続行しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmedConnect}>上書きして連携する</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
