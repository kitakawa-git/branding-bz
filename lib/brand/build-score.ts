// ブランド体系の「構築度」スコア（決定論・非保存・AI不使用）。
// 表示時に既存データから算出する（実証進捗と同じ原則）。DBへは一切書かない。
//
// 注意: これは体系の「構造的完成度」の指標であって、ブランドの良し悪しの評価ではない。
// UI側でもその旨を注記すること（過大主張しない）。
//
// 判定素材は既存の共有ロジックを再利用する（別実装で数字がズレるのを防ぐ）:
// - 接続性: buildBrandMapGraph / findUnreachableFromPhilosophy（lib/brand/map-data）
// - 裏づけ: resolveBackingTargets / isTargetBacked（lib/brand/backing-targets）＝integrity チェック1と同基準
import {
  buildBrandMapGraph,
  findUnreachableFromPhilosophy,
  type RelationRow,
} from '@/lib/brand/map-data'
import { isTargetBacked, resolveBackingTargets } from '@/lib/brand/backing-targets'
import type { ElementRef } from '@/lib/brand/elements-catalog'

// ---- 配点（調整はここだけ触る） ----
export const WEIGHTS = {
  axes: { elements: 30, connectivity: 30, backing: 25, rules: 15 },
  // 要素の充足（合計30）: 理念セットは有無、他は件数で飽和
  elements: {
    mission: 4,
    vision: 4,
    value: 4,
    vp: { max: 6, saturateAt: 3 },
    proof: { max: 6, saturateAt: 5 },
    rule: { max: 3, saturateAt: 3 },
    persona: { max: 3, saturateAt: 2 },
  },
  // 接続性（合計30）: 接続率15＋理念からの到達率12＋一枚岩（島が1つ）3
  connectivity: { connected: 15, reach: 12, singleIsland: 3 },
  // 未来設計ボーナス（上限+5・未実施でも減点しない）
  bonus: { max: 5, desiredEvidence: 3, verified: 2 },
  // バンド: total がしきい値以下なら該当（〜40 構築中／〜70 基盤あり／〜90 充実／90超 構築完了）
  bands: [
    { max: 40, key: 'building', label: '構築中', tone: 'amber' },
    { max: 70, key: 'foundation', label: '基盤あり', tone: 'blue' },
    { max: 90, key: 'substantial', label: '充実', tone: 'green' },
    { max: 100, key: 'complete', label: '構築完了', tone: 'green' },
  ],
} as const

export type BuildScoreBandTone = (typeof WEIGHTS.bands)[number]['tone']

export type BuildScoreAxis = {
  key: 'elements' | 'connectivity' | 'backing' | 'rules'
  label: string
  score: number
  max: number
  hint: string // 何をすると上がるか（達成済みならその旨）
}

export type BuildScore = {
  total: number // 0-100（ボーナス込み・上限100）
  band: { key: string; label: string; tone: BuildScoreBandTone }
  axes: BuildScoreAxis[]
  bonus: number // 未来設計ボーナス（0-5）
  bonusHint: string
}

// 集計済みの入力（computeBuildScore はここから先が純粋な算数）
export type BuildScoreInput = {
  counts: {
    mission: number
    vision: number
    value: number
    vp: number
    proof: number
    rule: number
    persona: number
    desiredEvidence: number
  }
  connectivity: {
    total: number // 全要素数（未接続率の分母）
    unconnected: number // 線が1本も無い要素数
    nonPersona: number // 到達率の分母（ペルソナは到達判定の対象外）
    unreachable: number // 理念から辿れない要素数
    islands: number // 連結成分数（表示ノードがあるとき）
    hasNodes: boolean
    // 到達判定の根（mission/vision/value）があるか。無い会社は findUnreachableFromPhilosophy が
    // 判定をスキップして unreachable=0 になるため、そのまま採点すると到達点が無条件満点になる
    hasRoots: boolean
  }
  backing: {
    targets: number // 裏づけ対象（提供価値、無ければバリュー）の数
    backed: number
    noun: string // 「提供価値」or「バリュー」（hint用）
  }
  rules: { total: number; withExamples: number }
  future: { hasDesiredEvidence: boolean; verifiesCount: number }
}

const ratio = (num: number, den: number): number => (den <= 0 ? 0 : Math.max(0, Math.min(1, num / den)))
const saturate = (n: number, cfg: { max: number; saturateAt: number }): number =>
  Math.round(ratio(Math.min(n, cfg.saturateAt), cfg.saturateAt) * cfg.max)

export function computeBuildScore(input: BuildScoreInput): BuildScore {
  const W = WEIGHTS
  const c = input.counts

  // --- 要素の充足 ---
  const elementsScore =
    (c.mission > 0 ? W.elements.mission : 0) +
    (c.vision > 0 ? W.elements.vision : 0) +
    (c.value > 0 ? W.elements.value : 0) +
    saturate(c.vp, W.elements.vp) +
    saturate(c.proof, W.elements.proof) +
    saturate(c.rule, W.elements.rule) +
    saturate(c.persona, W.elements.persona)
  const missing: string[] = []
  if (c.mission === 0) missing.push('ミッション')
  if (c.vision === 0) missing.push('ビジョン')
  if (c.value === 0) missing.push('バリュー')
  if (c.vp === 0) missing.push('提供価値')
  if (c.proof < W.elements.proof.saturateAt) missing.push(`実績（あと${W.elements.proof.saturateAt - c.proof}件で満点）`)
  if (c.rule === 0) missing.push('表現ルール')
  if (c.persona === 0) missing.push('ペルソナ')
  const elementsHint =
    missing.length === 0 ? '主要な要素は揃っています' : `登録すると上がる: ${missing.slice(0, 3).join('・')}`

  // --- 接続性 ---
  const conn = input.connectivity
  const connectedScore = conn.total > 0 ? Math.round((1 - ratio(conn.unconnected, conn.total)) * W.connectivity.connected) : 0
  // 理念（根）が無い会社は到達判定不能＝0点（スキップを満点扱いにしない）
  const reachScore =
    conn.hasRoots && conn.nonPersona > 0
      ? Math.round((1 - ratio(conn.unreachable, conn.nonPersona)) * W.connectivity.reach)
      : 0
  const islandScore = conn.hasNodes ? Math.max(0, W.connectivity.singleIsland - Math.max(0, conn.islands - 1)) : 0
  const connectivityScore = connectedScore + reachScore + islandScore
  const connectivityHint = !conn.hasRoots
    ? '理念（ミッション/ビジョン/バリュー）を登録すると到達を測れます'
    : conn.unconnected > 0
      ? `未接続 ${conn.unconnected}件を繋ぐ（関係性ステップ）`
      : conn.unreachable > 0
        ? `理念に届かない ${conn.unreachable}件を繋ぐ`
        : conn.hasNodes
          ? 'すべての要素が理念から辿れます'
          : '要素を登録して関係を繋ぐと上がります'

  // --- 裏づけ ---
  const b = input.backing
  const backingScore = Math.round(ratio(b.backed, b.targets) * W.axes.backing)
  const backingHint =
    b.targets === 0
      ? '提供価値（無ければバリュー）を登録すると裏づけを測れます'
      : b.backed < b.targets
        ? `${b.noun}の裏づけをあと${b.targets - b.backed}件（実績と繋ぐ）`
        : `すべての${b.noun}が実績で裏づけられています`

  // --- ルールの質 ---
  const r = input.rules
  const rulesScore = Math.round(ratio(r.withExamples, r.total) * W.axes.rules)
  const rulesHint =
    r.total === 0
      ? '表現ルールを登録する（言葉のルールステップ）'
      : r.withExamples < r.total
        ? `NG/OK例をあと${r.total - r.withExamples}件のルールに追加`
        : 'すべてのルールにNG/OK例があります'

  // --- 未来設計ボーナス（未実施でも減点しない） ---
  const f = input.future
  const bonus = Math.min(
    W.bonus.max,
    (f.hasDesiredEvidence ? W.bonus.desiredEvidence : 0) + (f.verifiesCount > 0 ? W.bonus.verified : 0),
  )
  const bonusHint = f.hasDesiredEvidence
    ? f.verifiesCount > 0
      ? '獲得目標あり・実績による立証も進行中'
      : '獲得目標あり（実績で立証すると+2）'
    : '未来設計（獲得目標）を設定すると加点'

  const axes: BuildScoreAxis[] = [
    { key: 'elements', label: '要素の充足', score: elementsScore, max: W.axes.elements, hint: elementsHint },
    { key: 'connectivity', label: '接続性', score: connectivityScore, max: W.axes.connectivity, hint: connectivityHint },
    { key: 'backing', label: '裏づけ', score: backingScore, max: W.axes.backing, hint: backingHint },
    { key: 'rules', label: 'ルールの質', score: rulesScore, max: W.axes.rules, hint: rulesHint },
  ]
  const total = Math.min(100, axes.reduce((s, a) => s + a.score, 0) + bonus)
  const band = W.bands.find((x) => total <= x.max) ?? W.bands[W.bands.length - 1]

  return { total, band: { key: band.key, label: band.label, tone: band.tone }, axes, bonus, bonusHint }
}

// ---- 生データからの集計（Hub・企業一覧で同じ導出を使う） ----

export type BuildScoreRaw = {
  catalog: ElementRef[]
  philTypes: Record<string, string> // philosophy_elements の id → element_type
  relations: RelationRow[]
  rules: { ng_example: string | null; ok_example: string | null }[]
}

export function deriveBuildScoreInput(raw: BuildScoreRaw): BuildScoreInput {
  const { catalog, philTypes, relations, rules } = raw
  const phils = catalog.filter((e) => e.kind === 'philosophy_element')
  const ofType = (t: string) => phils.filter((e) => philTypes[e.id] === t)

  // 接続性（マップ・チップと同じ純関数＝数字がズレない）。FK由来の proofFks は廃止済みのため常に空
  const graph = buildBrandMapGraph(catalog, relations, philTypes, [])
  const unreachable = findUnreachableFromPhilosophy(catalog, relations, philTypes, [])

  // 裏づけ（integrity チェック1と同基準）。FK は 20260721163027 で辺へ一本化済み＝空Set
  const vps = catalog.filter((e) => e.kind === 'value_proposition').map((e) => ({ id: e.id, title: e.label }))
  const valuePhils = ofType('value').map((e) => ({ id: e.id, title: e.label, body: null }))
  const { targets, mode } = resolveBackingTargets(vps, valuePhils)
  const backed = targets.filter((t) => isTargetBacked(t, relations, new Set())).length

  const hasExample = (r: { ng_example: string | null; ok_example: string | null }) =>
    Boolean((r.ng_example || '').trim() || (r.ok_example || '').trim())

  const deCount = catalog.filter((e) => e.kind === 'desired_evidence').length

  return {
    counts: {
      mission: ofType('mission').length,
      vision: ofType('vision').length,
      value: ofType('value').length,
      vp: vps.length,
      proof: catalog.filter((e) => e.kind === 'proof_point').length,
      rule: rules.length,
      persona: catalog.filter((e) => e.kind === 'persona').length,
      desiredEvidence: deCount,
    },
    connectivity: {
      total: catalog.length,
      unconnected: graph.unconnectedCount,
      nonPersona: catalog.filter((e) => e.kind !== 'persona').length,
      unreachable: unreachable.length,
      islands: graph.islandCount,
      hasNodes: graph.nodes.length > 0,
      hasRoots: ofType('mission').length + ofType('vision').length + ofType('value').length > 0,
    },
    backing: { targets: targets.length, backed, noun: mode === 'value' ? 'バリュー' : '提供価値' },
    rules: { total: rules.length, withExamples: rules.filter(hasExample).length },
    future: {
      hasDesiredEvidence: deCount > 0,
      verifiesCount: relations.filter((r) => r.relation_type === 'verifies').length,
    },
  }
}
