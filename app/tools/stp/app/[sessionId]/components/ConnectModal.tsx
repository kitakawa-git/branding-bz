'use client'

// 本体連携モーダル（承認制）
// 項目ごとのチェックボックス＋書き込み内容プレビュー。
// 既存の brand_personas に値がある場合は上書き確認ダイアログを挟む。
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

interface TargetingData {
  evaluations: Array<{ segment_name: string; attractiveness: number; competitiveness: number; priority: string }>
  main_target: string
  sub_targets: string[]
  target_description: string
  target_summary?: string
}

interface PositioningItem {
  name: string
  x: number
  y: number
  color: string
  is_self: boolean
}

interface PositioningData {
  x_axis: { left: string; right: string }
  y_axis: { bottom: string; top: string }
  items: PositioningItem[]
}

interface ConnectModalProps {
  sessionId: string
  companyId: string
  targeting: TargetingData
  positioning: PositioningData
  hasTargetFitMap?: boolean
  hasBrandStance?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onConnected?: () => void
}

interface PreflightExisting {
  hasTarget: boolean
  hasPositioning: boolean
  hasTargetFitMap?: boolean
  hasBrandStance?: boolean
}

interface Selections {
  targeting: boolean
  positioning: boolean
  target_fit_map: boolean
  brand_stance_statements: boolean
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

export function ConnectModal({
  sessionId,
  companyId,
  targeting,
  positioning,
  hasTargetFitMap = false,
  hasBrandStance = false,
  open,
  onOpenChange,
  onConnected,
}: ConnectModalProps) {
  const [existing, setExisting] = useState<PreflightExisting | null>(null)
  const [loadingPreflight, setLoadingPreflight] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<{ targeting: boolean; positioning: boolean; target_fit_map: boolean; brand_stance_statements: boolean } | null>(null)
  // 上書き確認は 409 で1項目ずつ返るため、確認済みフラグを累積して毎回まとめて送る（無限ループ防止）
  const [accumulatedConfirm, setAccumulatedConfirm] = useState<{
    overwriteTargeting?: boolean
    overwritePositioning?: boolean
    overwriteTargetFitMap?: boolean
    overwriteBrandStance?: boolean
  }>({})
  const [selections, setSelections] = useState<Selections>({
    targeting: true,
    positioning: true,
    target_fit_map: true,
    brand_stance_statements: true,
  })

  useEffect(() => {
    if (!open) return
    const fetchPreflight = async () => {
      setLoadingPreflight(true)
      try {
        const res = await fetch(`/api/tools/stp/connect?sessionId=${sessionId}&companyId=${companyId}`)
        if (res.ok) {
          const data = await res.json()
          setExisting(data.existing)
        }
      } catch {
        // プレフライト失敗時は実行時の409で確認に倒す
      } finally {
        setLoadingPreflight(false)
      }
    }
    fetchPreflight()
  }, [open, sessionId, companyId])

  // ターゲット: メイン + サブ
  const targetTags: string[] = [
    ...(targeting.main_target ? [targeting.main_target] : []),
    ...(targeting.sub_targets || []),
  ]

  // 自社アイテム
  const selfItem = (positioning.items || []).find(i => i.is_self)

  const hasSelection = selections.targeting || selections.positioning
    || (hasTargetFitMap && selections.target_fit_map) || (hasBrandStance && selections.brand_stance_statements)

  const executeConnect = useCallback(async (confirm: { overwriteTargeting?: boolean; overwritePositioning?: boolean; overwriteTargetFitMap?: boolean; overwriteBrandStance?: boolean }) => {
    setConnecting(true)
    try {
      const res = await fetch('/api/tools/stp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, companyId, selections, confirm }),
      })
      const data = await res.json()

      if (res.status === 409 && data.needsConfirm) {
        setConfirmTarget({
          targeting: data.needsConfirm === 'targeting',
          positioning: data.needsConfirm === 'positioning',
          target_fit_map: data.needsConfirm === 'target_fit_map',
          brand_stance_statements: data.needsConfirm === 'brand_stance_statements',
        })
        return
      }
      if (!res.ok) {
        toast.error(data.error || '連携に失敗しました')
        return
      }

      toast.success('branding.bz に連携しました')
      setAccumulatedConfirm({})
      onOpenChange(false)
      onConnected?.()
    } catch {
      toast.error('連携中にエラーが発生しました')
    } finally {
      setConnecting(false)
    }
  }, [sessionId, companyId, selections, onOpenChange, onConnected])

  const handleConnectClick = () => {
    // 全項目の既存上書きを事前にまとめて判定し、1回の確認ダイアログで済ませる
    const needsTgtConfirm = !!(selections.targeting && existing?.hasTarget)
    const needsPosConfirm = !!(selections.positioning && existing?.hasPositioning)
    const needsFitMapConfirm = !!(selections.target_fit_map && existing?.hasTargetFitMap)
    const needsStanceConfirm = !!(selections.brand_stance_statements && existing?.hasBrandStance)
    // 新規連携の開始: 累積した確認フラグをリセット
    setAccumulatedConfirm({})
    if (needsTgtConfirm || needsPosConfirm || needsFitMapConfirm || needsStanceConfirm) {
      setConfirmTarget({
        targeting: needsTgtConfirm,
        positioning: needsPosConfirm,
        target_fit_map: needsFitMapConfirm,
        brand_stance_statements: needsStanceConfirm,
      })
      return
    }
    executeConnect({})
  }

  const handleConfirmedConnect = () => {
    // 今回確認した項目を累積に積み増し、毎回まとめてサーバーへ送る
    const newConfirm = {
      ...accumulatedConfirm,
      overwriteTargeting: confirmTarget?.targeting ? true : accumulatedConfirm.overwriteTargeting,
      overwritePositioning: confirmTarget?.positioning ? true : accumulatedConfirm.overwritePositioning,
      overwriteTargetFitMap: confirmTarget?.target_fit_map ? true : accumulatedConfirm.overwriteTargetFitMap,
      overwriteBrandStance: confirmTarget?.brand_stance_statements ? true : accumulatedConfirm.overwriteBrandStance,
    }
    setAccumulatedConfirm(newConfirm)
    setConfirmTarget(null)
    executeConnect(newConfirm)
  }

  const overwriteParts: string[] = []
  if (confirmTarget?.targeting) overwriteParts.push('ターゲット')
  if (confirmTarget?.positioning) overwriteParts.push('ポジショニングマップ')
  if (confirmTarget?.target_fit_map) overwriteParts.push('ターゲット適合マップ')
  if (confirmTarget?.brand_stance_statements) overwriteParts.push('自社の立ち位置')

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
            {/* ターゲティング */}
            <ToggleRow
              checked={selections.targeting}
              onToggle={() => setSelections(p => ({ ...p, targeting: !p.targeting }))}
              title="ターゲティング → ターゲット概要 + 主なターゲット"
            >
              {targetTags.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {targetTags.map((name, i) => (
                    <span key={i} className="rounded-full border border-ds-app-accent bg-blue-50 px-3 py-1 text-xs text-ds-app-accent-hover">
                      {name}
                    </span>
                  ))}
                </div>
              )}
              {(targeting.target_summary || targeting.target_description) && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                  {targeting.target_summary || targeting.target_description}
                </p>
              )}
              {existing?.hasTarget && (
                <p className="mt-2 text-xs text-amber-600">
                  ⚠ 既存のターゲット概要・主なターゲットを上書きします（実行前に確認があります）
                </p>
              )}
            </ToggleRow>

            {hasTargetFitMap && (
              <ToggleRow
                checked={selections.target_fit_map}
                onToggle={() => setSelections(p => ({ ...p, target_fit_map: !p.target_fit_map }))}
                title="ターゲット適合マップ → 顧客側軸＋カバー範囲"
              >
                <p className="text-xs text-muted-foreground">
                  狙ったターゲットが自社のカバー範囲に入るかの分析結果を本体に保存します。
                </p>
              </ToggleRow>
            )}

            {/* ポジショニングマップ */}
            <ToggleRow
              checked={selections.positioning}
              onToggle={() => setSelections(p => ({ ...p, positioning: !p.positioning }))}
              title="ポジショニングマップ → 競合配置"
            >
              <div className="space-y-1">
                <p className="text-xs text-foreground">
                  X軸: <span className="font-bold">{positioning.x_axis?.left || '—'}</span>
                  <span className="text-muted-foreground"> ↔ </span>
                  <span className="font-bold">{positioning.x_axis?.right || '—'}</span>
                </p>
                <p className="text-xs text-foreground">
                  Y軸: <span className="font-bold">{positioning.y_axis?.bottom || '—'}</span>
                  <span className="text-muted-foreground"> ↔ </span>
                  <span className="font-bold">{positioning.y_axis?.top || '—'}</span>
                </p>
                <p className="text-xs text-foreground">
                  配置: <span className="font-bold">{positioning.items?.length ?? 0} 社</span>
                  {selfItem && (
                    <span className="text-muted-foreground">　自社: {selfItem.name}</span>
                  )}
                </p>
              </div>
              {existing?.hasPositioning && (
                <p className="mt-2 text-xs text-amber-600">
                  ⚠ 既存のポジショニングマップを上書きします（実行前に確認があります）
                </p>
              )}
            </ToggleRow>

            {hasBrandStance && (
              <ToggleRow
                checked={selections.brand_stance_statements}
                onToggle={() => setSelections(p => ({ ...p, brand_stance_statements: !p.brand_stance_statements }))}
                title="自社の立ち位置 → ターゲット別ポジショニング文"
              >
                <p className="text-xs text-muted-foreground">
                  ターゲット別の立ち位置（ポジショニング・ステートメント）を本体に保存します。
                </p>
              </ToggleRow>
            )}
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setAccumulatedConfirm({}); onOpenChange(false) }} disabled={connecting}>
              キャンセル
            </Button>
            <Button onClick={handleConnectClick} disabled={connecting || loadingPreflight || !hasSelection} className="gap-1.5">
              <Unplug className="h-4 w-4" />
              {connecting ? '連携中...' : '選択した項目を連携する'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 上書き確認ダイアログ */}
      <AlertDialog open={!!confirmTarget} onOpenChange={(o) => { if (!o) setConfirmTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>既存データを上書きします</AlertDialogTitle>
            <AlertDialogDescription>
              本体に登録済みの{overwriteParts.join('・')}が、STP分析結果で上書きされます。この操作は元に戻せません。続行しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAccumulatedConfirm({})}>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmedConnect}>上書きして連携する</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
