'use client'

// Step 5: 診断結果の表示・微調整・PDF出力
// - Step 1 で選択したフレームワークをデフォルト表示、タブでもう一方へ切替（再診断なし）
// - アーキタイプカードの文言は archetypes.ts の定数（コピー定義v1）をそのまま表示
// - 微調整は Aaker スコアのスライダー編集のみ（AI再生成はv1ではしない）
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { ConnectModal } from './ConnectModal'
import { Slider } from '@/components/ui/slider'
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
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
} from 'recharts'
import { toast } from 'sonner'
import { ArrowLeft, Download, SlidersHorizontal, Check, X, Unplug, RotateCcw } from 'lucide-react'
import { ARCHETYPE_BY_KEY, AAKER_CITATION, type ArchetypeKey } from '../../../lib/archetypes'
import type { FrameworkKey } from '../../../lib/questions'
import type { DiagnosisResult, AakerScoreItem } from '../../../lib/diagnosis'

type StoredDiagnosis = DiagnosisResult & {
  adjusted?: boolean
  generated_at?: string
  framework_at_generation?: string
}

interface Step5Props {
  sessionId: string
  framework: FrameworkKey | ''
  diagnosis: StoredDiagnosis | null
  companyName: string
  onSaveField: (data: Record<string, unknown>) => Promise<void>
  onBack: () => void
}

const radarConfig = {
  // アプリ青アクセント（DB design_tokens(app) → --ds-app-accent）。
  // ChartContainer が --color-score: var(--ds-app-accent) を生成し、Radar の fill/stroke が解決する。
  score: { label: 'スコア', color: 'var(--ds-app-accent)' },
}

export function Step5Result({ sessionId, framework, diagnosis, companyName, onSaveField, onBack }: Step5Props) {
  const router = useRouter()
  const defaultTab: FrameworkKey = framework === 'archetype' ? 'archetype' : 'aaker'
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false)

  // 最初からやり直す（STPと同パターン: 現セッションを完了化→新規セッション作成→遷移）
  const handleRestart = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('認証エラーが発生しました')
        return
      }
      await fetch(`/api/tools/personality/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionData: { completed: true }, status: 'completed' }),
      })
      const res = await fetch('/api/tools/personality/sessions', {
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
      router.replace(`/tools/personality/app/${newSessionId}`)
    } catch {
      toast.error('エラーが発生しました')
    }
  }, [sessionId, router])
  const [editing, setEditing] = useState(false)
  const [editScores, setEditScores] = useState<AakerScoreItem[]>([])
  const [savingScores, setSavingScores] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [localDiagnosis, setLocalDiagnosis] = useState<StoredDiagnosis | null>(diagnosis)

  // 本体連携: 管理者判定（admin_users に存在するユーザーのみ連携ボタンを表示）
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [userId, setUserId] = useState('')
  const [connectOpen, setConnectOpen] = useState(false)

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        setUserId(user.id)

        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('company_id')
          .eq('auth_id', user.id)
          .maybeSingle()

        if (adminUser?.company_id) setIsAdminUser(true)
      } catch {
        console.error('[PersonalityStep5] admin_users確認エラー')
      } finally {
        setCheckingAdmin(false)
      }
    }
    checkAdminStatus()
  }, [])

  const d = localDiagnosis

  // --- 微調整（Aaker スコアのスライダー編集） ---
  const startEdit = () => {
    if (!d) return
    setEditScores(d.aaker_scores.map(s => ({ ...s })))
    setEditing(true)
  }

  const saveEdit = useCallback(async () => {
    if (!d) return
    setSavingScores(true)
    try {
      const updated: StoredDiagnosis = { ...d, aaker_scores: editScores, adjusted: true }
      await onSaveField({ diagnosis: updated })
      setLocalDiagnosis(updated)
      setEditing(false)
      toast.success('スコアを調整しました')
    } catch {
      toast.error('スコアの保存に失敗しました')
    } finally {
      setSavingScores(false)
    }
  }, [d, editScores, onSaveField])

  // --- PDF出力 ---
  const handleExportPdf = useCallback(async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/tools/personality/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'PDF生成に失敗しました')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `personality-${companyName || 'diagnosis'}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDFをダウンロードしました')
    } catch {
      toast.error('PDF生成中にエラーが発生しました')
    } finally {
      setExporting(false)
    }
  }, [sessionId, companyName])

  if (!d || !d.aaker_scores) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-6">Step 5: 診断結果</h1>
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              診断結果がまだありません。Step 4 でAI診断を実行してください。
            </p>
          </CardContent>
        </Card>
        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-3 flex justify-start">
          <Button variant="outline" onClick={onBack} className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            戻る
          </Button>
        </div>
      </div>
    )
  }

  const chartData = d.aaker_scores.map(s => ({ name: s.label, score: s.score }))
  const primaryDef = ARCHETYPE_BY_KEY[d.archetype.primary.key as ArchetypeKey]
  const secondaryDef = ARCHETYPE_BY_KEY[d.archetype.secondary.key as ArchetypeKey]

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Step 5: 診断結果</h1>
      <p className="mb-5 text-[13px] text-muted-foreground">
        診断結果を確認し、スコアの微調整・PDF出力・branding.bz への連携を行いましょう
      </p>

      {/* 選択フレームワークの結果のみ表示（タブ切替は廃止・仕様改定） */}
      {defaultTab === 'aaker' ? (
        <div className="space-y-4">
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold text-foreground">5次元スコア</h2>
                <div className="flex items-center gap-2">
                  {d.adjusted && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-700">
                      ※スコア調整済み
                    </span>
                  )}
                  {!editing && (
                    <Button variant="outline" size="sm" onClick={startEdit} className="gap-1 h-8">
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      微調整
                    </Button>
                  )}
                </div>
              </div>

              {/* レーダーチャート（上限5・ポータルと同設定） */}
              {!editing && (
                <div className="w-full max-w-[420px] mx-auto mb-4">
                  <ChartContainer config={radarConfig} className="aspect-square">
                    <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="77%">
                      <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                      <PolarGrid />
                      <PolarAngleAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 10 }} tickCount={6} />
                      <Radar
                        dataKey="score"
                        fill="var(--color-score)"
                        fillOpacity={0.2}
                        stroke="var(--color-score)"
                        strokeWidth={2}
                        dot={{ r: 4, fillOpacity: 1, fill: 'var(--color-score)' }}
                      />
                    </RadarChart>
                  </ChartContainer>
                </div>
              )}

              {/* 次元リスト（表示モード） or スライダー（編集モード） */}
              <div className="space-y-3">
                {(editing ? editScores : d.aaker_scores).map((s, i) => (
                  <div key={s.dimension} className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-foreground">{s.label}</span>
                        {!editing && s.copy && (
                          <span className="ml-2 text-xs font-semibold text-ds-app-accent-hover">{s.copy}</span>
                        )}
                      </div>
                      <div className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-ds-app-accent text-sm font-bold text-white">
                        {s.score}
                      </div>
                    </div>
                    {editing ? (
                      <div className="mt-3">
                        <Slider
                          value={[s.score]}
                          min={1}
                          max={5}
                          step={1}
                          onValueChange={([v]) => {
                            setEditScores(prev => prev.map((p, pi) => pi === i ? { ...p, score: v } : p))
                          }}
                        />
                      </div>
                    ) : (
                      s.description && (
                        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{s.description}</p>
                      )
                    )}
                  </div>
                ))}
              </div>

              {editing && (
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={savingScores} className="gap-1">
                    <X className="h-3.5 w-3.5" />
                    キャンセル
                  </Button>
                  <Button size="sm" onClick={saveEdit} disabled={savingScores} className="gap-1">
                    <Check className="h-3.5 w-3.5" />
                    {savingScores ? '保存中...' : 'この調整で保存'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 主人格カード（大）: label＋copy＋description＋keywords — コピー定義v1の文言 */}
          {primaryDef && (
            <Card className="border-2 border-ds-app-accent bg-blue-50/40 shadow-none">
              <CardContent className="p-6">
                <p className="text-[11px] font-semibold tracking-wide text-ds-app-accent-hover mb-1">主人格</p>
                <h2 className="text-2xl font-bold text-foreground">{primaryDef.label}</h2>
                <p className="mt-1 text-base font-semibold text-ds-app-accent-hover">{primaryDef.copy}</p>
                <p className="mt-3 text-sm text-foreground/80 leading-relaxed">{primaryDef.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {primaryDef.keywords.map(k => (
                    <span key={k} className="rounded-full bg-ds-app-accent px-3 py-1 text-xs font-medium text-white">{k}</span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 副人格カード（小）: label＋copy＋keywords のみ */}
          {secondaryDef && (
            <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
              <CardContent className="p-5">
                <p className="text-[11px] font-semibold tracking-wide text-muted-foreground mb-1">副人格</p>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <h3 className="text-lg font-bold text-foreground">{secondaryDef.label}</h3>
                  <p className="text-sm font-semibold text-muted-foreground">{secondaryDef.copy}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {secondaryDef.keywords.map(k => (
                    <span key={k} className="rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-700">{k}</span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 診断の根拠（AIが生成した企業固有の理由文） */}
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5">
              <h3 className="text-sm font-bold text-foreground mb-3">あなたのブランドがこの型である理由</h3>
              <div className="space-y-3">
                {d.archetype.primary.description && (
                  <div>
                    <p className="text-xs font-semibold text-ds-app-accent-hover mb-1">{primaryDef?.label}（主人格）</p>
                    <p className="text-sm text-foreground/80 leading-relaxed">{d.archetype.primary.description}</p>
                  </div>
                )}
                {d.archetype.secondary.description && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">{secondaryDef?.label}（副人格）</p>
                    <p className="text-sm text-foreground/80 leading-relaxed">{d.archetype.secondary.description}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* アーキタイプ特性（本体連携時の traits 候補） */}
          {d.archetype_traits?.length > 0 && (
            <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
              <CardContent className="p-5">
                <h3 className="text-sm font-bold text-foreground mb-3">この型から導かれる特性</h3>
                <div className="space-y-3">
                  {d.archetype_traits.map((t, i) => (
                    <div key={i} className="rounded-lg border border-gray-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <span className="text-sm font-bold text-foreground">{t.name}</span>
                          {t.copy && <span className="ml-2 text-xs font-semibold text-ds-app-accent-hover">{t.copy}</span>}
                        </div>
                        <div className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-ds-app-accent text-sm font-bold text-white">
                          {t.score}
                        </div>
                      </div>
                      {t.description && (
                        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{t.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ===== 共通表示: 物語文・トーン・期待タグ ===== */}
      <Card className="mt-4 bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5 space-y-4">
          {d.personality_summary && (
            <div>
              <h3 className="text-sm font-bold text-foreground mb-2">パーソナリティ概要</h3>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{d.personality_summary}</p>
            </div>
          )}
          {d.tone_of_voice && (
            <div>
              <h3 className="text-sm font-bold text-foreground mb-2">トーンオブボイス</h3>
              <p className="text-sm text-foreground/80 leading-relaxed">{d.tone_of_voice}</p>
            </div>
          )}
          {d.communication_style && (
            <div>
              <h3 className="text-sm font-bold text-foreground mb-2">コミュニケーションスタイル</h3>
              <p className="text-sm text-foreground/80 leading-relaxed">{d.communication_style}</p>
            </div>
          )}
          {d.tone_rules?.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-foreground mb-2">表現ルール</h3>
              <div className="space-y-2">
                {d.tone_rules.map((r, i) => (
                  <div key={i} className="rounded-lg border border-gray-200 bg-white p-4">
                    <p className="text-sm font-semibold text-foreground">{r.rule_text}</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {r.ng_example && (
                        <div className="rounded-md bg-red-50 px-3 py-2">
                          <p className="text-[11px] font-bold text-red-600 mb-0.5">NG例</p>
                          <p className="text-xs text-red-700/90 leading-relaxed">{r.ng_example}</p>
                        </div>
                      )}
                      {r.ok_example && (
                        <div className="rounded-md bg-green-50 px-3 py-2">
                          <p className="text-[11px] font-bold text-green-700 mb-0.5">OK例</p>
                          <p className="text-xs text-green-800/90 leading-relaxed">{r.ok_example}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {d.expected_tags?.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-foreground mb-2">期待される印象タグ</h3>
              <div className="flex flex-wrap gap-2">
                {d.expected_tags.map(t => (
                  <span key={t} className="rounded-full border border-ds-app-accent bg-blue-50 px-3 py-1 text-xs font-medium text-ds-app-accent-hover">{t}</span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 出典表記 */}
      <p className="mt-3 text-[11px] text-muted-foreground">{AAKER_CITATION}</p>

      {/* ===== 本体連携（管理者のみ） ===== */}
      {!checkingAdmin && (
        <Card className="mt-4 bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <h3 className="text-sm font-bold text-foreground mb-2">branding.bz への連携</h3>
            {isAdminUser ? (
              <>
                <p className="text-xs text-muted-foreground mb-3">
                  診断結果をブランド管理プラットフォームに登録できます。連携する項目は次の画面で選択します。
                </p>
                <Button variant="outline" onClick={() => setConnectOpen(true)} className="gap-1.5">
                  <Unplug className="h-4 w-4" />
                  連携する項目を選ぶ
                </Button>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                本体への連携には branding.bz の企業アカウント（管理者）が必要です。診断結果はPDFでダウンロードしてご活用ください。
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 連携モーダル */}
      {isAdminUser && userId && framework && (
        <ConnectModal
          sessionId={sessionId}
          userId={userId}
          diagnosis={d}
          framework={framework}
          open={connectOpen}
          onOpenChange={setConnectOpen}
        />
      )}

      {/* ===== 最初からやり直す ===== */}
      <div className="mt-4 text-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setRestartConfirmOpen(true)}
          className="text-xs text-gray-500"
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          最初からやり直す
        </Button>
      </div>

      {/* フッターナビゲーション */}
      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-3 flex justify-between">
        <Button variant="outline" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          戻る
        </Button>
        <Button onClick={handleExportPdf} disabled={exporting} className="gap-1">
          <Download className="h-4 w-4" />
          {exporting ? 'PDF生成中...' : 'PDFをダウンロード'}
        </Button>
      </div>

      {/* やり直しの確認ダイアログ */}
      <AlertDialog open={restartConfirmOpen} onOpenChange={setRestartConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>最初からやり直す</AlertDialogTitle>
            <AlertDialogDescription>
              診断結果は保存されています。新しい診断を始めますか？
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
