'use client'

// スーパー管理画面 企業詳細: 「ブランドマップ」（読み取り専用・書込みなし）
// - ビューアは3Dに一本化（BrandMap3D）。2Dの d3-force / 同心円SVGは廃止した。
//   島判定・未接続件数の算出は lib/brand/map-data.ts の buildBrandMapGraph が引き続き正（ハブのチップが使う）。
// - ここが持つのは「データ取得」「3Dの器」「クリック詳細パネル」だけ。
// - 端点が解決できない関係は描画から除外（幽霊エッジ防御。buildBrandMapGraph 側で実施）。
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { fetchElementsCatalog } from '@/lib/brand/elements-catalog'
import { ONTOLOGY_DATA_CHANGED_EVENT } from './ontology-events'
import {
  buildBrandMapGraph,
  type BrandMapGraph,
  type ProofFkRow,
  type RelationRow,
} from '@/lib/brand/map-data'
import { EDGE_STYLE, edgeStyle, NODE_LEGEND, nodeColor, nodeKindLabel, relLabel } from '@/lib/brand/map-display'
import BrandMap3D from './BrandMap3D'

export default function BrandMapSection({
  companyId,
  showLegend = false,
}: {
  companyId: string
  showLegend?: boolean
}) {
  const [loading, setLoading] = useState(true)
  const [graph, setGraph] = useState<BrandMapGraph | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  // ---- データ取得（読み取りのみ）。silent=true は再取得時（「読み込み中」を挟まず差し替え） ----
  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
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
      setLoading(false)
    },
    [companyId],
  )

  // 初回ロード＋ステップパネル内のCRUD（ONTOLOGY_DATA_CHANGED_EVENT）で再取得
  useEffect(() => {
    load()
    const handler = () => load(true)
    window.addEventListener(ONTOLOGY_DATA_CHANGED_EVENT, handler)
    return () => window.removeEventListener(ONTOLOGY_DATA_CHANGED_EVENT, handler)
  }, [load])

  const nodeByRef = useMemo(() => new Map((graph?.nodes || []).map((n) => [n.ref, n])), [graph])
  const selectedNode = selected ? nodeByRef.get(selected) : null
  const selectedEdges = useMemo(() => {
    if (!graph || !selected) return []
    return graph.edges.filter((e) => e.source === selected || e.target === selected)
  }, [graph, selected])

  if (loading) return <p className="text-muted-foreground text-sm m-0">読み込み中...</p>
  if (!graph) return null

  // 空状態
  if (graph.edges.length === 0) {
    return (
      <p className="text-sm text-foreground border border-border bg-muted/40 rounded-lg p-3 m-0">
        関係が登録されるとマップが表示されます。「編集する」→ステップ4（関係性）でAIスキャンを実行するか、関係グラフから手動で追加してください
        {graph.unconnectedCount > 0 && `（現在、未接続の要素 ${graph.unconnectedCount}件）`}
      </p>
    )
  }

  return (
    <div>
      <BrandMap3D graph={graph} companyId={companyId} selected={selected} onSelect={setSelected} isActive />

      {/* 凡例（既定は非表示。「…」メニューから表示） */}
      {showLegend && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-muted-foreground">
          {NODE_LEGEND.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1">
              <span className="inline-block size-2.5 rounded-full" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
          <span className="mx-1 text-border">|</span>
          {Object.entries(EDGE_STYLE).map(([k, st]) => (
            <span key={k} className="inline-flex items-center gap-1">
              <svg width="22" height="6">
                <line x1="0" y1="3" x2="22" y2="3" stroke={st.stroke} strokeWidth={st.width} strokeDasharray={st.dash ? '5 4' : undefined} />
              </svg>
              {relLabel(k)}
            </span>
          ))}
        </div>
      )}

      {/* クリック詳細 */}
      {selectedNode && (
        <div className="border border-border rounded-lg p-3 mt-2 bg-muted/30">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="py-0.5 px-2 rounded text-[11px] font-semibold text-white" style={{ background: nodeColor(selectedNode) }}>
                {nodeKindLabel(selectedNode)}
              </span>
              <span className="text-sm font-bold text-foreground break-words">{selectedNode.label}</span>
              <span className="text-[11px] text-muted-foreground">接続 {selectedNode.degree}本</span>
            </div>
            <Button type="button" variant="ghost" size="icon" className="size-6 shrink-0" onClick={() => setSelected(null)}>
              <X size={13} />
            </Button>
          </div>
          <div className="mt-2 space-y-1.5">
            {selectedEdges.map((e) => {
              const isSource = e.source === selected
              const other = nodeByRef.get(isSource ? e.target : e.source)
              const st = edgeStyle(e.relation_type)
              return (
                <div key={e.id} className="text-[13px] border-l-2 pl-2" style={{ borderColor: st.stroke }}>
                  <span className="font-semibold" style={{ color: st.stroke }}>
                    {isSource ? `—${relLabel(e.relation_type)}→` : `←${relLabel(e.relation_type)}—`}
                  </span>{' '}
                  <span className="text-foreground break-words">
                    {other ? `${nodeKindLabel(other)}「${other.label}」` : '（不明な要素）'}
                  </span>
                  {e.note && <p className="text-[12px] text-muted-foreground m-0 mt-0.5 break-words">{e.note}</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
