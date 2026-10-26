'use client'

// ポータル: サーベイ結果（読み取り専用）
// 一覧から選び、管理画面と同じ結果ビュー（SurveyResults コンポーネント）を表示する。
// 区分ごとの表示設定（設定画面）で出し分ける。
import { useCallback, useEffect, useRef, useState } from 'react'
import { usePortalAuth } from '../components/PortalDataProvider'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ClipboardList } from 'lucide-react'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { isPortalPageVisibleForRole } from '@/lib/constants/member-roles'
import { PlanUpsell } from '@/components/billing/plan-gate'
import { can } from '@/lib/billing/entitlements'
import { isFeatureEnabled } from '@/lib/constants/feature-toggles'
import { FeatureDisabledNotice } from '@/components/billing/feature-disabled'
import {
  SurveyResults,
  type InnerScoreData,
  type SurveyResultsQuestion,
  type InsightKey,
} from '@/components/brand-score/SurveyResults'

type SurveyListItem = {
  id: string
  title: string
  status: string
  created_at: string
  ends_at: string | null
  insights: Partial<Record<InsightKey, string>> | null
}

// 一覧とサーベイごとの結果を保存し、再読込（引っ張り更新を含む）後もすぐ表示する。
// 表示した後に裏で取り直して差し替える（lib/page-cache.ts の persist）
type ResultCache = { score: InnerScoreData | null; questions: SurveyResultsQuestion[] }
const listCacheKey = (companyId: string) => `portal-survey-list-${companyId}`
const resultCacheKey = (surveyId: string) => `portal-survey-result-${surveyId}`

export default function PortalSurveyPage() {
  const { companyId, company, roleCategory, isAdmin } = usePortalAuth()
  const visible = isPortalPageVisibleForRole(company, 'survey', roleCategory, isAdmin)

  // 保存分（初回の描画でだけ読む）。一覧の先頭＝既定で選ぶサーベイの結果もあれば一緒に出す
  const [initial] = useState(() => {
    const list = companyId ? getPageCache<SurveyListItem[]>(listCacheKey(companyId), { persist: true }) : null
    const firstId = list?.[0]?.id ?? null
    const result = firstId ? getPageCache<ResultCache>(resultCacheKey(firstId), { persist: true }) : null
    return { list, firstId, result }
  })

  const [surveys, setSurveys] = useState<SurveyListItem[]>(initial.list ?? [])
  const [selectedId, setSelectedId] = useState<string | null>(initial.firstId)
  const [listLoading, setListLoading] = useState(!initial.list)

  const [score, setScore] = useState<InnerScoreData | null>(initial.result?.score ?? null)
  const [questions, setQuestions] = useState<SurveyResultsQuestion[]>(initial.result?.questions ?? [])
  const [resultLoading, setResultLoading] = useState(false)
  // 結果を取り終えたサーベイの ID。一覧の取得中や、選択直後で結果の取得がまだ始まっていない間に
  // 「まだ回答結果がありません」を出さないため（取り終えるまではスケルトンを出す）
  const [resultFor, setResultFor] = useState<string | null>(initial.result ? initial.firstId : null)
  // 最後に取得を始めたサーベイ。素早く切り替えたとき、前のサーベイの応答が後から届いても反映しない
  const latestRequest = useRef<string | null>(null)

  // サーベイ一覧を取得（結果があるのは active / closed）
  useEffect(() => {
    if (!companyId || !visible) return
    let cancelled = false
    ;(async () => {
      // 保存分を出しているときはスケルトンに戻さず、裏で取り直す
      try {
        const res = await fetch(`/api/brand-score/surveys?company_id=${companyId}`)
        const data = await res.json()
        if (cancelled) return
        const list: SurveyListItem[] = (data.surveys ?? []).filter(
          (s: SurveyListItem) => s.status === 'active' || s.status === 'closed',
        )
        setSurveys(list)
        setPageCache(listCacheKey(companyId), list, { persist: true })
        // 既定は最新（API は作成日降順）。選んでいるサーベイがまだ一覧にあれば選択を保つ
        setSelectedId((prev) => (prev && list.some((s) => s.id === prev) ? prev : list[0]?.id ?? null))
      } catch {
        if (!cancelled) setSurveys([])
      } finally {
        if (!cancelled) setListLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [companyId, visible])

  // 選択サーベイの結果（inner-score + questions）を取得
  const loadResult = useCallback(async (surveyId: string, cid: string) => {
    latestRequest.current = surveyId
    // 保存分があればすぐ出し、スケルトンにせず裏で取り直す
    const saved = getPageCache<ResultCache>(resultCacheKey(surveyId), { persist: true })
    if (saved) {
      setScore(saved.score)
      setQuestions(saved.questions)
      setResultFor(surveyId)
      setResultLoading(false)
    } else {
      setResultLoading(true)
      setScore(null)
    }
    try {
      const [scoreRes, qRes] = await Promise.all([
        fetch(`/api/brand-score/inner-score?company_id=${cid}&survey_id=${surveyId}`),
        fetch(`/api/brand-score/surveys/${surveyId}/questions`),
      ])
      const scoreData = await scoreRes.json()
      const qData = await qRes.json()
      if (latestRequest.current !== surveyId) return
      const nextScore = scoreData.score === null && scoreData.message ? null : (scoreData as InnerScoreData)
      const nextQuestions = (qData.questions ?? []) as SurveyResultsQuestion[]
      setScore(nextScore)
      setQuestions(nextQuestions)
      setPageCache<ResultCache>(resultCacheKey(surveyId), { score: nextScore, questions: nextQuestions }, { persist: true })
    } catch {
      // 取り直しに失敗しても、保存分を出しているならそのまま残す
      if (latestRequest.current === surveyId && !saved) setScore(null)
    } finally {
      if (latestRequest.current === surveyId) {
        setResultLoading(false)
        setResultFor(surveyId)
      }
    }
  }, [])

  useEffect(() => {
    if (selectedId && companyId) loadResult(selectedId, companyId)
  }, [selectedId, companyId, loadResult])

  const selectedSurvey = surveys.find(s => s.id === selectedId) ?? null

  // プラン外: 隠さずアップセル面を出す（実効プランで判定）
  // 会社が機能トグルでオフにしている場合は、プラン案内より先に閉じる
  if (!isFeatureEnabled(company, 'survey_enabled')) return <FeatureDisabledNotice />

  if (!can(company, 'innerSurvey')) {
    return (
      <div className="max-w-4xl mx-auto px-5 pt-4 pb-10">
        <PlanUpsell
          readOnly={!isAdmin}
          company={company}
          feature="innerSurvey"
          title="インナーサーベイ結果を見るには"
          benefits={[
            '社員サーベイで理念の浸透度を可視化',
            '浸透の5段階で現在地を把握',
            '部署ごとの違いを比較',
            'ID INC. の四半期レビューで打ち手まで伴走',
          ]}
        />
      </div>
    )
  }

  // 区分で非表示
  if (!visible) {
    return (
      <div className="max-w-4xl mx-auto px-5 pt-4 pb-10">
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground text-[15px] m-0">このページはご利用の区分では表示されません</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-5 pt-4 pb-10 space-y-4">
      {/* サーベイ選択 */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-4 flex items-center gap-3">
          <ClipboardList className="size-4 shrink-0 text-muted-foreground" />
          {listLoading ? (
            <Skeleton className="h-9 w-full max-w-xs" />
          ) : surveys.length === 0 ? (
            <p className="text-sm text-muted-foreground m-0">表示できるサーベイがありません</p>
          ) : (
            <Select value={selectedId ?? undefined} onValueChange={setSelectedId}>
              <SelectTrigger className="h-9 w-full max-w-sm bg-white">
                <SelectValue placeholder="サーベイを選択" />
              </SelectTrigger>
              <SelectContent>
                {surveys.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* 結果 */}
      {listLoading || resultLoading || (selectedId !== null && resultFor !== selectedId) ? (
        <div className="space-y-4">
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5">
              <Skeleton className="h-4 w-32 mb-3" />
              <Skeleton className="h-2 w-full mb-4" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : surveys.length === 0 ? null : score ? (
        <SurveyResults data={score} questions={questions} insights={selectedSurvey?.insights ?? undefined} />
      ) : (
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground text-[15px] m-0">まだ回答結果がありません</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
