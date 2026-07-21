'use client'

// スーパー管理画面 企業詳細: 「関係グラフ」(element_relations) CRUD セクション
// - 5種の要素（理念/提供価値/証拠/表現ルール/ペルソナ）から source→relation_type→target を作成
// - 端点は (kind, id) のポリモーフィック。存在＋同一company はDBトリガで担保。
// - 重複・自己参照は DB制約＋UI で弾く。書込みは element_relations_superadmin_all（is_superadmin）で許可される前提。
// - 「AIスキャン」: 既存要素から関係候補をAIが推定（/api/superadmin/relation-scan・POST・押した時だけ）。
//   候補は1件ずつ承認/却下。承認時のみ通常の作成経路（クライアント supabase INSERT）で登録する。
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import { Plus, Trash2, Check, X, ChevronUp, ChevronDown, ArrowRight, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { AIButton } from '@/components/shared/AIButton'
import type { RelationCandidate } from '@/lib/brand/relation-scan'
import {
  CREATABLE_RELATION_TYPES,
  fetchElementsCatalog,
  isValidRelationShape,
  KIND_LABELS,
  RELATION_RULES,
  relationLabel,
  type ElementKind,
  type ElementRef,
} from '@/lib/brand/elements-catalog'

type Relation = {
  id: string
  company_id: string
  source_kind: ElementKind
  source_id: string
  target_kind: ElementKind
  target_id: string
  relation_type: string
  note: string | null
  sort_order: number
  // 出所（20260721163009 で構造化）。'ai_scan'＝AI提案を人が承認した辺
  source: 'manual' | 'ai_scan'
  ai_confidence: 'high' | 'medium' | null
}

type Draft = {
  source: string // `${kind}:${id}`
  relation_type: string
  target: string // `${kind}:${id}`
  note: string
}

// 端点ピッカーの表示順。desired_evidence（獲得目標）も含む＝未来設計4種
// （aspiresTo/requires/toBeEvidencedBy/verifies）がここから作成できる
// （以前は5種のみで、未来設計の関係は読む側だけあって作る手段が無かった）。
const KIND_ORDER: ElementKind[] = [
  'philosophy_element',
  'value_proposition',
  'proof_point',
  'governance_rule',
  'persona',
  'desired_evidence',
]

const emptyDraft = (): Draft => ({ source: '', relation_type: 'guides', target: '', note: '' })

const SELECT_CLASS =
  'h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-ds-app-accent-soft focus:ring-1 focus:ring-ds-app-accent-soft'

// `${kind}:${id}` を分解（id は uuid＝コロンを含まないため先頭コロンで分割）
function parseRef(v: string): { kind: ElementKind; id: string } | null {
  const i = v.indexOf(':')
  if (i < 0) return null
  return { kind: v.slice(0, i) as ElementKind, id: v.slice(i + 1) }
}

export default function ElementRelationsSection({
  companyId,
  onDataChanged,
  headerActionSlotId,
  focusElement,
  onFocusClear,
}: {
  companyId: string
  // データ再取得のたびに通知（ウィザードのステップ判定更新用・任意）
  onDataChanged?: () => void
  // 指定すると「AIスキャンを実行」をこのidの要素へ portal する（ステップ見出し行に置くため）。
  // 未指定・要素が無い場合は従来どおりセクション下部のボタン行に出す。
  headerActionSlotId?: string
  // 「この要素の繋ぎ先を考えたい」で遷移してきたときの焦点要素。
  // 受け取ったら最上部に焦点パネルを出し、その要素に絞ったAI提案を1回だけ自動実行する。
  focusElement?: { kind: string; id: string; label: string } | null
  // 焦点パネルを閉じたときに親の状態も落とす
  onFocusClear?: () => void
}) {
  // 見出し行のアクション置き場（マウント後に解決。無ければ従来位置にフォールバック）
  const [actionSlot, setActionSlot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setActionSlot(headerActionSlotId ? document.getElementById(headerActionSlotId) : null)
  }, [headerActionSlotId])

  const [rows, setRows] = useState<Relation[]>([])
  const [catalog, setCatalog] = useState<ElementRef[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [saving, setSaving] = useState(false)
  const [candidates, setCandidates] = useState<RelationCandidate[] | null>(null)
  const [scanning, setScanning] = useState(false)
  const [approvingKey, setApprovingKey] = useState<string | null>(null)
  // ---- 焦点パネル（未接続チップの行クリックで開く） ----
  const [focusCandidates, setFocusCandidates] = useState<RelationCandidate[] | null>(null)
  const [focusScanning, setFocusScanning] = useState(false)
  const [focusFailed, setFocusFailed] = useState(false)
  // 自動実行は「同じ焦点要素につき1回だけ」。再取得は「再提案」ボタンからのみ（コスト配慮）
  const autoScannedRef = useRef<string | null>(null)

  const catalogMap = new Map(catalog.map((e) => [`${e.kind}:${e.id}`, e.label]))
  const labelOf = (kind: string, id: string) =>
    catalogMap.get(`${kind}:${id}`) ?? '（削除済みの要素）'

  const fetchAll = async () => {
    setLoading(true)
    const [relRes, cat] = await Promise.all([
      supabase
        .from('element_relations')
        .select('*')
        .eq('company_id', companyId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      fetchElementsCatalog(supabase, companyId),
    ])
    if (relRes.error) {
      console.error('[ElementRelations] 取得エラー:', relRes.error)
      toast.error('関係グラフの取得に失敗しました')
    } else {
      setRows((relRes.data as Relation[]) || [])
      onDataChanged?.()
    }
    setCatalog(cat)
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  const startAdd = () => {
    setDraft(emptyDraft())
    setAdding(true)
  }
  const cancelAdd = () => {
    setAdding(false)
    setDraft(emptyDraft())
  }

  const save = async () => {
    const s = parseRef(draft.source)
    const t = parseRef(draft.target)
    if (!s || !t) {
      toast.error('source と target を選択してください')
      return
    }
    // 自己参照（同一 kind+id）はUIで弾く（DBの no_self_relation CHECK と二重）
    if (draft.source === draft.target) {
      toast.error('同じ要素どうしの関係は作成できません')
      return
    }
    // ドメイン/レンジ（DBトリガ validate_element_relation_semantics と二重）
    if (!isValidRelationShape(draft.relation_type, s.kind, t.kind)) {
      toast.error('この関係種別に、その要素の組み合わせは使えません')
      return
    }
    // 重複（同一 source/target/relation_type）はUIで弾く（DBの uq_element_relation と二重）
    const dup = rows.some(
      (r) =>
        `${r.source_kind}:${r.source_id}` === draft.source &&
        `${r.target_kind}:${r.target_id}` === draft.target &&
        r.relation_type === draft.relation_type,
    )
    if (dup) {
      toast.error('同じ関係が既に登録されています')
      return
    }

    setSaving(true)
    try {
      const nextOrder = rows.length > 0 ? Math.max(...rows.map((r) => r.sort_order)) + 1 : 0
      const { error } = await supabase.from('element_relations').insert({
        company_id: companyId,
        source_kind: s.kind,
        source_id: s.id,
        target_kind: t.kind,
        target_id: t.id,
        relation_type: draft.relation_type,
        note: draft.note.trim() || null,
        sort_order: nextOrder,
      })
      if (error) throw error
      toast.success('関係を追加しました')
      cancelAdd()
      await fetchAll()
    } catch (err) {
      console.error('[ElementRelations] 保存エラー:', err)
      toast.error('保存に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('この関係を削除しますか？')) return
    const { error } = await supabase.from('element_relations').delete().eq('id', id)
    if (error) {
      console.error('[ElementRelations] 削除エラー:', error)
      toast.error('削除に失敗しました')
      return
    }
    toast.success('削除しました')
    await fetchAll()
  }

  // 同一 source グループ内で sort_order を入れ替え
  const move = async (groupRows: Relation[], index: number, dir: -1 | 1) => {
    const a = groupRows[index]
    const b = groupRows[index + dir]
    if (!a || !b) return
    const results = await Promise.all([
      supabase.from('element_relations').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('element_relations').update({ sort_order: a.sort_order }).eq('id', b.id),
    ])
    if (results.some((r) => r.error)) {
      toast.error('並び替えに失敗しました')
      return
    }
    await fetchAll()
  }

  // ---- AIスキャン（候補は表示のみ。登録は1件ずつの承認時だけ） ----
  const candidateKey = (c: RelationCandidate) =>
    `${c.source_kind}:${c.source_id}|${c.relation_type}|${c.target_kind}:${c.target_id}`

  // focus を渡すとその要素の繋ぎ先だけを提案する焦点スキャンになる（APIは同じ）
  const callScanApi = async (focus?: { kind: string; id: string } | null) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token || ''
    const res = await fetch('/api/superadmin/relation-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(focus ? { companyId, focus: { kind: focus.kind, id: focus.id } } : { companyId }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
    return json.candidates as RelationCandidate[]
  }

  const runScan = async () => {
    setScanning(true)
    try {
      setCandidates(await callScanApi())
    } catch (err) {
      console.error('[ElementRelations] AIスキャンエラー:', err)
      toast.error('AIスキャンに失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
    } finally {
      setScanning(false)
    }
  }

  const runFocusScan = async (focus: { kind: string; id: string }) => {
    setFocusScanning(true)
    setFocusFailed(false)
    try {
      setFocusCandidates(await callScanApi(focus))
    } catch (err) {
      console.error('[ElementRelations] 焦点スキャンエラー:', err)
      // 焦点パネルは失敗しても手動追加へ誘導するので、トーストは出さず面内に出す
      setFocusCandidates([])
      setFocusFailed(true)
    } finally {
      setFocusScanning(false)
    }
  }

  // 焦点要素を受け取ったら1回だけ自動でスキャン。要素が変わったら状態を作り直す。
  useEffect(() => {
    if (!focusElement) {
      autoScannedRef.current = null
      setFocusCandidates(null)
      setFocusFailed(false)
      return
    }
    const key = `${focusElement.kind}:${focusElement.id}`
    if (autoScannedRef.current === key) return
    autoScannedRef.current = key
    setFocusCandidates(null)
    setFocusFailed(false)
    runFocusScan(focusElement)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusElement?.kind, focusElement?.id])

  const closeFocus = () => {
    autoScannedRef.current = null
    setFocusCandidates(null)
    setFocusFailed(false)
    onFocusClear?.()
  }

  const dismissCandidate = (c: RelationCandidate) => {
    // 却下はセッション内で非表示にするだけ（永続記録はしない）。両方のリストから消す
    setCandidates((prev) => (prev ? prev.filter((x) => candidateKey(x) !== candidateKey(c)) : prev))
    setFocusCandidates((prev) => (prev ? prev.filter((x) => candidateKey(x) !== candidateKey(c)) : prev))
  }

  const approveCandidate = async (c: RelationCandidate) => {
    // スキャン後に手動追加された等で重複していたら登録せず候補だけ消す
    const dup = rows.some(
      (r) =>
        r.source_kind === c.source_kind &&
        r.source_id === c.source_id &&
        r.target_kind === c.target_kind &&
        r.target_id === c.target_id &&
        r.relation_type === c.relation_type,
    )
    if (dup) {
      toast.error('同じ関係が既に登録されています')
      dismissCandidate(c)
      return
    }
    setApprovingKey(candidateKey(c))
    try {
      const nextOrder = rows.length > 0 ? Math.max(...rows.map((r) => r.sort_order)) + 1 : 0
      const { error } = await supabase.from('element_relations').insert({
        company_id: companyId,
        source_kind: c.source_kind,
        source_id: c.source_id,
        target_kind: c.target_kind,
        target_id: c.target_id,
        relation_type: c.relation_type,
        // 出所は構造化列で持つ（旧: note の 'AI提案:' プレフィックス）。note は理由文のみ
        note: c.rationale,
        source: 'ai_scan',
        ai_confidence: c.confidence,
        sort_order: nextOrder,
      })
      if (error) throw error
      toast.success('関係を登録しました')
      dismissCandidate(c)
      await fetchAll()
    } catch (err) {
      console.error('[ElementRelations] 候補承認エラー:', err)
      toast.error('登録に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
    } finally {
      setApprovingKey(null)
    }
  }

  // source 起点でグルーピング（rows は sort_order 順）
  const groups: { key: string; kind: string; id: string; items: Relation[] }[] = []
  for (const r of rows) {
    const key = `${r.source_kind}:${r.source_id}`
    let g = groups.find((x) => x.key === key)
    if (!g) {
      g = { key, kind: r.source_kind, id: r.source_id, items: [] }
      groups.push(g)
    }
    g.items.push(r)
  }

  // 端点セレクト（許可された種別だけを optgroup で出す）
  const renderEndpointSelect = (
    value: string,
    allowedKinds: ElementKind[],
    onChange: (v: string) => void,
  ) => (
    <select className={SELECT_CLASS} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">選択してください</option>
      {KIND_ORDER.filter((k) => allowedKinds.includes(k)).map((kind) => {
        const items = catalog.filter((c) => c.kind === kind)
        if (items.length === 0) return null
        return (
          <optgroup key={kind} label={KIND_LABELS[kind]}>
            {items.map((c) => (
              <option key={`${c.kind}:${c.id}`} value={`${c.kind}:${c.id}`}>
                {c.label}
              </option>
            ))}
          </optgroup>
        )
      })}
    </select>
  )

  const renderForm = () => {
    // 関係種別ごとのドメイン/レンジ（RELATION_RULES）でセレクトを絞る。
    // 意味的に無効な組（例: ペルソナ -evidencedBy-> 表現ルール）はそもそも選べない。
    // DBトリガ（validate_element_relation_semantics）と同基準＝UIをすり抜けても登録されない。
    const rule = RELATION_RULES[draft.relation_type]
    const sourceKinds = rule?.sources ?? []
    const targetKinds = rule?.targets ?? []
    // 関係を変えたとき、いま選んでいる端点が新しい許可種別から外れたらクリアする
    const changeRelation = (rt: string) => {
      const next = RELATION_RULES[rt]
      const s = parseRef(draft.source)
      const t = parseRef(draft.target)
      setDraft({
        ...draft,
        relation_type: rt,
        source: s && next?.sources.includes(s.kind) ? draft.source : '',
        target: t && next?.targets.includes(t.kind) ? draft.target : '',
      })
    }
    return (
    <div className="border border-blue-200 bg-blue-50/40 rounded-lg p-4 mb-3 space-y-4">
      <div>
        <label className="text-xs font-bold text-foreground mb-1.5 block">関係</label>
        <select className={SELECT_CLASS} value={draft.relation_type} onChange={(e) => changeRelation(e.target.value)}>
          {CREATABLE_RELATION_TYPES.map((rt) => (
            <option key={rt.value} value={rt.value}>
              {rt.label}（{rt.value}）
            </option>
          ))}
        </select>
        <p className="text-[11px] text-muted-foreground m-0 mt-1">
          {CREATABLE_RELATION_TYPES.find((rt) => rt.value === draft.relation_type)?.desc}
        </p>
      </div>

      <div>
        <label className="text-xs font-bold text-foreground mb-1.5 block">
          起点（source）<span className="text-red-500">*</span>
        </label>
        {renderEndpointSelect(draft.source, sourceKinds, (v) => setDraft({ ...draft, source: v }))}
      </div>

      <div>
        <label className="text-xs font-bold text-foreground mb-1.5 block">
          対象（target）<span className="text-red-500">*</span>
        </label>
        {renderEndpointSelect(draft.target, targetKinds, (v) => setDraft({ ...draft, target: v }))}
      </div>

      <div>
        <label className="text-xs font-bold text-foreground mb-1.5 block">メモ（任意）</label>
        <AutoResizeTextarea
          value={draft.note}
          onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          placeholder="この関係の補足・背景"
          className="min-h-[60px]"
        />
      </div>

      <div className="flex gap-2">
        <Button type="button" onClick={save} disabled={saving} size="sm">
          <Check size={14} />
          {saving ? '保存中...' : '保存'}
        </Button>
        <Button type="button" variant="outline" onClick={cancelAdd} disabled={saving} size="sm">
          <X size={14} />
          キャンセル
        </Button>
      </div>
    </div>
    )
  }

  // AI提案の1行。全体スキャンの候補リストと焦点パネルで同じ体裁を使う。
  const renderCandidate = (c: RelationCandidate) => {
    const key = candidateKey(c)
    return (
      <div key={key} className="border border-violet-200 bg-violet-50/40 rounded-lg p-3">
        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
          <span className="py-0.5 px-1.5 bg-gray-100 text-gray-600 rounded text-[11px] font-semibold shrink-0">
            {KIND_LABELS[c.source_kind]}
          </span>
          <span className="text-sm font-medium text-foreground break-words">{c.source_label}</span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700">
            <ArrowRight size={13} />
            {relationLabel(c.relation_type)}（{c.relation_type}）
          </span>
          <span className="py-0.5 px-1.5 bg-gray-100 text-gray-600 rounded text-[11px] font-semibold shrink-0">
            {KIND_LABELS[c.target_kind]}
          </span>
          <span className="text-sm font-medium text-foreground break-words">{c.target_label}</span>
          {c.confidence === 'medium' && (
            <span className="py-0.5 px-1.5 bg-gray-100 text-gray-500 rounded text-[11px]">確信度: 中</span>
          )}
        </div>
        <p className="text-[13px] text-foreground/80 break-words m-0 mb-2">{c.rationale}</p>
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={() => approveCandidate(c)} disabled={approvingKey !== null}>
            <Check size={14} />
            {approvingKey === key ? '登録中...' : '承認'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => dismissCandidate(c)}
            disabled={approvingKey !== null}
          >
            <X size={14} />
            却下
          </Button>
        </div>
      </div>
    )
  }

  // 「AIスキャンを実行」ボタン本体。置き場所（見出し行 or セクション下部）だけが変わる。
  // AIアクションは共通の AIButton（sm＝px-3 py-1.5 text-xs gap-1.5）に統一。
  const aiScanButton = (
    <AIButton type="button" size="sm" onClick={runScan} disabled={scanning || loading}>
      {scanning ? 'スキャン中...' : 'AIスキャンを実行'}
    </AIButton>
  )

  // 焦点要素を起点にした手動追加フォームを開く（AI提案が無い/採らないときの受け皿）。
  // source に焦点要素をプリセットし、関係と対象だけ選べばよい状態にする。
  const startAddFromFocus = () => {
    if (!focusElement) return
    setDraft({ ...emptyDraft(), source: `${focusElement.kind}:${focusElement.id}` })
    setAdding(true)
  }

  // 焦点パネル。「この要素をどこに繋ぐか」だけをその場で片づけるための一時的な作業面。
  const renderFocusPanel = () => {
    if (!focusElement) return null
    const label = focusElement.label || labelOf(focusElement.kind, focusElement.id)
    const kindLabel = KIND_LABELS[focusElement.kind as ElementKind] ?? focusElement.kind
    return (
      <div className="border border-violet-300 bg-violet-50/60 rounded-lg p-4 mb-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <Sparkles size={15} className="text-violet-700 shrink-0" />
            <span className="text-sm font-bold text-foreground">「{label}」の繋ぎ先</span>
            <span className="py-0.5 px-1.5 bg-gray-100 text-gray-600 rounded text-[11px] font-semibold shrink-0">
              {kindLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={closeFocus}
            title="閉じる"
            className="shrink-0 rounded-md border-0 bg-transparent p-1 text-muted-foreground cursor-pointer hover:bg-muted hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-[13px] text-muted-foreground m-0 mb-3">
          この要素がどの要素と繋がるかをAIが提案します。承認すると関係が登録されます
        </p>

        {focusScanning ? (
          <p className="text-[13px] text-muted-foreground m-0">AIが繋ぎ先を考えています...</p>
        ) : focusCandidates === null ? null : focusCandidates.length > 0 ? (
          <div className="space-y-2">{focusCandidates.map(renderCandidate)}</div>
        ) : (
          <div className="rounded-lg border border-border bg-background p-3">
            <p className="text-[13px] text-foreground m-0 mb-2">
              {focusFailed
                ? 'AIの提案を取得できませんでした。手動で繋ぐか、もう一度お試しください'
                : 'AIの提案はありませんでした。手動で繋ぎ先を指定してください'}
            </p>
            {!adding && (
              <Button type="button" variant="outline" size="sm" onClick={startAddFromFocus}>
                <Plus size={14} />
                この要素を起点に手動で追加
              </Button>
            )}
          </div>
        )}

        {!focusScanning && (
          <div className="mt-3">
            <AIButton type="button" size="sm" onClick={() => runFocusScan(focusElement)}>
              再提案
            </AIButton>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {renderFocusPanel()}

      {loading ? (
        <p className="text-muted-foreground text-sm">読み込み中...</p>
      ) : groups.length === 0 && !adding ? (
        <p className="text-muted-foreground text-sm mb-3">関係が登録されていません</p>
      ) : (
        groups.map((g) => (
          <div key={g.key} className="border border-border rounded-lg p-4 mb-3 bg-background">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="py-0.5 px-2 bg-blue-100 text-blue-800 rounded text-xs font-semibold shrink-0">
                {KIND_LABELS[g.kind as ElementKind]}
              </span>
              <span className="text-sm font-bold text-foreground break-words">{labelOf(g.kind, g.id)}</span>
            </div>
            <div className="space-y-1.5 pl-1">
              {g.items.map((r, i) => (
                <div key={r.id} className="flex items-start gap-2 border-l-2 border-blue-200 pl-3 py-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-ds-app-accent-hover">
                        <ArrowRight size={13} />
                        {relationLabel(r.relation_type)}
                      </span>
                      <span className="py-0.5 px-1.5 bg-gray-100 text-gray-600 rounded text-[11px] font-semibold shrink-0">
                        {KIND_LABELS[r.target_kind]}
                      </span>
                      <span className="text-sm text-foreground break-words">{labelOf(r.target_kind, r.target_id)}</span>
                      {/* 出所（構造化列）。旧・noteの「AI提案:」プレフィックスの置き換え */}
                      {r.source === 'ai_scan' && (
                        <span className="py-0.5 px-1.5 bg-violet-100 text-violet-700 rounded text-[11px] font-semibold shrink-0">
                          AI提案{r.ai_confidence === 'medium' ? '・確信度中' : ''}
                        </span>
                      )}
                    </div>
                    {r.note && (
                      <p className="text-[13px] text-muted-foreground mt-0.5 whitespace-pre-line break-words">{r.note}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button type="button" variant="outline" size="icon" onClick={() => move(g.items, i, -1)} disabled={i === 0} className="size-7">
                      <ChevronUp size={13} />
                    </Button>
                    <Button type="button" variant="outline" size="icon" onClick={() => move(g.items, i, 1)} disabled={i === g.items.length - 1} className="size-7">
                      <ChevronDown size={13} />
                    </Button>
                    <Button type="button" variant="outline" size="icon" onClick={() => remove(r.id)} className="size-7 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {adding && renderForm()}

      {!adding && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={startAdd} className="py-2 px-4 text-[13px]">
            <Plus size={16} />
            関係を追加
          </Button>
          {/* スロットが無いときだけここに出す（ある場合は見出し行へ portal） */}
          {!actionSlot && aiScanButton}
        </div>
      )}

      {/* ステップ見出し行へ差し込み */}
      {actionSlot && createPortal(aiScanButton, actionSlot)}

      {/* AIスキャン候補（承認するまで一切登録されない） */}
      {candidates !== null && (
        <div className="mt-4">
          <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-foreground">
            <Sparkles size={14} />
            AIスキャン候補（{candidates.length}）
          </div>
          {candidates.length === 0 ? (
            <p className="text-muted-foreground text-sm m-0">
              新しい関係候補は見つかりませんでした（既存の関係は提案対象外です）
            </p>
          ) : (
            <div className="space-y-2">{candidates.map(renderCandidate)}</div>
          )}
        </div>
      )}
    </div>
  )
}
