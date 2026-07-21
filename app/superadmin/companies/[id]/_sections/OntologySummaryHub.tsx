'use client'

// スーパー管理画面 企業詳細: 「ブランドオントロジー」サマリーハブ。
// 設計原則: 情報の「正」は1箇所、ここはチップとリンクで参照するだけ。
// - 完了判定・件数・点検数値は OntologyBuilderSection（ウィザード）からの onStatusChange 通知を表示
//   （判定ロジックの持ち主はウィザード。ここでは再計算しない）
// - 島・未接続のみマップと同じ純関数（buildBrandMapGraph）で導出（新しい集計APIは作らない）
// - カードは「引き算」設計：既定で見せるのはタイトル＋要点チップ＋マップだけ。
//   件数・凡例・整列レイアウトは右上「…」メニューへ、俯瞰は「⛶」プレゼンモード（3D全画面）へ畳む。
// - AIレビュー（MapReviewPanel）は常設表示から外した（コンポーネント/APIは将来のレポート出力用に残置）。
//   クイックアクションは各セクションへのアンカー移動のみで、機能の実体は持たない。
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchElementsCatalog } from '@/lib/brand/elements-catalog'
import { buildBrandMapGraph, type BrandMapGraph, type ProofFkRow, type RelationRow } from '@/lib/brand/map-data'
import OntologyBuilderSection, { type OntologyStatus } from './OntologyBuilderSection'
import { ONTOLOGY_DATA_CHANGED_EVENT, ONTOLOGY_GOTO_STEP_EVENT } from './ontology-events'
import BrandMapSection from './BrandMapSection'
import BrandMap3D from './BrandMap3D'
import OutputTestPanel from './OutputTestPanel'
import type { ValuePropositionRef } from './ProofPointsSection'
import { Button } from '@/components/ui/button'
import { Maximize2, MoreHorizontal, X } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// 関係性ステップの番号（ステップ4に「未来設計」が入ったため5）
const STEP_RELATIONS = 5
const STEP_QUESTIONS = 6

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
  const [graph, setGraph] = useState<BrandMapGraph | null>(null)
  // 「…」メニューで畳んでいる表示（既定はすべてオフ＝ミニマル）
  const [showCounts, setShowCounts] = useState(false)
  const [showLegend, setShowLegend] = useState(false)
  const [aligned, setAligned] = useState(false)
  const [presentOpen, setPresentOpen] = useState(false)
  const [presentSelected, setPresentSelected] = useState<string | null>(null)

  const onStatusChange = useCallback((s: OntologyStatus) => setStatus(s), [])

  // クイックアクション → ウィザードの該当ステップへ切替（実体はステップパネル内）
  const gotoStep = (step: number) => {
    window.dispatchEvent(new CustomEvent(ONTOLOGY_GOTO_STEP_EVENT, { detail: step }))
  }

  // グラフ（島・未接続チップとプレゼンモードの3Dで共用）。マップと同じ純関数で導出。
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
    setGraph(
      buildBrandMapGraph(
        catalog,
        (relR.data as RelationRow[] | null) || [],
        philTypes,
        (ppR.data as ProofFkRow[] | null) || [],
      ),
    )
  }, [companyId])

  // 初回＋下部セクションでのCRUD（ONTOLOGY_DATA_CHANGED_EVENT）で再取得
  useEffect(() => {
    fetchMapStats()
    const handler = () => fetchMapStats()
    window.addEventListener(ONTOLOGY_DATA_CHANGED_EVENT, handler)
    return () => window.removeEventListener(ONTOLOGY_DATA_CHANGED_EVENT, handler)
  }, [fetchMapStats])

  // プレゼンモード: Esc で閉じる＋背後のスクロールを止める
  useEffect(() => {
    if (!presentOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPresentOpen(false)
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [presentOpen])

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

  const unconnected = graph?.unconnectedCount ?? null

  return (
    <div>
      {/* ヘッダ: タイトル＋状態チップ＋（右）プレゼンモード・メニュー */}
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <h3 className="text-base font-bold text-foreground m-0">ブランドオントロジー</h3>
        <Chip label="" value={statusChip.label} tone={statusChip.tone} />
        <div className="grow" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-7"
          onClick={() => setPresentOpen(true)}
          disabled={!graph || graph.edges.length === 0}
          title="プレゼンモード（全画面3D）"
        >
          <Maximize2 size={13} />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="size-7" title="表示オプション">
              <MoreHorizontal size={13} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>マップの表示</DropdownMenuLabel>
            <DropdownMenuCheckboxItem checked={aligned} onCheckedChange={(v) => setAligned(!!v)}>
              整列レイアウト
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={showLegend} onCheckedChange={(v) => setShowLegend(!!v)}>
              凡例
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={showCounts} onCheckedChange={(v) => setShowCounts(!!v)}>
              詳細情報（件数）
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        理念から実績までの体系の現在地です。登録・編集・点検はこのカード内の各ステップで行います。
      </p>

      {/* 要点チップ（既定は2〜3個だけ） */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {unconnected === null ? (
          <Chip label="" value="読込中..." />
        ) : unconnected > 0 ? (
          <button
            type="button"
            onClick={() => gotoStep(STEP_RELATIONS)}
            className="inline-flex items-center gap-1 py-1 px-2.5 rounded-md text-[12px] font-semibold bg-amber-100 text-amber-800 border-0 cursor-pointer hover:bg-amber-200"
          >
            未接続 {unconnected}件 <span className="font-normal opacity-80">→ 繋ぎに行く</span>
          </button>
        ) : (
          <Chip label="" value="すべて接続済み" tone="green" />
        )}
        <Chip
          label={backingLabel}
          value={insp ? `${backed}/${backingTotal}${pending > 0 ? `（保留${pending}）` : ''}` : '–'}
          tone={insp ? (insp.uncoveredWarnCount > 0 ? 'amber' : 'green') : 'gray'}
        />
        {/* くい違いは発生時のみ */}
        {!!conflicts && <Chip label="くい違い" value={String(conflicts)} tone="amber" />}
      </div>

      {/* 件数（「…」→詳細情報 で表示） */}
      {showCounts && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Chip label="理念" value={c ? String(c.mission + c.vision + c.value) : '–'} />
          <Chip label="提供価値" value={c ? String(c.vp) : '–'} tone={c && c.vp === 0 ? 'amber' : 'gray'} />
          <Chip label="実績" value={c ? String(c.proof) : '–'} />
          <Chip label="ルール" value={c ? String(c.rule) : '–'} />
          <Chip label="関係" value={c ? String(c.relation) : '–'} />
          <Chip
            label="島"
            value={graph ? `${graph.islandCount}クラスタ` : '–'}
            tone={graph && graph.islandCount > 1 ? 'amber' : 'gray'}
          />
        </div>
      )}

      {/* ブランドマップ（常設・唯一の置き場） */}
      <div className="mb-3">
        <BrandMapSection companyId={companyId} aligned={aligned} showLegend={showLegend} />
      </div>

      {/* プレゼンモード（全画面3D）。開いている間だけ描画ループが回る */}
      {presentOpen && graph && (
        <div
          className="fixed inset-0 z-50 bg-background p-4 sm:p-6 overflow-auto"
          role="dialog"
          aria-modal="true"
          aria-label="ブランドオントロジー プレゼンモード"
        >
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-base font-bold text-foreground m-0">ブランドオントロジー（プレゼンモード）</h3>
            <div className="grow" />
            <Button type="button" variant="outline" size="icon" className="size-8" onClick={() => setPresentOpen(false)} title="閉じる（Esc）">
              <X size={15} />
            </Button>
          </div>
          <BrandMap3D
            graph={graph}
            companyId={companyId}
            selected={presentSelected}
            onSelect={setPresentSelected}
            isActive
          />
        </div>
      )}

      {/* 出力テスト（オントロジーの効果を注入あり/なしで比較） */}
      <div className="mb-3">
        <OutputTestPanel companyId={companyId} />
      </div>

      {/* クイックアクション（実体は下のステップパネル。該当ステップへの切替のみ） */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => gotoStep(STEP_RELATIONS)}
          className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-[13px] font-semibold text-foreground cursor-pointer hover:bg-muted"
        >
          AIスキャンを実行 →
        </button>
        <button
          type="button"
          onClick={() => gotoStep(STEP_QUESTIONS)}
          className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-[13px] font-semibold text-foreground cursor-pointer hover:bg-muted"
        >
          質問に答える{pending > 0 ? `（保留 ${pending}）` : ''} →
        </button>
        <button
          type="button"
          onClick={() => gotoStep(STEP_QUESTIONS)}
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
