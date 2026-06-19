'use client'

// スーパー管理画面: コピーAI ワークベンチ（superadmin専用）。
// 読み取りは client supabase（superadminセッション・copy_*_superadmin_all RLSで全件可視）、
// 変更系は既存 superadminガードAPI（Bearer）。進捗・選択状態はすべてDBから決定論導出（リロード復元可）。
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StepProgressBar } from '@/components/shared/StepProgressBar'
import { ArrowLeft, Plus } from 'lucide-react'
import ProjectSetup from './_components/ProjectSetup'
import InsightGate from './_components/InsightGate'
import AngleSelector from './_components/AngleSelector'
import DraftWorkbench from './_components/DraftWorkbench'
import ReviewPanel from './_components/ReviewPanel'
import type { CopyProject, CopyInsight, CopyAngle, CopyDraft, CopyReview } from './_components/types'

const STEPS = [
  { label: '基本' },
  { label: 'インサイト' },
  { label: '切り口' },
  { label: '生成' },
  { label: '批評' },
]

export default function CopyWorkbenchPage() {
  const params = useParams()
  const companyId = params.id as string

  const [projects, setProjects] = useState<CopyProject[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const [insights, setInsights] = useState<CopyInsight[]>([])
  const [angles, setAngles] = useState<CopyAngle[]>([])
  const [drafts, setDrafts] = useState<CopyDraft[]>([])
  const [reviews, setReviews] = useState<CopyReview[]>([])
  const [step, setStep] = useState(1)
  const [reviewTarget, setReviewTarget] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProjects = useCallback(async () => {
    const { data } = await supabase
      .from('copy_projects')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
    setProjects((data as CopyProject[]) ?? [])
    setLoading(false)
  }, [companyId])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const active = projects.find((p) => p.id === activeId) ?? null

  // プロジェクト配下を一括取得（変更後も呼ぶ）。draftはreviewの draft_id 解決用に project 全件。
  const loadProjectData = useCallback(async (projectId: string) => {
    const [insRes, angRes, draRes] = await Promise.all([
      supabase.from('copy_insights').select('*').eq('project_id', projectId).order('created_at', { ascending: true }),
      supabase.from('copy_angles').select('*').eq('project_id', projectId).order('created_at', { ascending: true }),
      supabase.from('copy_drafts').select('*').eq('project_id', projectId).order('created_at', { ascending: true }),
    ])
    const dr = (draRes.data as CopyDraft[]) ?? []
    setInsights((insRes.data as CopyInsight[]) ?? [])
    setAngles((angRes.data as CopyAngle[]) ?? [])
    setDrafts(dr)
    const draftIds = dr.map((d) => d.id)
    if (draftIds.length > 0) {
      const { data: revs } = await supabase.from('copy_quality_reviews').select('*').in('draft_id', draftIds)
      setReviews((revs as CopyReview[]) ?? [])
    } else {
      setReviews([])
    }
  }, [])

  const reload = useCallback(async () => {
    if (activeId) await loadProjectData(activeId)
  }, [activeId, loadProjectData])

  // プロジェクト選択時にデータ取得＋進捗をDB状態から復元
  useEffect(() => {
    if (!activeId) return
    loadProjectData(activeId)
  }, [activeId, loadProjectData])

  // 完了判定（DB状態から決定論導出）
  const completion = useMemo(() => {
    const c1 = !!active && !!active.persona_id
    const c2 = insights.some((i) => i.is_selected)
    const c3 = angles.some((a) => a.is_selected)
    const c4 = drafts.length > 0
    const c5 = reviews.length > 0
    return { c1, c2, c3, c4, c5 }
  }, [active, insights, angles, drafts, reviews])

  // アクティブ化直後、最初の未完ステップへジャンプ（ガイド・行き来は自由）
  useEffect(() => {
    if (!activeId) return
    const { c1, c2, c3, c4 } = completion
    setStep(!c1 ? 1 : !c2 ? 2 : !c3 ? 3 : !c4 ? 4 : 5)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  const openReview = (draftId: string) => {
    setReviewTarget(draftId)
    setStep(5)
  }

  // ---- プロジェクト未選択: 一覧＋新規 ----
  if (!activeId) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-8">
        <Link href={`/superadmin/companies/${companyId}`} className="mb-4 inline-flex items-center text-[13px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> 企業詳細へ戻る
        </Link>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">コピーAI ワークベンチ</h1>
            <p className="text-[13px] text-muted-foreground mt-1">本音→切り口→生成→批評で、退屈でないコピーを作る。</p>
          </div>
          <Button onClick={() => setCreating((v) => !v)}>
            <Plus className="mr-1 h-4 w-4" /> 新規プロジェクト
          </Button>
        </div>

        {creating && (
          <div className="mb-6">
            <ProjectSetup
              companyId={companyId}
              onCreated={async (id) => {
                setCreating(false)
                await loadProjects()
                setActiveId(id)
              }}
            />
          </div>
        )}

        {loading ? (
          <p className="text-[13px] text-muted-foreground">読み込み中…</p>
        ) : projects.length === 0 ? (
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5">
              <p className="text-[13px] text-muted-foreground">まだプロジェクトがありません。「新規プロジェクト」から始めてください。</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setActiveId(p.id)}
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors hover:border-gray-300"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-gray-900">{p.name}</p>
                  {p.brief && <p className="truncate text-[13px] text-muted-foreground">{p.brief}</p>}
                </div>
                {!p.persona_id && <Badge className="ml-2 shrink-0 bg-amber-100 text-amber-800 hover:bg-amber-100">ペルソナ未設定</Badge>}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ---- プロジェクト選択中: ワークベンチ ----
  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <button onClick={() => setActiveId(null)} className="mb-4 inline-flex items-center text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> プロジェクト一覧へ
      </button>

      <h1 className="text-2xl font-bold text-foreground mb-1">{active?.name}</h1>
      <p className="mb-5 text-[13px] text-muted-foreground">{active?.brief || 'ブリーフ未設定'}</p>

      <div className="mb-6">
        <StepProgressBar steps={STEPS} currentStep={step} />
      </div>

      {/* ステップ・ジャンプ（檻にしない） */}
      <div className="mb-4 flex flex-wrap gap-2">
        {STEPS.map((s, i) => {
          const n = i + 1
          const done = [completion.c1, completion.c2, completion.c3, completion.c4, completion.c5][i]
          return (
            <button
              key={s.label}
              onClick={() => setStep(n)}
              className={`min-h-9 rounded-full border px-3 text-[13px] transition-colors ${
                step === n ? 'border-ds-app-accent bg-ds-app-accent text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              {done ? '✓ ' : ''}{n}. {s.label}
            </button>
          )
        })}
      </div>

      {step === 1 && (
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <p className="text-sm font-bold mb-1">このプロジェクトの基本</p>
            <p className="text-[13px] text-muted-foreground">
              ペルソナ: {active?.persona_id ? '設定済み' : <span className="text-amber-700">未設定（インサイト生成不可）</span>}
            </p>
            <p className="mt-3 text-[13px] text-muted-foreground">
              次へ：左の「2. インサイト」から、現場の声に接地した本音を抽出します。
            </p>
          </CardContent>
        </Card>
      )}
      {step === 2 && <InsightGate projectId={activeId} insights={insights} onReload={reload} />}
      {step === 3 && (
        <AngleSelector
          projectId={activeId}
          angles={angles}
          hasSelectedInsight={completion.c2}
          onReload={reload}
          onNeedInsight={() => setStep(2)}
        />
      )}
      {step === 4 && <DraftWorkbench projectId={activeId} drafts={drafts} reviews={reviews} onReload={reload} onReview={openReview} />}
      {step === 5 && <ReviewPanel drafts={drafts} reviews={reviews} targetDraftId={reviewTarget} onReload={reload} />}
    </div>
  )
}
