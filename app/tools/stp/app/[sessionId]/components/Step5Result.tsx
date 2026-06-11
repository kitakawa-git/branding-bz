'use client'

// Step 5: 確認・出力（STP分析結果プレビュー + PDF出力 + branding.bz連携）
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PositioningMap } from '@/components/PositioningMap'
import type { PositioningMapData } from '@/lib/types/positioning-map'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { ConnectModal } from './ConnectModal'
import { ToolConnectActions } from '@/components/shared/ToolConnectActions'
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
import {
  ArrowLeft,
  Download,
  LayoutGrid,
  Target,
  MapPin,
  Loader2,
  Sparkles,
  RefreshCw,
} from 'lucide-react'

// 型定義
interface SegmentSource {
  name: string
  description: string
  size_hint: string
  selected: boolean
}

interface VariableSource {
  name: string
  segments: SegmentSource[]
}

interface SegmentationData {
  mode: 'ai' | 'manual'
  variables: VariableSource[]
}

interface Evaluation {
  segment_name: string
  attractiveness: number
  competitiveness: number
  priority: string
}

interface TargetingData {
  evaluations: Evaluation[]
  main_target: string
  sub_targets: string[]
  target_description: string
  target_summary?: string
  buying_factors?: string[]
  strengths?: string
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

interface BasicInfo {
  company_name: string
  industry_category: string
  industry_subcategory: string
  business_descriptions: Array<{ title: string; description: string }>
  target_segments: Array<{ name: string; description: string }>
  competitors: Array<{ name: string; url: string }>
  // 旧フィールド（後方互換）
  industry?: string
  industry_other?: string
  products?: string
  current_customers?: string
}

interface Step5Props {
  sessionId: string
  basicInfo: BasicInfo
  segmentation: SegmentationData
  targeting: TargetingData
  positioning: PositioningData
  companyId: string | null
  onBack: () => void
}

// ★表示ヘルパー
function Stars({ count }: { count: number }) {
  return (
    <span className="text-xs">
      {'★'.repeat(count)}
      <span className="text-gray-300">{'★'.repeat(5 - count)}</span>
    </span>
  )
}

// STPデータ → PositioningMapData 変換
function toMapData(positioning: PositioningData): PositioningMapData {
  return {
    x_axis: positioning.x_axis,
    y_axis: positioning.y_axis,
    items: positioning.items.map((item) => ({
      name: item.name,
      color: item.color,
      x: item.x,
      y: item.y,
      size: item.is_self ? ('lg' as const) : ('md' as const),
    })),
  }
}

// ツールチップバッジ
function SegmentBadge({ name, description }: { name: string; description: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-ds-app-accent-hover"
      title={description}
    >
      {name}
    </span>
  )
}

export function Step5Result({
  sessionId,
  basicInfo,
  segmentation,
  targeting,
  positioning,
  companyId,
  onBack,
}: Step5Props) {
  const router = useRouter()
  const [pdfLoading, setPdfLoading] = useState(false)
  const [adminCompanyId, setAdminCompanyId] = useState<string | null>(companyId)
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [targetSummary, setTargetSummary] = useState<string>(targeting.target_summary || '')
  const [summaryLoading, setSummaryLoading] = useState(false)

  // ターゲット概要文をAI生成（再生成にも使う）
  const generateTargetSummary = useCallback(async () => {
    if (!targeting.main_target) return
    setSummaryLoading(true)
    try {
      const res = await fetch('/api/tools/stp/suggest-target-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ basic_info: basicInfo, segmentation, targeting }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'ターゲット概要の生成に失敗しました')
        return
      }
      const data = await res.json()
      const summary = String(data.summary || '')
      setTargetSummary(summary)
      // セッションに保存
      try {
        await fetch(`/api/tools/stp/sessions/${sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionData: { targeting: { ...targeting, target_summary: summary } },
          }),
        })
      } catch {
        // 保存失敗時は次回再生成で復帰
      }
    } catch {
      toast.error('ターゲット概要の生成中にエラーが発生しました')
    } finally {
      setSummaryLoading(false)
    }
  }, [sessionId, basicInfo, segmentation, targeting])

  // 初回表示時に未生成なら自動生成
  useEffect(() => {
    if (!targetSummary && !summaryLoading && targeting.main_target) {
      generateTargetSummary()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // admin_users に存在するか確認
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setCheckingAdmin(false)
          return
        }

        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('company_id')
          .eq('auth_id', user.id)
          .maybeSingle()

        if (adminUser) {
          setIsAdminUser(true)
          setAdminCompanyId(adminUser.company_id)
        }
      } catch {
        console.error('[Step5] admin_users確認エラー')
      } finally {
        setCheckingAdmin(false)
      }
    }

    checkAdminStatus()
  }, [])

  // メインターゲット評価データ
  const mainEval = useMemo(
    () => targeting.evaluations.find((e) => e.segment_name === targeting.main_target),
    [targeting]
  )

  // サブターゲット評価データ
  const subEvals = useMemo(
    () =>
      targeting.sub_targets.map((name) => ({
        name,
        eval: targeting.evaluations.find((e) => e.segment_name === name),
      })),
    [targeting]
  )

  // PDF出力
  const handlePdfExport = useCallback(async () => {
    setPdfLoading(true)
    try {
      const res = await fetch('/api/tools/stp/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'PDF生成に失敗しました')
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const dateStr = new Date()
        .toLocaleDateString('ja-JP', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
        .replace(/\//g, '')
      a.href = url
      a.download = `stp-analysis-${basicInfo.company_name || 'report'}-${dateStr}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('PDFをダウンロードしました')
    } catch {
      toast.error('PDF生成中にエラーが発生しました')
    } finally {
      setPdfLoading(false)
    }
  }, [sessionId, basicInfo.company_name])

  // branding.bz連携
  const [connectModalOpen, setConnectModalOpen] = useState(false)

  const handleConnectClick = useCallback(() => {
    if (!adminCompanyId) {
      router.push('/admin/login')
      return
    }
    setConnectModalOpen(true)
  }, [adminCompanyId, router])

  // 連携成功時：基本情報を本体（companies）へ書き戻し
  const handleConnected = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await fetch('/api/tools/shared-profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            company_name: basicInfo.company_name,
            industry_category: basicInfo.industry_category,
            industry_subcategory: basicInfo.industry_subcategory,
            competitors: basicInfo.competitors,
            business_descriptions: basicInfo.business_descriptions,
            target_segments: basicInfo.target_segments,
          }),
        })
      }
    } catch {
      // 書き戻し失敗は無視
    }
  }, [basicInfo])

  // 最初からやり直す
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false)

  const handleRestart = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('認証エラーが発生しました')
        return
      }

      // 現在のセッションを完了状態にする
      await fetch(`/api/tools/stp/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionData: { completed: true }, status: 'completed' }),
      })

      // 新規セッション作成
      const res = await fetch('/api/tools/stp/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || '新しいセッションの作成に失敗しました')
        return
      }

      const { sessionId: newSessionId } = await res.json()
      router.replace(`/tools/stp/app/${newSessionId}`)
    } catch {
      toast.error('エラーが発生しました')
    }
  }, [sessionId, router])

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Step 5: 確認・出力</h1>
      <p className="mb-5 text-[13px] text-muted-foreground">
        STP分析の結果を確認し、PDF出力や branding.bz への連携を行いましょう
      </p>

      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">
          {/* ===== S — セグメンテーション ===== */}
          <div className="mb-5 rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <LayoutGrid className="h-5 w-5 text-ds-app-accent" />
          <h3 className="text-base font-bold text-gray-900">
            S — セグメンテーション
          </h3>
        </div>

        <div className="space-y-4">
          {(segmentation.variables || []).map((variable, vi) => {
            const selectedSegments = variable.segments.filter((s) => s.selected)
            if (selectedSegments.length === 0) return null
            return (
              <div key={vi}>
                <p className="mb-2 text-sm font-bold text-gray-700">
                  {variable.name}
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedSegments.map((seg, si) => (
                    <SegmentBadge
                      key={si}
                      name={seg.name}
                      description={seg.description}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

          {/* ===== T — ターゲティング ===== */}
          <div className="mb-5 rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <Target className="h-5 w-5 text-ds-app-accent" />
          <h3 className="text-base font-bold text-gray-900">
            T — ターゲティング
          </h3>
        </div>

        {/* メインターゲット */}
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="mb-1 text-xs font-bold text-ds-app-accent">メインターゲット</p>
          <p className="text-sm font-bold text-gray-900">
            {targeting.main_target || '未選択'}
          </p>
          {targeting.target_description && (
            <p className="mt-1 text-sm text-gray-600 leading-relaxed">
              {targeting.target_description}
            </p>
          )}
          {mainEval && (
            <div className="mt-2 flex items-center gap-4 text-xs text-gray-600">
              <span>
                市場の魅力度: <Stars count={mainEval.attractiveness} />
              </span>
              <span>
                自社の競争力: <Stars count={mainEval.competitiveness} />
              </span>
            </div>
          )}
        </div>

        {/* サブターゲット */}
        {subEvals.length > 0 ? (
          <div className="space-y-2">
            {subEvals.map((sub, i) => (
              <div
                key={i}
                className="rounded-lg border border-gray-200 bg-gray-50 p-3"
              >
                <p className="mb-0.5 text-xs font-bold text-gray-500">
                  サブターゲット {i + 1}
                </p>
                <p className="text-sm font-bold text-gray-700">{sub.name}</p>
                {sub.eval && (
                  <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                    <span>
                      魅力度: <Stars count={sub.eval.attractiveness} />
                    </span>
                    <span>
                      競争力: <Stars count={sub.eval.competitiveness} />
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-sm text-gray-400">サブターゲット: なし</p>
          </div>
        )}

        {/* ターゲット概要文（AI生成） */}
        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/30 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-ds-app-accent" />
              <p className="text-xs font-bold text-ds-app-accent">ターゲット戦略の概要（AI生成）</p>
            </div>
            {targetSummary && !summaryLoading && (
              <button
                type="button"
                onClick={generateTargetSummary}
                className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-ds-app-accent"
              >
                <RefreshCw className="h-3 w-3" />
                再生成
              </button>
            )}
          </div>
          {summaryLoading ? (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ターゲット戦略の概要を生成中...
            </div>
          ) : targetSummary ? (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{targetSummary}</p>
          ) : (
            <button
              type="button"
              onClick={generateTargetSummary}
              className="text-xs text-ds-app-accent hover:underline"
            >
              AIで概要文を生成する
            </button>
          )}
        </div>

      </div>

          {/* ===== P — ポジショニング ===== */}
          <div className="mb-5 rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <MapPin className="h-5 w-5 text-ds-app-accent" />
          <h3 className="text-base font-bold text-gray-900">
            P — ポジショニング
          </h3>
        </div>

        {/* マップ */}
        <div className="rounded-lg border bg-white p-3">
          <PositioningMap data={toMapData(positioning)} />
        </div>

        {/* 凡例 */}
        <div className="mt-3 flex flex-wrap gap-3">
          {(positioning.items || []).map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs text-gray-700">
                {item.name}
                {item.is_self && (
                  <span className="ml-1 text-ds-app-accent">（自社）</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

        </CardContent>
      </Card>

      {/* ===== ツール末尾共通アクション（連携 + やり直す） ===== */}
      <ToolConnectActions
        checkingAdmin={checkingAdmin}
        isAdminUser={isAdminUser}
        adminDescription="STP分析の結果をブランド管理プラットフォームに登録できます。連携する項目は次の画面で選択します。"
        nonAdminDescription="本体への連携には branding.bz の企業アカウント（管理者）が必要です。分析結果はPDFでダウンロードしてご活用ください。"
        onConnectClick={handleConnectClick}
        onRestart={() => setRestartConfirmOpen(true)}
      />

      {/* フッターナビゲーション */}
      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-3 flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          戻る
        </Button>
        <Button onClick={handlePdfExport} disabled={pdfLoading} className="gap-1">
          {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {pdfLoading ? 'PDF生成中...' : 'PDFをダウンロード'}
        </Button>
      </div>

      {/* branding.bz連携モーダル */}
      {adminCompanyId && (
        <ConnectModal
          sessionId={sessionId}
          companyId={adminCompanyId}
          segmentation={segmentation}
          targeting={targeting}
          positioning={positioning}
          open={connectModalOpen}
          onOpenChange={setConnectModalOpen}
          onConnected={handleConnected}
        />
      )}

      {/* やり直しの確認ダイアログ */}
      <AlertDialog open={restartConfirmOpen} onOpenChange={setRestartConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>最初からやり直す</AlertDialogTitle>
            <AlertDialogDescription>
              分析結果は保存されています。新しい分析を始めますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleRestart()}>やり直す</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
