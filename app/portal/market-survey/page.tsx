'use client'

// ポータル: 市場調査の結果（読み取り専用）
// 一覧から選び、管理画面と同じ結果ビュー（MarketSurveyResults）を表示する。
// 区分ごとの表示設定（設定画面）で出し分ける。/portal/survey と同じ作り。
import { useCallback, useEffect, useState } from 'react'
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
import { Globe } from 'lucide-react'
import { isPortalPageVisibleForRole } from '@/lib/constants/member-roles'
import {
  MarketSurveyResults,
  type MarketSurveyMeta,
  type MarketStageScore,
  type MarketExtrasData,
} from '@/components/brand-score/MarketSurveyResults'

type RankRow = { name: string; value: number; isSelf: boolean }

type SurveyListItem = {
  id: string
  title: string
  status: string
  fielded_to: string | null
}

export default function PortalMarketSurveyPage() {
  const { companyId, company, roleCategory, isAdmin } = usePortalAuth()
  const visible = isPortalPageVisibleForRole(company, 'market_survey', roleCategory, isAdmin)

  const [surveys, setSurveys] = useState<SurveyListItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [listLoading, setListLoading] = useState(true)

  const [survey, setSurvey] = useState<MarketSurveyMeta | null>(null)
  const [stageScores, setStageScores] = useState<MarketStageScore[]>([])
  const [ranking, setRanking] = useState<Record<string, RankRow[]>>({})
  const [blockCount, setBlockCount] = useState(0)
  const [extras, setExtras] = useState<MarketExtrasData | null>(null)
  const [resultLoading, setResultLoading] = useState(false)

  // 一覧を取得。手で「過年度」にしたものは出さない
  useEffect(() => {
    if (!companyId || !visible) return
    let cancelled = false
    ;(async () => {
      setListLoading(true)
      try {
        const res = await fetch(`/api/brand-score/market-surveys?company_id=${companyId}`)
        const data = await res.json()
        const list: SurveyListItem[] = (data.surveys ?? []).filter(
          (s: SurveyListItem) => s.status !== 'archived'
        )
        if (cancelled) return
        setSurveys(list)
        if (list.length > 0) setSelectedId(list[0].id)
      } catch (err) {
        console.error('[PortalMarketSurvey] 一覧の取得エラー:', err)
      } finally {
        if (!cancelled) setListLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [companyId, visible])

  const loadResult = useCallback(async (surveyId: string) => {
    setResultLoading(true)
    try {
      const res = await fetch(`/api/brand-score/market-surveys/${surveyId}`)
      if (!res.ok) return
      const data = await res.json()
      setSurvey(data.survey ?? null)
      setStageScores(data.stageScores ?? [])
      setRanking(data.ranking ?? {})
      setBlockCount((data.blocks ?? []).length)
      setExtras(data.extras ?? null)
    } catch (err) {
      console.error('[PortalMarketSurvey] 結果の取得エラー:', err)
    } finally {
      setResultLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId) loadResult(selectedId)
  }, [selectedId, loadResult])

  // 区分で非表示
  if (!visible) {
    return (
      <div className="max-w-4xl mx-auto px-5 pt-4 pb-10">
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground text-[15px] m-0">
              このページはご利用の区分では表示されません
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-5 pt-4 pb-10 space-y-4">
      {/* 調査の選択 */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-4 flex items-center gap-3">
          <Globe className="size-4 shrink-0 text-muted-foreground" />
          {listLoading ? (
            <Skeleton className="h-9 w-full max-w-xs" />
          ) : surveys.length === 0 ? (
            <p className="text-sm text-muted-foreground m-0">表示できる市場調査がありません</p>
          ) : (
            <Select value={selectedId ?? undefined} onValueChange={setSelectedId}>
              <SelectTrigger className="h-9 w-full max-w-sm bg-white">
                <SelectValue placeholder="調査を選択" />
              </SelectTrigger>
              <SelectContent>
                {surveys.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                    {/* 反映中かどうかは実施日の新しさで決まるので、状態ではなく
                        いつの調査かを添える */}
                    {s.fielded_to
                      ? `（${new Date(s.fielded_to).getFullYear()}年）`
                      : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* 結果 */}
      {resultLoading ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="bg-[hsl(0_0%_97%)] border shadow-none">
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-16 mx-auto" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !listLoading && surveys.length === 0 ? null : survey ? (
        <MarketSurveyResults
          survey={survey}
          stageScores={stageScores}
          ranking={ranking}
          blockCount={blockCount}
          extras={extras}
        />
      ) : (
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground text-[15px] m-0">まだ結果がありません</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
