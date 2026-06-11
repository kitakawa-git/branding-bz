// ブランドマップのAIレビュー（ステージ2）。設計原則: 事実は機械が計算し、AIは語るだけ。
//
// - (a) グラフ事実（島・ハブ・裏づけカバレッジ・矛盾・背骨の太さ・未接続数）は決定論で計算（AI不要）。
// - (b) Claude には (a) の事実だけを渡して講評を生成（1社1回・読み取り専用・無書込み）。
// - グラウンディング: 出力の「」引用と数値を入力事実と照合し、実在しない名・数値を含む行は破棄
//   （integrity-ai / profiling と同型の防護）。
// - 関係0件・API失敗は review: null＋reason（例外を上げない）。
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { callClaude } from '@/lib/claude-api'
import { fetchElementsCatalog, KIND_LABELS, relationLabel } from '@/lib/brand/elements-catalog'
import { buildBrandMapGraph, FK_EVIDENCE_TYPE, type ProofFkRow, type RelationRow } from '@/lib/brand/map-data'

export type MapFacts = {
  counts: {
    philosophy: number
    value_proposition: number
    proof_point: number
    governance_rule: number
    persona: number
    edges: number
    unconnected: number
  }
  islands: { size: number; members: string[] }[] // 大きい順
  hubs: { label: string; kind: string; degree: number }[] // 次数上位
  vpCoverage: { label: string; proofCount: number; acknowledged: boolean }[]
  conflicts: { a: string; b: string; note: string | null }[]
  roots: { label: string; degree: number }[] // mission/vision の接続数（背骨の太さ）
}

export type MapReviewResult = {
  review: string | null
  reason: string | null
  droppedLines: number // グラウンディング照合で破棄した行数
  facts: MapFacts | null
}

// ---- (a) グラフ事実の決定論計算 ----
export async function computeMapFacts(companyId: string): Promise<MapFacts> {
  const supabase = getSupabaseAdmin()
  const [catalog, relR, philR, ppR, ackR] = await Promise.all([
    fetchElementsCatalog(supabase, companyId),
    supabase
      .from('element_relations')
      .select('id, source_kind, source_id, target_kind, target_id, relation_type, note')
      .eq('company_id', companyId),
    supabase.from('philosophy_elements').select('id, element_type').eq('company_id', companyId),
    supabase.from('proof_points').select('id, value_proposition_id').eq('company_id', companyId),
    supabase.from('profiling_acknowledgments').select('target_ref').eq('company_id', companyId),
  ])
  const philTypes: Record<string, string> = {}
  for (const p of (philR.data as { id: string; element_type: string }[] | null) || []) {
    philTypes[p.id] = p.element_type
  }
  const proofFks = (ppR.data as ProofFkRow[] | null) || []
  const graph = buildBrandMapGraph(catalog, (relR.data as RelationRow[] | null) || [], philTypes, proofFks)
  const ackSet = new Set((((ackR.data as { target_ref: string }[] | null) || []).map((a) => a.target_ref)))
  const labelOf = new Map(catalog.map((e) => [`${e.kind}:${e.id}`, e.label]))
  const nodeByRef = new Map(graph.nodes.map((n) => [n.ref, n]))

  // 島（連結成分・構成要素名つき・大きい順）
  const adj = new Map<string, string[]>()
  for (const e of graph.edges) {
    if (!adj.has(e.source)) adj.set(e.source, [])
    if (!adj.has(e.target)) adj.set(e.target, [])
    adj.get(e.source)!.push(e.target)
    adj.get(e.target)!.push(e.source)
  }
  const seen = new Set<string>()
  const islands: { size: number; members: string[] }[] = []
  for (const n of graph.nodes) {
    if (seen.has(n.ref)) continue
    const queue = [n.ref]
    seen.add(n.ref)
    for (let i = 0; i < queue.length; i++) {
      for (const nb of adj.get(queue[i]) || []) {
        if (!seen.has(nb)) {
          seen.add(nb)
          queue.push(nb)
        }
      }
    }
    islands.push({ size: queue.length, members: queue.map((r) => labelOf.get(r) || r).sort((a, b) => a.localeCompare(b, 'ja')) })
  }
  islands.sort((a, b) => b.size - a.size)

  // ハブ（次数上位5）
  const hubs = [...graph.nodes]
    .sort((a, b) => b.degree - a.degree || a.label.localeCompare(b.label, 'ja'))
    .slice(0, 5)
    .map((n) => ({ label: n.label, kind: n.kind === 'philosophy_element' && n.philType === 'service' ? '事業' : KIND_LABELS[n.kind], degree: n.degree }))

  // 裏づけカバレッジ（提供価値ごと: FK＋evidencedBy の実績数・保留有無）
  const vpRefs = catalog.filter((e) => e.kind === 'value_proposition')
  const proofCountByVp = new Map<string, number>()
  for (const p of proofFks) {
    if (p.value_proposition_id) {
      proofCountByVp.set(p.value_proposition_id, (proofCountByVp.get(p.value_proposition_id) || 0) + 1)
    }
  }
  for (const e of graph.edges) {
    if (e.relation_type !== 'evidencedBy') continue
    const vpRef = e.source.startsWith('value_proposition:') ? e.source : e.target.startsWith('value_proposition:') ? e.target : null
    const ppRef = e.source.startsWith('proof_point:') ? e.source : e.target.startsWith('proof_point:') ? e.target : null
    if (vpRef && ppRef) {
      const vpId = vpRef.slice('value_proposition:'.length)
      proofCountByVp.set(vpId, (proofCountByVp.get(vpId) || 0) + 1)
    }
  }
  const vpCoverage = vpRefs.map((vp) => ({
    label: vp.label,
    proofCount: proofCountByVp.get(vp.id) || 0,
    acknowledged: ackSet.has(`value_proposition:${vp.id}`),
  }))

  // 矛盾の一覧
  const conflicts = graph.edges
    .filter((e) => e.relation_type === 'conflictsWith')
    .map((e) => ({ a: labelOf.get(e.source) || e.source, b: labelOf.get(e.target) || e.target, note: e.note }))

  // 背骨の太さ（mission / vision の接続数。未接続なら0）
  const roots = catalog
    .filter((e) => e.kind === 'philosophy_element' && ['mission', 'vision'].includes(philTypes[e.id] || ''))
    .map((e) => ({ label: e.label, degree: nodeByRef.get(`philosophy_element:${e.id}`)?.degree ?? 0 }))

  return {
    counts: {
      philosophy: catalog.filter((e) => e.kind === 'philosophy_element').length,
      value_proposition: vpRefs.length,
      proof_point: catalog.filter((e) => e.kind === 'proof_point').length,
      governance_rule: catalog.filter((e) => e.kind === 'governance_rule').length,
      persona: catalog.filter((e) => e.kind === 'persona').length,
      edges: graph.edges.length,
      unconnected: graph.unconnectedCount,
    },
    islands,
    hubs,
    vpCoverage,
    conflicts,
    roots,
  }
}

// 事実データのテキスト化（プロンプト＝グラウンディング照合のコーパス）
export function renderFactsText(facts: MapFacts): string {
  const lines: string[] = []
  const c = facts.counts
  lines.push(`# 要素数: 理念${c.philosophy}・提供価値${c.value_proposition}・実績${c.proof_point}・表現ルール${c.governance_rule}・ペルソナ${c.persona} ／ 関係${c.edges}本 ／ 未接続の要素${c.unconnected}件`)
  lines.push(`\n# 島（繋がりのまとまり）: ${facts.islands.length}クラスタ`)
  facts.islands.forEach((isl, i) => {
    lines.push(`- 島${i + 1}（${isl.size}要素）: ${isl.members.map((m) => `「${m}」`).join('、')}`)
  })
  lines.push(`\n# 接続ハブ上位（次数順）`)
  for (const h of facts.hubs) lines.push(`- 「${h.label}」（${h.kind}・接続${h.degree}本）`)
  lines.push(`\n# 提供価値ごとの裏づけ`)
  for (const v of facts.vpCoverage) {
    lines.push(`- 「${v.label}」: 実績${v.proofCount}件${v.acknowledged ? '（裏づけ未取得として保留中）' : ''}`)
  }
  lines.push(`\n# 矛盾関係（conflictsWith）`)
  if (facts.conflicts.length === 0) lines.push('- なし')
  for (const cf of facts.conflicts) lines.push(`- 「${cf.a}」↔「${cf.b}」${cf.note ? `（メモ: ${cf.note}）` : ''}`)
  lines.push(`\n# 理念の接続数（背骨の太さ）`)
  for (const r of facts.roots) lines.push(`- 「${r.label}」: 接続${r.degree}本`)
  return lines.join('\n')
}

const SYSTEM_PROMPT = `あなたは経験豊富なブランドコンサルタントです。クライアント企業のブランド体系マップから機械計算した「事実データ」だけをもとに、日本語の講評を書いてください。

厳守事項:
- 事実データに存在しない要素名・数値・固有名詞を書かない（数字や事例の創作は禁止）。
- 要素名を挙げるときは「」で括り、事実データの表記（の一部）をそのまま使う。
- 島（理念と繋がっていないまとまり）の解釈は断定しない。「関係がまだ言語化・登録されていないだけの可能性」と「ブランド戦略上の課題である可能性」の両論を併記する。
- 構成は次の4節。見出しは【】で書く（Markdownの#記号は使わない）:
【全体の所感】体系の成熟度・形の特徴（2〜3文）
【強み】厚く支えられている約束・効いているルールなど
【気になる点】島・裏づけのない約束・理念の接続の薄さなど
【次の一手】具体的なアクション2〜3個（例: AIスキャンの再実行、特定の要素どうしの関係の検討、保留項目の事実確認）
- 全体で600字程度。冗長にしない。`

const normalizeDigits = (s: string) =>
  (s || '').replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))

// グラウンディング照合（純関数）: 出力行のうち、入力事実に無い「」引用・数値を含む行を破棄する。
// 引用は「事実テキストの部分文字列」または「いずれかのラベルとの包含関係」なら実在とみなす
// （AIがラベルを短縮引用するケースを許容）。
export function filterGroundedLines(
  raw: string,
  factsText: string,
  labels: string[],
): { text: string; droppedLines: number } {
  const corpus = normalizeDigits(factsText)
  const kept: string[] = []
  let dropped = 0
  for (const line of (raw || '').split('\n')) {
    const l = line.trim()
    if (!l) {
      kept.push(line)
      continue
    }
    let ok = true
    // 「」引用の照合（3字以下の一般語は除外）
    for (const m of l.matchAll(/「([^」]+)」/g)) {
      const q = normalizeDigits(m[1].trim())
      if (q.length <= 3) continue
      const grounded = corpus.includes(q) || labels.some((lb) => lb.includes(q) || q.includes(lb))
      if (!grounded) {
        ok = false
        break
      }
    }
    // 数値の照合
    if (ok) {
      for (const num of normalizeDigits(l).match(/\d+(?:\.\d+)?/g) || []) {
        if (!corpus.includes(num)) {
          ok = false
          break
        }
      }
    }
    if (ok) kept.push(line)
    else dropped++
  }
  return { text: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim(), droppedLines: dropped }
}

// ---- (b) 講評生成 ----
export async function generateMapReview(companyId: string, factsOverride?: MapFacts): Promise<MapReviewResult> {
  if (!companyId) return { review: null, reason: 'companyId がありません', droppedLines: 0, facts: null }
  try {
    const facts = factsOverride ?? (await computeMapFacts(companyId))
    if (facts.counts.edges === 0) {
      return {
        review: null,
        reason: '関係が登録されていないため、レビューできる体系がまだありません。まずウィザードのステップ4（関係性）でAIスキャンを実行してください',
        droppedLines: 0,
        facts,
      }
    }
    const factsText = renderFactsText(facts)
    const raw = await callClaude({
      system: SYSTEM_PROMPT,
      userMessage: `# 事実データ\n${factsText}`,
      maxTokens: 2000,
    })
    const labels = [
      ...facts.islands.flatMap((i) => i.members),
      ...facts.hubs.map((h) => h.label),
      ...facts.vpCoverage.map((v) => v.label),
      ...facts.conflicts.flatMap((cf) => [cf.a, cf.b]),
      ...facts.roots.map((r) => r.label),
      ...Object.values(KIND_LABELS),
      ...['guides', 'evidencedBy', 'promisedTo', 'communicatedAs', 'constrainedBy', 'conflictsWith', FK_EVIDENCE_TYPE].map(relationLabel),
    ]
    const { text, droppedLines } = filterGroundedLines(raw, factsText, labels)
    if (!text) {
      return { review: null, reason: 'レビューを生成できませんでした。もう一度お試しください', droppedLines, facts }
    }
    return { review: text, reason: null, droppedLines, facts }
  } catch (err) {
    console.error('[map-review] 生成失敗:', err)
    return { review: null, reason: 'レビューを生成できませんでした。時間をおいてもう一度お試しください', droppedLines: 0, facts: null }
  }
}

// ---- 永続化（brand_map_reviews・1社1行） ----
// コスト特性: 自動生成は「保存が無い会社の初回表示」の一度きり。以降はボタン押下（regenerate）のみ。

// 鮮度比較用スナップショット（関係数・要素数・島数）
type FactsSnapshot = {
  edges: number
  philosophy: number
  value_proposition: number
  proof_point: number
  governance_rule: number
  persona: number
  islands: number
}

const snapshotOf = (f: MapFacts): FactsSnapshot => ({
  edges: f.counts.edges,
  philosophy: f.counts.philosophy,
  value_proposition: f.counts.value_proposition,
  proof_point: f.counts.proof_point,
  governance_rule: f.counts.governance_rule,
  persona: f.counts.persona,
  islands: f.islands.length,
})

const SNAPSHOT_KEYS: (keyof FactsSnapshot)[] = [
  'edges', 'philosophy', 'value_proposition', 'proof_point', 'governance_rule', 'persona', 'islands',
]

const snapshotsDiffer = (cur: FactsSnapshot, saved: unknown): boolean => {
  const s = (saved ?? {}) as Record<string, unknown>
  return SNAPSHOT_KEYS.some((k) => s[k] !== cur[k])
}

export type MapReviewView = {
  review: string | null
  generatedAt: string | null
  stale: boolean // facts_snapshot と現在の事実が異なる（再生成をおすすめ）
  reason: string | null
  generatedNow: boolean // この呼び出しでAI生成した（=コストが発生した）か
  droppedLines: number
}

// 保存済みがあればそれを返し（AI呼び出しなし・鮮度判定つき）、無ければ生成して保存する。
// regenerate: true はボタン押下時のみ（生成して上書き保存）。
// 関係0件の会社は生成も保存もしない（案内 reason を返す）。
export async function getOrGenerateMapReview(
  companyId: string,
  options?: { regenerate?: boolean },
): Promise<MapReviewView> {
  const none = (reason: string, droppedLines = 0): MapReviewView => ({
    review: null, generatedAt: null, stale: false, reason, generatedNow: false, droppedLines,
  })
  if (!companyId) return none('companyId がありません')
  try {
    const supabase = getSupabaseAdmin()
    const facts = await computeMapFacts(companyId)
    const snap = snapshotOf(facts)

    if (!options?.regenerate) {
      const { data } = await supabase
        .from('brand_map_reviews')
        .select('review_text, facts_snapshot, generated_at')
        .eq('company_id', companyId)
        .maybeSingle()
      const saved = data as { review_text: string; facts_snapshot: unknown; generated_at: string } | null
      if (saved) {
        return {
          review: saved.review_text,
          generatedAt: saved.generated_at,
          stale: snapshotsDiffer(snap, saved.facts_snapshot),
          reason: null,
          generatedNow: false,
          droppedLines: 0,
        }
      }
    }

    if (facts.counts.edges === 0) {
      return none('関係が登録されていないため、レビューできる体系がまだありません。まずウィザードのステップ4（関係性）でAIスキャンを実行してください')
    }

    const gen = await generateMapReview(companyId, facts)
    if (!gen.review) return none(gen.reason ?? 'レビューを生成できませんでした', gen.droppedLines)

    const generatedAt = new Date().toISOString()
    const { error } = await supabase
      .from('brand_map_reviews')
      .upsert(
        { company_id: companyId, review_text: gen.review, facts_snapshot: snap, generated_at: generatedAt },
        { onConflict: 'company_id' },
      )
    if (error) console.error('[map-review] 保存失敗（レビュー自体は返却）:', error)
    return { review: gen.review, generatedAt, stale: false, reason: null, generatedNow: true, droppedLines: gen.droppedLines }
  } catch (err) {
    console.error('[map-review] 取得/生成失敗:', err)
    return none('レビューを取得できませんでした。時間をおいてもう一度お試しください')
  }
}
