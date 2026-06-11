'use client'

// スーパー管理画面 企業詳細: 「ブランドオントロジー」サマリーハブ。
// 設計原則: 情報の「正」は1箇所、ここはチップとリンクで参照するだけ。
// - 完了判定・件数・点検数値は OntologyBuilderSection（ウィザード）からの onStatusChange 通知を表示
//   （判定ロジックの持ち主はウィザード。ここでは再計算しない）
// - 島・未接続のみマップと同じ純関数（buildBrandMapGraph）で導出（新しい集計APIは作らない）
// - AIレビュー（MapReviewPanel）はここが唯一の置き場。クイックアクションは各セクションへの
//   アンカー移動のみで、機能の実体は持たない。
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchElementsCatalog } from '@/lib/brand/elements-catalog'
import { buildBrandMapGraph, type ProofFkRow, type RelationRow } from '@/lib/brand/map-data'
import OntologyBuilderSection, { type OntologyStatus } from './OntologyBuilderSection'
import { ONTOLOGY_DATA_CHANGED_EVENT, ONTOLOGY_GOTO_STEP_EVENT } from './ontology-events'
import BrandMapSection from './BrandMapSection'
import MapReviewPanel from './MapReviewPanel'
import OutputTestPanel from './OutputTestPanel'
import type { ValuePropositionRef } from './ProofPointsSection'

type MapStats = { islands: number; unconnected: number }

const Chip = ({ label, value, tone = 'gray' }: { label: string; value: string; tone?: 'gray' | 'green' | 'amber' }) => {
  const cls =
    tone === 'green'
      ? 'bg-green-100 text-green-800'
      : tone === 'amber'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-flex items-center gap-1 py-1 px-2.5 rounded-md text-[12px] font-semibold ${cls}`}>
      <span className="font-normal opacity-80">{label}</span>
      {value}
    </span>
  )
}

export default function OntologySummaryHub({
  companyId,
  valuePropositions,
}: {
  companyId: string
  valuePropositions: ValuePropositionRef[]
}) {
  const [status, setStatus] = useState<OntologyStatus | null>(null)
  const [mapStats, setMapStats] = useState<MapStats | null>(null)

  const onStatusChange = useCallback((s: OntologyStatus) => setStatus(s), [])

  // クイックアクション → ウィザードの該当ステップへ切替（実体はステップパネル内）
  const gotoStep = (step: number) => {
    window.dispatchEvent(new CustomEvent(ONTOLOGY_GOTO_STEP_EVENT, { detail: step }))
  }

  // 島・未接続: マップと同じ純関数で導出（表示はここが唯一。マップ側のバッジは撤去済み）
  const fetchMapStats = useCallback(async () => {
    const [catalog, relR, philR, ppR] = await Promise.all([
      fetchElementsCatalog(supabase, companyId),
      supabase
        .from('element_relations')
        .select('id, source_kind, source_id, target_kind, target_id, relation_type, note')
        .eq('company_id', companyId),
      supabase.from('philosophy_elements').select('id, element_type').eq('company_id', companyId),
      supabase.from('proof_points').select('id, value_proposition_id').eq('company_id', companyId),
    ])
    const philTypes: Record<string, string> = {}
    for (const p of (philR.data as { id: string; element_type: string }[] | null) || []) {
      philTypes[p.id] = p.element_type
    }
    const g = buildBrandMapGraph(
      catalog,
      (relR.data as RelationRow[] | null) || [],
      philTypes,
      (ppR.data as ProofFkRow[] | null) || [],
    )
    setMapStats({ islands: g.islandCount, unconnected: g.unconnectedCount })
  }, [companyId])

  // 初回＋下部セクションでのCRUD（ONTOLOGY_DATA_CHANGED_EVENT）で再取得
  useEffect(() => {
    fetchMapStats()
    const handler = () => fetchMapStats()
    window.addEventListener(ONTOLOGY_DATA_CHANGED_EVENT, handler)
    return () => window.removeEventListener(ONTOLOGY_DATA_CHANGED_EVENT, handler)
  }, [fetchMapStats])

  const c = status?.counts
  const insp = status?.inspection ?? null
  // 裏づけチップの分母は「裏づけ対象（提供価値があればVP、無ければバリュー）」の総数
  const backingTotal = insp?.backingTotal ?? 0
  const backed = insp ? Math.max(0, backingTotal - insp.openUnprovenCount) : null
  const backingLabel = insp ? `${insp.backingNoun}の裏づけ` : '裏づけ'
  const conflicts = insp?.baseline['矛盾の明示'] ?? null
  const pending = status?.pendingCount ?? 0

  const statusChip = !status
    ? { label: '読込中...', tone: 'gray' as const }
    : status.complete
      ? { label: pending > 0 ? `構築完了（保留 ${pending}）` : '構築完了', tone: 'green' as const }
      : { label: '構築中', tone: 'amber' as const }

  return (
    <div>
      {/* ヘッダ: タイトル＋状態チップ */}
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <h3 className="text-base font-bold text-foreground m-0">ブランドオントロジー</h3>
        <Chip label="" value={statusChip.label} tone={statusChip.tone} />
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        理念から実績までの体系の現在地です。登録・編集・点検はこのカード内の各ステップで行います。
      </p>

      {/* 件数チップ（5つ） */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        <Chip label="理念" value={c ? String(c.mission + c.vision + c.value) : '–'} />
        {/* 提供価値は任意だが未登録は警告色で気づけるように */}
        <Chip label="提供価値" value={c ? String(c.vp) : '–'} tone={c && c.vp === 0 ? 'amber' : 'gray'} />
        <Chip label="実績" value={c ? String(c.proof) : '–'} />
        <Chip label="ルール" value={c ? String(c.rule) : '–'} />
        <Chip label="関係" value={c ? String(c.relation) : '–'} />
      </div>

      {/* 点検チップ（3つ）— 点検数値の唯一の表示場所 */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <Chip
          label={backingLabel}
          value={insp ? `${backed}/${backingTotal}${pending > 0 ? `（保留${pending}）` : ''}` : '–'}
          tone={insp ? (insp.uncoveredWarnCount > 0 ? 'amber' : 'green') : 'gray'}
        />
        <Chip label="くい違い" value={conflicts === null ? '–' : String(conflicts)} tone={conflicts ? 'amber' : 'gray'} />
        <Chip
          label="島"
          value={mapStats ? `${mapStats.islands}クラスタ・未接続${mapStats.unconnected}件` : '–'}
          tone={mapStats ? (mapStats.islands > 1 || mapStats.unconnected > 0 ? 'amber' : 'green') : 'gray'}
        />
      </div>

      {/* ブランドマップ（常設・唯一の置き場。現状/構造の2ビュー・凡例・クリック詳細） */}
      <div className="mb-3">
        <BrandMapSection companyId={companyId} />
      </div>

      {/* AIレビュー（マップ直下・唯一の置き場） */}
      <div className="mb-3">
        <MapReviewPanel companyId={companyId} />
      </div>

      {/* 出力テスト（オントロジーの効果を注入あり/なしで比較） */}
      <div className="mb-3">
        <OutputTestPanel companyId={companyId} />
      </div>

      {/* クイックアクション（実体は下のステップパネル。該当ステップへの切替のみ） */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => gotoStep(4)}
          className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-[13px] font-semibold text-foreground cursor-pointer hover:bg-muted"
        >
          AIスキャンを実行 →
        </button>
        <button
          type="button"
          onClick={() => gotoStep(5)}
          className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-[13px] font-semibold text-foreground cursor-pointer hover:bg-muted"
        >
          質問に答える{pending > 0 ? `（保留 ${pending}）` : ''} →
        </button>
        <button
          type="button"
          onClick={() => gotoStep(5)}
          className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-[13px] font-semibold text-foreground cursor-pointer hover:bg-muted"
        >
          AI判定（トーン・主張） →
        </button>
      </div>

      {/* ステッパー（常設ナビ）＋各ステップに機能の実体を埋め込み */}
      <div className="border border-border rounded-lg p-3 bg-background">
        <OntologyBuilderSection
          companyId={companyId}
          valuePropositions={valuePropositions}
          onStatusChange={onStatusChange}
        />
      </div>
    </div>
  )
}
