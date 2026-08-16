'use client'

// スーパー管理画面: 企業一覧ページ
// 構築度列: 決定論・非保存（詳細ページのバッジと同じ lib/brand/build-score で表示時に算出）。
// 会社ごとにクエリを繰り返さず、対象テーブルを全社ぶん一括取得してメモリで会社別に集計する。
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Building2, Plus, ArrowRight } from 'lucide-react'
import { Fab, FabButton } from '@/components/ui/fab'
import { CompanyCreateDialog } from './CompanyCreateDialog'
import { computeBuildScore, deriveBuildScoreInput, type BuildScore } from '@/lib/brand/build-score'
import { resolvePlanDisplay } from '@/lib/billing/plan-display'
import type { ElementKind, ElementRef } from '@/lib/brand/elements-catalog'
import type { RelationRow } from '@/lib/brand/map-data'

type CompanyWithCount = {
  id: string
  name: string
  logo_url: string | null
  created_at: string
  member_count: number
  admin_count: number
  plan: string | null
  plan_expires_at: string | null
  is_demo: boolean | null
}

const SCORE_TONES: Record<string, string> = {
  amber: 'bg-amber-100 text-amber-800',
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-green-100 text-green-800',
}

// 全社ぶんの要素・関係・ルールを一括で読み、会社ごとに構築度を算出する（書き込みなし）。
// ラベルはスコア計算に使わないため空文字でよい（deriveBuildScoreInput は kind/id と件数だけ見る）。
async function fetchBuildScores(): Promise<Record<string, BuildScore>> {
  const [philR, vpR, ppR, ruleR, personaR, deR, relR] = await Promise.all([
    supabase.from('philosophy_elements').select('id, company_id, element_type'),
    supabase.from('value_propositions').select('id, company_id'),
    supabase.from('proof_points').select('id, company_id'),
    supabase.from('governance_rules').select('id, company_id, ng_example, ok_example'),
    supabase.from('brand_personas').select('id, company_id'),
    supabase.from('desired_evidence').select('id, company_id'),
    supabase
      .from('element_relations')
      .select('id, company_id, source_kind, source_id, target_kind, target_id, relation_type, note'),
  ])

  type Row = { id: string; company_id: string }
  const byCompany = new Map<
    string,
    {
      catalog: ElementRef[]
      philTypes: Record<string, string>
      relations: RelationRow[]
      rules: { ng_example: string | null; ok_example: string | null }[]
    }
  >()
  const bucket = (cid: string) => {
    let b = byCompany.get(cid)
    if (!b) {
      b = { catalog: [], philTypes: {}, relations: [], rules: [] }
      byCompany.set(cid, b)
    }
    return b
  }
  const addKind = (rows: Row[] | null, kind: ElementKind) => {
    for (const r of rows || []) bucket(r.company_id).catalog.push({ kind, id: r.id, label: '' })
  }
  for (const r of (philR.data as (Row & { element_type: string })[] | null) || []) {
    const b = bucket(r.company_id)
    b.catalog.push({ kind: 'philosophy_element', id: r.id, label: '' })
    b.philTypes[r.id] = r.element_type
  }
  addKind(vpR.data as Row[] | null, 'value_proposition')
  addKind(ppR.data as Row[] | null, 'proof_point')
  addKind(personaR.data as Row[] | null, 'persona')
  addKind(deR.data as Row[] | null, 'desired_evidence')
  for (const r of (ruleR.data as (Row & { ng_example: string | null; ok_example: string | null })[] | null) || []) {
    const b = bucket(r.company_id)
    b.catalog.push({ kind: 'governance_rule', id: r.id, label: '' })
    b.rules.push({ ng_example: r.ng_example, ok_example: r.ok_example })
  }
  for (const r of ((relR.data as (RelationRow & { company_id: string })[] | null) || [])) {
    bucket(r.company_id).relations.push(r)
  }

  const out: Record<string, BuildScore> = {}
  for (const [cid, b] of byCompany) out[cid] = computeBuildScore(deriveBuildScoreInput(b))
  return out
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  // 構築度（会社id → スコア）。一覧本体とは独立に読み込む（失敗しても一覧は出す）
  const [scores, setScores] = useState<Record<string, BuildScore> | null>(null)

  const fetchCompanies = useCallback(async () => {
    try {
      // 全企業を取得
      const { data: companiesData, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('[SuperAdmin] 企業一覧取得エラー:', error.message)
        setLoading(false)
        return
      }

      // 各企業の社員数と管理者数を取得
      const companiesWithCounts = await Promise.all(
        (companiesData || []).map(async (company) => {
          // 社員数
          const { count: memberCount } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', company.id)

          // 管理者数
          const { count: adminCount } = await supabase
            .from('admin_users')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', company.id)

          return {
            id: company.id,
            name: company.name || '（名前なし）',
            logo_url: company.logo_url,
            created_at: company.created_at,
            member_count: memberCount || 0,
            admin_count: adminCount || 0,
            // select('*') なので Phase 1 で足したカラムはそのまま入っている
            plan: company.plan ?? null,
            plan_expires_at: company.plan_expires_at ?? null,
            is_demo: company.is_demo ?? null,
          }
        })
      )

      setCompanies(companiesWithCounts)
    } catch (err) {
      console.error('[SuperAdmin] 企業一覧取得例外:', err)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchCompanies()
    // 構築度は別トラックで取得（読み取りのみ・失敗しても一覧表示は妨げない）
    fetchBuildScores()
      .then(setScores)
      .catch((err) => {
        console.error('[SuperAdmin] 構築度の算出エラー:', err)
        setScores({})
      })
  }, [fetchCompanies])

  // ============================================
  // Render
  // ============================================

  if (loading) {
    return (
      <div>
        {/* 企業一覧テーブル（新規登録は右下FAB。ヘッダーボタン無し） */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-0">
            <div className="overflow-x-auto p-4">
              {/* ヘッダー行: 企業名/従業員数/管理者/作成日/操作 */}
              <div className="flex px-4 py-3 gap-4 border-b border-border">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Skeleton key={i} className="h-4 w-20" />
                ))}
              </div>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex px-4 py-3 gap-4 border-b border-border items-center">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      {/* 新規企業登録 FAB（右下固定・include-bz node の FabButton と同装飾） */}
      <Fab>
        <FabButton onClick={() => setCreateOpen(true)} icon={<Plus size={16} />}>
          新規企業を登録
        </FabButton>
      </Fab>

      {/* 企業登録モーダル */}
      <CompanyCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={fetchCompanies}
      />

      {/* ===== 企業一覧テーブル ===== */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-0">
          {companies.length === 0 ? (
            <p className="text-muted-foreground text-center p-10">企業データがありません</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  {/* 列名は折り返さない（「従業員数」が2行になると行が高くなり読みにくい）。
                      個別に付けると足し忘れるので行にまとめて当てる */}
                  <tr className="border-b text-left text-xs text-muted-foreground [&>th]:whitespace-nowrap">
                    <th className="px-4 py-3 font-medium">企業名</th>
                    <th className="px-4 py-3 font-medium text-center">従業員数</th>
                    <th className="px-4 py-3 font-medium text-center">管理者</th>
                    <th className="px-4 py-3 font-medium text-center">構築度</th>
                    <th className="px-4 py-3 font-medium text-center">プラン</th>
                    <th className="px-4 py-3 font-medium">作成日</th>
                    <th className="px-4 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => (
                    <tr
                      key={company.id}
                      className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        {/* 社名は折り返さず…で省略する。長い社名で行が2段になると
                            他の列と目線が合わなくなるため。
                            ⚠️ 親に min-w-0 が無いと truncate は効かない（子が縮まない） */}
                        <div className="flex min-w-0 items-center gap-2">
                          {company.logo_url ? (
                            <img
                              src={company.logo_url}
                              alt=""
                              className="size-9 rounded-md object-cover shrink-0"
                            />
                          ) : (
                            <div className="size-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                              <Building2 size={16} className="text-muted-foreground" />
                            </div>
                          )}
                          <span
                            className="min-w-0 truncate text-sm font-bold text-foreground"
                            title={company.name}
                          >
                            {company.name}
                          </span>
                          {/* 実顧客が入ってきたときに一覧で見分けられるようにする。
                              プランバッジより目立たせない */}
                          {company.is_demo && (
                            <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500">
                              デモ
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs text-foreground">{company.member_count}名</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs text-foreground">{company.admin_count}名</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {scores === null ? (
                          <Skeleton className="h-4 w-16 mx-auto" />
                        ) : (() => {
                          const s = scores[company.id]
                          // 要素が1つも無い会社はスコア0の羅列にせず「未着手」と示す
                          if (!s || s.total === 0) {
                            return <span className="text-xs text-muted-foreground">未着手</span>
                          }
                          return (
                            <span
                              // バッジは折り返さない（「48 基盤あり」が2行になると行が高くなる）
                              className={`inline-flex items-center gap-1 whitespace-nowrap py-0.5 px-2 rounded-md text-[11px] font-semibold ${SCORE_TONES[s.band.tone] ?? 'bg-gray-100 text-gray-700'}`}
                              title={`${s.band.label}：${s.axes.map((a) => `${a.label} ${a.score}/${a.max}`).join('・')}${s.bonus > 0 ? `・ボーナス+${s.bonus}` : ''}`}
                            >
                              {s.total}
                              <span className="font-normal opacity-80">{s.band.label}</span>
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(() => {
                          const p = resolvePlanDisplay(company)
                          return (
                            <div className="inline-flex flex-col items-center gap-0.5">
                              <span className={`inline-flex items-center py-0.5 px-2 rounded-md text-[11px] font-semibold ${p.toneClass}`}>
                                {p.label}
                              </span>
                              {p.note && (
                                <span className="text-[10px] text-muted-foreground">{p.note}</span>
                              )}
                            </div>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">
                          {new Date(company.created_at).toLocaleDateString('ja-JP')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-ds-app-accent hover:text-ds-app-accent-hover" asChild>
                          <Link href={`/superadmin/companies/${company.id}`}>
                            詳細
                            <ArrowRight size={14} />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 統計サマリー */}
      {/* 実顧客とデモの内訳。デモを実績として読み違えないための表示 */}
      <div className="mt-4 text-xs text-muted-foreground text-right">
        全{companies.length}社（実顧客 {companies.filter((c) => !c.is_demo).length}社 / デモ{' '}
        {companies.filter((c) => c.is_demo).length}社）
      </div>
    </div>
  )
}
