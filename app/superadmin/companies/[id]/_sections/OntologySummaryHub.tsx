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
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchElementsCatalog, KIND_LABELS, type ElementKind, type ElementRef } from '@/lib/brand/elements-catalog'
import {
  buildBrandMapGraph,
  findUnreachableFromPhilosophy,
  type BrandMapGraph,
  type ProofFkRow,
  type RelationRow,
} from '@/lib/brand/map-data'
import OntologyBuilderSection, { type OntologyStatus } from './OntologyBuilderSection'
import { ONTOLOGY_DATA_CHANGED_EVENT, ONTOLOGY_GOTO_STEP_EVENT } from './ontology-events'
import BrandMapSection from './BrandMapSection'
import BrandMap3D from './BrandMap3D'
import OutputTestPanel from './OutputTestPanel'
import type { ValuePropositionRef } from './ProofPointsSection'
import { Button } from '@/components/ui/button'
import { ArrowRight, ChevronDown, Maximize2, MoreHorizontal, X } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// ウィザードは5ステップ（1実績・2言葉のルール・3未来設計・4関係性・5補足質問）。
// 旧ステップ1「基本情報の確認」は廃止し、前提の未登録は上部の警告チップへ移した。
const STEP_RELATIONS = 4

// 未接続要素をどのステップで直すか（種別 → ステップ番号）。
// 理念・提供価値・ペルソナはウィザードで作らないので、「繋ぐ」＝関係性ステップへ送る。
const STEP_BY_KIND: Record<ElementKind, number> = {
  philosophy_element: STEP_RELATIONS,
  value_proposition: STEP_RELATIONS,
  proof_point: 1,
  governance_rule: 2,
  desired_evidence: 3,
  persona: STEP_RELATIONS,
}

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
  const [catalog, setCatalog] = useState<ElementRef[]>([])
  // 「理念に届かない要素」＝線はあるが理念から辿り着けない要素（＝島）。
  // 線が1本も無いものは「未接続」チップが扱うのでここから除く（2つのチップの件数を重ねない）。
  const [unreachableItems, setUnreachableItems] = useState<ElementRef[]>([])
  // 「…」メニューで畳んでいる表示（既定はすべてオフ＝ミニマル）
  const [showCounts, setShowCounts] = useState(false)
  const [showLegend, setShowLegend] = useState(false)
  const [presentOpen, setPresentOpen] = useState(false)
  const [presentSelected, setPresentSelected] = useState<string | null>(null)
  // 「編集する」折りたたみ。既定は「構築完了なら畳む・未完了なら開く」で status に追従する。
  // ただし利用者が自分で開閉したら、その意思を優先して以後は自動で動かさない。
  const [editOpen, setEditOpen] = useState(false)
  const editUserToggled = useRef(false)
  const editRef = useRef<HTMLDivElement>(null)

  const onStatusChange = useCallback((s: OntologyStatus) => {
    setStatus(s)
    // 構築完了なら畳む・未完了なら開く。判定は非同期で後から確定するため毎回追従させる
    // （初回の暫定値で固定すると、完了になっても開いたままになる）。
    if (!editUserToggled.current) setEditOpen(!s.complete)
  }, [])

  // チップ/導線 → ウィザードの該当ステップへ。畳んでいる場合は開いてからスクロールする。
  // （ウィザードは hidden で常時マウント＝イベント購読と件数通知を切らさない）
  const gotoStep = (step: number) => {
    editUserToggled.current = true // 遷移で開いた状態を status の再通知で閉じない
    setEditOpen(true)
    window.dispatchEvent(new CustomEvent(ONTOLOGY_GOTO_STEP_EVENT, { detail: step }))
    requestAnimationFrame(() => editRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  // グラフ（島・未接続チップとプレゼンモードの3Dで共用）。マップと同じ純関数で導出。
  const fetchMapStats = useCallback(async () => {
    const [cat, relR, philR, ppR] = await Promise.all([
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
    const rels = (relR.data as RelationRow[] | null) || []
    const fks = (ppR.data as ProofFkRow[] | null) || []
    const g = buildBrandMapGraph(cat, rels, philTypes, fks)
    setCatalog(cat)
    setGraph(g)
    // 到達可能性は integrity.ts と同じ共有関数で判定する（別実装にすると数字が食い違うため）。
    // そこから「線が1本も無いもの」＝未接続チップの担当分を除いた残りが島。
    const connected = new Set(g.nodes.map((n) => n.ref))
    setUnreachableItems(
      findUnreachableFromPhilosophy(cat, rels, philTypes, fks).filter((e) =>
        connected.has(`${e.kind}:${e.id}`),
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

  // プレゼンモードの enter/exit アニメーション制御。
  // presentOpen=true でマウント後、次フレームで presentEntering=true に切替えて
  // opacity/scale の transition を発火。閉じるときは exit を先に走らせて 300ms 後にアンマウント。
  const [presentEntering, setPresentEntering] = useState(false)
  useEffect(() => {
    if (!presentOpen) {
      setPresentEntering(false)
      return
    }
    const raf = requestAnimationFrame(() => setPresentEntering(true))
    return () => cancelAnimationFrame(raf)
  }, [presentOpen])

  const closePresent = useCallback(() => {
    setPresentEntering(false)
    const t = setTimeout(() => setPresentOpen(false), 300)
    return () => clearTimeout(t)
  }, [])

  // プレゼンモード: Esc で閉じる＋背後のスクロールを止める
  useEffect(() => {
    if (!presentOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePresent()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [presentOpen, closePresent])

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
  // 未接続要素の実体（3Dでは探しにくいのでリストで補完する）
  const unconnectedItems = graph
    ? catalog.filter((e) => !graph.nodes.some((n) => n.ref === `${e.kind}:${e.id}`))
    : []

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
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="group inline-flex items-center gap-1.5 py-1 px-2.5 rounded-md text-[12px] font-semibold bg-amber-100 text-amber-800 border border-amber-300 cursor-pointer shadow-sm transition-all hover:bg-amber-200 hover:shadow hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                未接続 {unconnected}件
                <span className="font-medium underline underline-offset-2 decoration-amber-500/60 group-hover:decoration-amber-700">繋ぎに行く</span>
                <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-0">
              <div className="p-3 border-b border-border">
                <p className="text-[13px] font-bold text-foreground m-0">まだ繋がっていない要素</p>
                <p className="text-[11px] text-muted-foreground m-0 mt-0.5">
                  行をクリックすると、その要素を扱うステップへ移動します
                </p>
              </div>
              <div className="max-h-64 overflow-auto">
                {unconnectedItems.map((e) => (
                  <button
                    key={`${e.kind}:${e.id}`}
                    type="button"
                    onClick={() => gotoStep(STEP_BY_KIND[e.kind] ?? STEP_RELATIONS)}
                    className="flex w-full items-start gap-2 border-0 border-b border-border bg-background px-3 py-2 text-left cursor-pointer hover:bg-muted last:border-b-0"
                  >
                    <span className="mt-0.5 shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700">
                      {KIND_LABELS[e.kind]}
                    </span>
                    <span className="text-[12px] text-foreground break-words">{e.label || '（無題）'}</span>
                  </button>
                ))}
              </div>
              <div className="p-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => gotoStep(STEP_RELATIONS)}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-[12px] font-semibold text-foreground cursor-pointer hover:bg-muted"
                >
                  関係性ステップでまとめて繋ぐ →
                </button>
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <Chip label="" value="すべて接続済み" tone="green" />
        )}

        {/* 理念に届かない要素（＝島）。線はあるのに理念まで辿れないもの。
            「未接続」とは別問題なので別チップにする（件数は重ならない＝線ゼロは未接続側が担当）。 */}
        {unreachableItems.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="group inline-flex items-center gap-1.5 py-1 px-2.5 rounded-md text-[12px] font-semibold bg-amber-100 text-amber-800 border border-amber-300 cursor-pointer shadow-sm transition-all hover:bg-amber-200 hover:shadow hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                理念に届かない {unreachableItems.length}件
                <span className="font-medium underline underline-offset-2 decoration-amber-500/60 group-hover:decoration-amber-700">
                  繋ぎに行く
                </span>
                <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-0">
              <div className="p-3 border-b border-border">
                <p className="text-[13px] font-bold text-foreground m-0">理念まで辿れない要素</p>
                <p className="text-[11px] text-muted-foreground m-0 mt-0.5">
                  線はありますが、たどっても理念に行き着きません。行をクリックすると、その要素を扱うステップへ移動します
                </p>
              </div>
              <div className="max-h-64 overflow-auto">
                {unreachableItems.map((e) => (
                  <button
                    key={`${e.kind}:${e.id}`}
                    type="button"
                    onClick={() => gotoStep(STEP_BY_KIND[e.kind] ?? STEP_RELATIONS)}
                    className="flex w-full items-start gap-2 border-0 border-b border-border bg-background px-3 py-2 text-left cursor-pointer hover:bg-muted last:border-b-0"
                  >
                    <span className="mt-0.5 shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700">
                      {KIND_LABELS[e.kind]}
                    </span>
                    <span className="text-[12px] text-foreground break-words">{e.label || '（無題）'}</span>
                  </button>
                ))}
              </div>
              <div className="p-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => gotoStep(STEP_RELATIONS)}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-[12px] font-semibold text-foreground cursor-pointer hover:bg-muted"
                >
                  関係性ステップで理念に繋ぐ →
                </button>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* 理念（ミッション/ビジョン/バリュー）が未登録のときだけ促す。旧ステップ1の前提チェックの置き換え */}
        {c && c.mission + c.vision + c.value === 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="group inline-flex items-center gap-1.5 py-1 px-2.5 rounded-md text-[12px] font-semibold bg-amber-100 text-amber-800 border border-amber-300 cursor-pointer shadow-sm transition-all hover:bg-amber-200 hover:shadow hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                理念が未登録
                <span className="font-medium underline underline-offset-2 decoration-amber-500/60 group-hover:decoration-amber-700">登録する</span>
                <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80">
              <p className="text-[13px] text-foreground m-0">
                ミッション・ビジョン・バリューが未登録です。理念はこの体系すべての土台になるため、先に登録してください。
              </p>
              <p className="text-[12px] text-muted-foreground m-0 mt-2">
                登録先は<strong className="text-foreground">この企業の</strong>管理画面「ブランドの考え方」です（AIサジェストが使えます）。
                管理画面は各社のログインで開くため、ここからは直接遷移しません。
              </p>
            </PopoverContent>
          </Popover>
        )}

        {/* 提供価値は未登録のときだけ促す（登録済みなら消える） */}
        {c && c.vp === 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="group inline-flex items-center gap-1.5 py-1 px-2.5 rounded-md text-[12px] font-semibold bg-amber-100 text-amber-800 border border-amber-300 cursor-pointer shadow-sm transition-all hover:bg-amber-200 hover:shadow hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                提供価値が未登録
                <span className="font-medium underline underline-offset-2 decoration-amber-500/60 group-hover:decoration-amber-700">登録する</span>
                <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80">
              <p className="text-[13px] text-foreground m-0">
                提供価値が未登録です。任意ですが、登録すると実績の裏づけ・点検・AI草案の精度が上がります。
              </p>
              <p className="text-[12px] text-muted-foreground m-0 mt-2">
                登録先は<strong className="text-foreground">この企業の</strong>管理画面「ブランド戦略」です。
                管理画面は各社のログインで開くため、ここからは直接遷移しません。
              </p>
            </PopoverContent>
          </Popover>
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
        <BrandMapSection companyId={companyId} showLegend={showLegend} />
      </div>

      {/* プレゼンモード（全画面3D）。開いている間だけ描画ループが回る。
          enter/exit: opacity 0↔1 + scale 0.96↔1 を 300ms ease-out で。
          transform は canvas の DOM 幅を変えないため描画は乱れない。 */}
      {presentOpen && graph && (
        <div
          className={`fixed inset-0 z-50 flex flex-col bg-background p-4 sm:p-6 origin-center transition-[opacity,transform] duration-300 ease-out ${
            presentEntering ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="ブランドオントロジー プレゼンモード"
        >
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-base font-bold text-foreground m-0">ブランドオントロジー（プレゼンモード）</h3>
            <div className="grow" />
            <Button type="button" variant="outline" size="icon" className="size-8" onClick={closePresent} title="閉じる（Esc）">
              <X size={15} />
            </Button>
          </div>
          <div className="grow min-h-0">
            <BrandMap3D
              graph={graph}
              companyId={companyId}
              selected={presentSelected}
              onSelect={setPresentSelected}
              isActive
              fullscreen
            />
          </div>
        </div>
      )}

      {/* 編集する（構築完了なら畳む）。ウィザードは常時マウント＝件数の通知とステップ遷移イベントの購読を切らさない。
          開閉は grid-template-rows 0fr→1fr のアニメーション（中身の実高さに追随するので高さの決め打ち不要）。
          display:none を使わないぶん畳んだ中身にキーボードが入ってしまうため inert で無効化する。 */}
      <div ref={editRef} className="mb-3">
        <button
          type="button"
          onClick={() => {
            editUserToggled.current = true
            setEditOpen((v) => !v)
          }}
          className="inline-flex w-full items-center gap-2 rounded-lg border border-border bg-background p-4 text-[13px] font-semibold text-foreground cursor-pointer hover:bg-muted"
          aria-expanded={editOpen}
        >
          <ChevronDown
            size={15}
            className={`transition-transform duration-300 ease-out ${editOpen ? '' : '-rotate-90'}`}
          />
          編集する
          <span className="font-normal text-muted-foreground">
            （5ステップ{pending > 0 ? `・保留 ${pending}` : ''}）
          </span>
        </button>
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${editOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
          inert={!editOpen}
        >
          <div className="overflow-hidden">
            {/* p-4＝16px。globals.css の「カード内パディング16px統一」は .rounded-lg を対象にしており
                ここ（rounded-b-lg）は対象外のため、直接16pxを指定して基準に揃える。 */}
            <div className="border border-border border-t-0 rounded-b-lg p-4 bg-background">
              <OntologyBuilderSection
                companyId={companyId}
                valuePropositions={valuePropositions}
                onStatusChange={onStatusChange}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 出力テスト（オントロジーの効果を注入あり/なしで比較） */}
      <OutputTestPanel companyId={companyId} />
    </div>
  )
}
