'use client'

// Step 5: 確認・出力（STP分析結果プレビュー + PDF出力 + branding.bz連携）
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { PositioningMapData } from '@/lib/types/positioning-map'
import { SegmentationDisplay, TargetingDisplay, PositioningDisplay } from '@/components/shared/stp'
import { ToolExportActions } from '@/components/shared/ToolExportActions'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
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
import { ArrowLeft } from 'lucide-react'

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
  const [connectLoading, setConnectLoading] = useState(false)
  const [adminCompanyId, setAdminCompanyId] = useState<string | null>(companyId)
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)

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
  const [connectConfirmOpen, setConnectConfirmOpen] = useState(false)

  const handleConnectClick = useCallback(() => {
    if (!adminCompanyId) {
      router.push('/admin/login')
      return
    }
    setConnectConfirmOpen(true)
  }, [adminCompanyId, router])

  const handleConnect = useCallback(async () => {
    if (!adminCompanyId) return

    setConnectLoading(true)
    try {
      const res = await fetch('/api/tools/stp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, companyId: adminCompanyId }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || '連携に失敗しました')
        return
      }

      // 基本情報を本体（companies）へ書き戻し
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

      toast.success('branding.bz のブランド戦略に連携しました')
    } catch {
      toast.error('連携中にエラーが発生しました')
    } finally {
      setConnectLoading(false)
    }
  }, [sessionId, adminCompanyId, basicInfo])

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
      <h1 className="text-2xl font-bold text-foreground mb-6">Step 5: 確認・出力</h1>

      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">
          <p className="mb-5 text-[13px] text-muted-foreground">
            STP分析の結果を確認し、PDF出力や branding.bz への連携を行いましょう
          </p>

          {/* ===== S — セグメンテーション ===== */}
          <SegmentationDisplay
            variables={segmentation.variables || []}
            className="mb-5 rounded-lg border border-gray-200 bg-white p-5"
          />

          {/* ===== T — ターゲティング ===== */}
          <TargetingDisplay
            mainTarget={targeting.main_target}
            targetDescription={targeting.target_description}
            evaluations={targeting.evaluations}
            subTargets={targeting.sub_targets}
            className="mb-5 rounded-lg border border-gray-200 bg-white p-5"
          />

          {/* ===== P — ポジショニング ===== */}
          <PositioningDisplay
            data={toMapData(positioning)}
            className="mb-5 rounded-lg border border-gray-200 bg-white p-5"
          />

          {/* ===== アクションボタン ===== */}
          {!checkingAdmin && (
            <ToolExportActions
              onExportPdf={handlePdfExport}
              onConnect={handleConnectClick}
              onReset={() => setRestartConfirmOpen(true)}
              isExporting={pdfLoading}
              isConnecting={connectLoading}
              connectLabel={isAdminUser ? 'branding.bz に連携' : 'branding.bz にログインして連携'}
              connectVariant={isAdminUser ? 'default' : 'outline'}
            />
          )}
        </CardContent>
      </Card>

      {/* フッターナビゲーション */}
      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-3 flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          戻る
        </Button>
      </div>

      {/* branding.bz連携の確認ダイアログ */}
      <AlertDialog open={connectConfirmOpen} onOpenChange={setConnectConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>branding.bz に連携</AlertDialogTitle>
            <AlertDialogDescription>
              分析データをブランド戦略ページに反映します。既存のターゲット・ポジショニングマップデータは上書きされます。よろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleConnect()}>連携する</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
