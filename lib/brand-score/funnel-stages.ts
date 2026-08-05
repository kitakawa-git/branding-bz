// ブランド浸透ジャーニー（浸透段階による設問の切り直し）
// ============================================================
// 同じ設問を2つの軸で見る。
//   ・WHY / HOW / WHAT（既存）＝ ブランドの構成要素。「何が」弱いか
//   ・認知→理解→共感→行動→推奨（ここ）＝ 浸透のプロセス。「どこで」止まっているか
//
// 4段階目の「行動」が反転点。そこまでは受け取る側、そこから先は渡す側に変わる。
//
// 「会社がどういう状態か」を問う設問（経営判断・称賛文化・浸透実感など）は
// 個人の進行度ではないため、ファネルに含めず environment（環境・成果指標）として別集計する。
//
// ⚠️ 対応表は定点観測の基準。一度決めたら変更しないこと（変えると前年比が無意味になる）。
// ⚠️ 既存の総合インナースコア／WHY・HOW・WHAT の計算式には一切触れない。
//    こちらは同じ回答を別の切り口で見るための補助指標。
// ============================================================

/** 浸透段階のキー。environment はファネル外（個人の進行度ではない） */
export type FunnelStage =
  | 'awareness'
  | 'understanding'
  | 'empathy'
  | 'behavior'
  | 'advocacy'
  | 'environment'

/** ファネルを構成する5段階（environment を含まない・表示順） */
export const FUNNEL_STAGES: readonly FunnelStage[] = [
  'awareness',
  'understanding',
  'empathy',
  'behavior',
  'advocacy',
]

/** environment を含めた表示順 */
export const ALL_STAGES: readonly FunnelStage[] = [...FUNNEL_STAGES, 'environment']

/** 反転点。この段階以降は「渡す側」になる */
export const PIVOT_STAGE: FunnelStage = 'behavior'
/** 指示書での呼称。PIVOT_STAGE と同義 */
export const INFLECTION_STAGE = PIVOT_STAGE

/** 環境・成果指標の設問（32問構成の sort_order）。5段階には含めない */
export const ENV_ORDERS: readonly number[] = [5, 7, 10, 17, 19, 26, 28, 29, 30]

/**
 * 「通過」とみなす5段階平均の閾値。
 * 3.0 が「どちらとも言えない」、4.0 が「そう思う」なので、
 * 3.5 は中立をはっきり上回る線。
 * ⚠ 一度決めたら変更しないこと（変えると前年比が無意味になる）。
 */
export const PASS_THRESHOLD = 3.5

export const STAGE_LABELS: Record<FunnelStage, string> = {
  awareness: '認知',
  understanding: '理解',
  empathy: '共感',
  behavior: '行動',
  advocacy: '推奨',
  environment: '環境・成果',
}

/** 各段階の「問い」 */
export const STAGE_QUESTIONS: Record<FunnelStage, string> = {
  awareness: '知っているか',
  understanding: '説明できるか',
  empathy: '納得し、誇れるか',
  behavior: '実践しているか',
  advocacy: '広めているか',
  environment: '環境が整っているか',
}

/** 各段階の「状態」 */
export const STAGE_STATES: Record<FunnelStage, string> = {
  awareness: '理念を知っている',
  understanding: '意味を自分の言葉で説明できる',
  empathy: '納得している・自分ごとになっている',
  behavior: 'ブランドに沿って実践している',
  advocacy: '体現し続け、周りに広める',
  environment: '個人の進行度ではない指標',
}

// ────────────────────────────────────────────
// 設問 → 段階の対応表（sort_order で引く）
// ────────────────────────────────────────────
//
// 32問構成: 本社BO版と現場SP版をマージしたもの。
//   Q21/Q24 は本社版、Q31/Q32 は現場版の設問で、それぞれの群しか回答しない。
//   Q21「社内の他部門・パートナーとの接点」と Q31「クライアントとの接点」は
//   同じ構成概念なのでどちらも行動。
//   Q24「自部門の貢献を説明できる」は理解、Q32「名刺交換で強みを伝える」は推奨。
//   文言が近く見えるが別の構成概念なので別段階に置く。

const STAGE_MAP_32: Record<number, FunnelStage> = {}
const STAGE_MAP_30: Record<number, FunnelStage> = {}

function assign(
  map: Record<number, FunnelStage>,
  stage: FunnelStage,
  sortOrders: number[]
): void {
  for (const n of sortOrders) map[n] = stage
}

// 32問構成
assign(STAGE_MAP_32, 'awareness', [9, 14, 15, 18])
assign(STAGE_MAP_32, 'understanding', [1, 11, 12, 13, 24])
assign(STAGE_MAP_32, 'empathy', [2, 3, 8, 16, 20])
assign(STAGE_MAP_32, 'behavior', [4, 21, 25, 27, 31])
assign(STAGE_MAP_32, 'advocacy', [6, 22, 23, 32])
assign(STAGE_MAP_32, 'environment', [5, 7, 10, 17, 19, 26, 28, 29, 30])

// 30問構成（単一フォームを単独で取り込んだ場合）= 32問構成から 31・32 を除いたもの
assign(STAGE_MAP_30, 'awareness', [9, 14, 15, 18])
assign(STAGE_MAP_30, 'understanding', [1, 11, 12, 13, 24])
assign(STAGE_MAP_30, 'empathy', [2, 3, 8, 16, 20])
assign(STAGE_MAP_30, 'behavior', [4, 21, 25, 27])
assign(STAGE_MAP_30, 'advocacy', [6, 22, 23])
assign(STAGE_MAP_30, 'environment', [5, 7, 10, 17, 19, 26, 28, 29, 30])

const VALID_STAGES = new Set<string>(ALL_STAGES)

/**
 * 設問の浸透段階を解決する。
 * 1. reference_data.stage に有効な値があればそれを使う（個別上書き）
 * 2. 設問数が 32 または 30 なら対応表を sort_order で引く
 * 3. どちらでもなければ null（段階未設定）
 *
 * ※ 現場版のみを単独取り込みした場合、Q24 の文言は「名刺交換で強みを伝える」に
 *    なるため、その設問の reference_data.stage に 'advocacy' を入れて上書きする。
 */
export function resolveStage(
  sortOrder: number,
  questionCount: number,
  referenceData?: Record<string, unknown> | null
): FunnelStage | null {
  const override = referenceData?.stage
  if (typeof override === 'string' && VALID_STAGES.has(override)) {
    return override as FunnelStage
  }
  if (questionCount === 32) return STAGE_MAP_32[sortOrder] ?? null
  if (questionCount === 30) return STAGE_MAP_30[sortOrder] ?? null
  return null
}

// ────────────────────────────────────────────
// パターン判定
// ────────────────────────────────────────────

export type FunnelPattern =
  | 'empathy_first'
  | 'behavior_first'
  | 'inward'
  | 'monotonic_decay'

export const PATTERN_LABELS: Record<FunnelPattern, string> = {
  empathy_first: '共感先行型',
  behavior_first: '行動先行型',
  inward: '内向き型',
  monotonic_decay: '単調減衰型',
}

export const PATTERN_MEANINGS: Record<FunnelPattern, string> = {
  empathy_first:
    '気持ちはあるが、説明する言葉が足りない状態。増やすべきは共感ではなく、伝える情報と言葉です。',
  behavior_first:
    'やってはいるが、納得が追いついていない状態。ルールを強めるより、理由を伝えるほうが先です。',
  inward:
    '自分ではやれているが、人に渡せていない状態。足りないのはやる気ではなく、伝える言葉と機会です。',
  monotonic_decay:
    '段階を追って少しずつ下がる、無理のない形。落ち込みが一番大きいところだけを直します。',
}

/** パターン判定の閾値（pt）。全パターン共通 */
const PATTERN_THRESHOLD = 5

/**
 * 上流の異常から順に判定する。
 *
 * 内向き型は「行動 − 推奨」で見る。指示書には「推奨 − 行動」とあったが、
 * 内向き型の定義が「実践はしているが外や次の世代に渡せていない」である以上、
 * 行動が推奨を上回る向きでなければ意味が通らないため、この向きを採る。
 */
function detectPattern(scores: Record<FunnelStage, number>): FunnelPattern {
  if (scores.empathy - scores.understanding >= PATTERN_THRESHOLD) return 'empathy_first'
  if (scores.behavior - scores.empathy >= PATTERN_THRESHOLD) return 'behavior_first'
  if (scores.behavior - scores.advocacy >= PATTERN_THRESHOLD) return 'inward'
  return 'monotonic_decay'
}

// ────────────────────────────────────────────
// 集計
// ────────────────────────────────────────────

/** 集計の入力。inner-score の by_question と questions を結合したもの */
export interface FunnelInputQuestion {
  questionId: string
  questionText: string
  sortOrder: number
  /** 現行カテゴリ（why/how/what） */
  category: string
  /** 1〜5 の平均スコア */
  avgScore: number | null
  /** その設問の回答数 */
  count: number
  referenceData?: Record<string, unknown> | null
}

export interface StageSummary {
  stage: FunnelStage
  /** 0〜100 に正規化したスコア */
  score: number
  /** 1〜5 の平均 */
  avg: number
  questionCount: number
  /** その段階に含まれる現行カテゴリ（重複なし・why/how/what 順） */
  categories: string[]
  /** その段階の最下位設問 */
  weakest: { questionText: string; avgScore: number } | null
}

export interface StageTransition {
  from: FunnelStage
  to: FunnelStage
  /** 転換率(%) = 次段階 ÷ 前段階 × 100 */
  rate: number
  /** 増減(pt) = 次段階 − 前段階 */
  delta: number
}

export interface MatrixCell {
  score: number
  questionCount: number
}

export interface FunnelResult {
  stages: StageSummary[]
  /** environment を除く5段階の遷移（4区間） */
  transitions: StageTransition[]
  pattern: FunnelPattern
  /** 転換率が最小の区間 */
  bottleneck: StageTransition
  /** 5段階のうちスコア最小 */
  weakestStage: FunnelStage
  /** category → stage → セル。該当設問が無い組み合わせは undefined */
  matrix: Record<string, Partial<Record<FunnelStage, MatrixCell>>>
  /** 段階未設定の設問数（注記表示用） */
  unstagedCount: number
}

/** 1〜5 の平均を 0〜100 に正規化する（既存インナースコアと同じ換算式） */
function normalize(avg: number): number {
  return ((avg - 1) / 4) * 100
}

/** 小数第1位に丸める（0〜100 のスコア用） */
function round1(v: number): number {
  return Math.round(v * 10) / 10
}

/** 小数第2位に丸める（1〜5 の平均用。1桁だと設問間の差が潰れるため） */
function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/**
 * 回答数で重み付けした平均を返す。
 * 重み付けが必要な理由: BO専用・SP専用の設問は回答数が少ないため、
 * 単純平均だと寄与が過大になる。
 */
function weightedAvg(items: { avgScore: number; count: number }[]): number | null {
  const totalCount = items.reduce((a, b) => a + b.count, 0)
  if (totalCount <= 0) return null
  return items.reduce((a, b) => a + b.avgScore * b.count, 0) / totalCount
}

const CATEGORY_ORDER = ['why', 'how', 'what']

/**
 * 浸透ジャーニーを算出する。
 * 5段階すべてが揃わない場合は null を返す（セクション自体を描画しない）。
 */
export function calcFunnel(questions: FunnelInputQuestion[]): FunnelResult | null {
  const questionCount = questions.length
  if (questionCount === 0) return null

  // 設問に段階を割り当てる（スコア未算出の設問は集計から外す）
  const staged: (FunnelInputQuestion & { stage: FunnelStage; avgScore: number })[] = []
  let unstagedCount = 0

  for (const q of questions) {
    const stage = resolveStage(q.sortOrder, questionCount, q.referenceData)
    if (!stage) {
      unstagedCount++
      continue
    }
    if (q.avgScore === null || q.count <= 0) continue
    staged.push({ ...q, stage, avgScore: q.avgScore })
  }

  // 段階ごとに集計
  const summaries = new Map<FunnelStage, StageSummary>()

  for (const stage of ALL_STAGES) {
    const inStage = staged.filter((q) => q.stage === stage)
    if (inStage.length === 0) continue

    const avg = weightedAvg(inStage)
    if (avg === null) continue

    const weakest = inStage.reduce((min, q) => (q.avgScore < min.avgScore ? q : min))
    const categories = CATEGORY_ORDER.filter((c) => inStage.some((q) => q.category === c))

    summaries.set(stage, {
      stage,
      score: round1(normalize(avg)),
      avg: round2(avg),
      questionCount: inStage.length,
      categories,
      weakest: { questionText: weakest.questionText, avgScore: round2(weakest.avgScore) },
    })
  }

  // ファネル5段階が揃わなければ描画しない
  if (!FUNNEL_STAGES.every((s) => summaries.has(s))) return null

  const scoreOf = (s: FunnelStage) => summaries.get(s)!.score
  const funnelScores = {
    awareness: scoreOf('awareness'),
    understanding: scoreOf('understanding'),
    empathy: scoreOf('empathy'),
    behavior: scoreOf('behavior'),
    advocacy: scoreOf('advocacy'),
    // detectPattern は5段階しか見ないが型を満たすために入れる
    environment: summaries.get('environment')?.score ?? 0,
  } as Record<FunnelStage, number>

  // 遷移（4区間）
  const transitions: StageTransition[] = []
  for (let i = 0; i < FUNNEL_STAGES.length - 1; i++) {
    const from = FUNNEL_STAGES[i]
    const to = FUNNEL_STAGES[i + 1]
    const fromScore = scoreOf(from)
    const toScore = scoreOf(to)
    transitions.push({
      from,
      to,
      rate: fromScore > 0 ? round1((toScore / fromScore) * 100) : 0,
      delta: round1(toScore - fromScore),
    })
  }

  const bottleneck = transitions.reduce((min, t) => (t.rate < min.rate ? t : min))
  const weakestStage = FUNNEL_STAGES.reduce((min, s) =>
    scoreOf(s) < scoreOf(min) ? s : min
  )

  // マトリクス（現行カテゴリ × 段階）
  const matrix: Record<string, Partial<Record<FunnelStage, MatrixCell>>> = {}
  for (const category of CATEGORY_ORDER) {
    matrix[category] = {}
    for (const stage of ALL_STAGES) {
      const cell = staged.filter((q) => q.category === category && q.stage === stage)
      if (cell.length === 0) continue
      const avg = weightedAvg(cell)
      if (avg === null) continue
      matrix[category][stage] = {
        score: round1(normalize(avg)),
        questionCount: cell.length,
      }
    }
  }

  return {
    stages: ALL_STAGES.filter((s) => summaries.has(s)).map((s) => summaries.get(s)!),
    transitions,
    pattern: detectPattern(funnelScores),
    bottleneck,
    weakestStage,
    matrix,
    unstagedCount,
  }
}

// ────────────────────────────────────────────
// 段階×グループのスコアと、個人単位の通過率
// ────────────────────────────────────────────

/** 1回答（1人×1設問）。集計の最小単位 */
export interface RespondentAnswer {
  /**
   * 回答者の識別キー。
   * ⚠ respondent_id が未採番のデータでは submitted_at を暫定キーとして使う。
   *    取り込み時に1回答者=1タイムスタンプで揃えているため現状は一意だが、
   *    これは副産物であって保証ではない（同一秒に2人提出すると1人に統合される）。
   */
  respondentKey: string
  questionId: string
  /** 1〜5 */
  score: number
  department: string | null
}

export interface StageScore {
  stage: FunnelStage
  /** 0〜100。該当回答が無ければ null */
  score: number | null
  questionCount: number
  responseCount: number
}

export interface PassRate {
  stage: FunnelStage
  count: number
  /** % */
  rate: number
}

export interface GroupFunnel {
  /** null は全社 */
  department: string | null
  respondentCount: number
  stageScores: StageScore[]
  /** 上流をすべて通過した人の割合（必ず単調減少） */
  cumulative: PassRate[]
  /** その段階だけを見たときの通過率 */
  standalone: PassRate[]
}

/** 段階スコア（回答数で重み付けした平均を正規化） */
function stageScoreOf(rows: { score: number }[], questionIds: Set<string>): number | null {
  if (rows.length === 0) return null
  const avg = rows.reduce((a, r) => a + r.score, 0) / rows.length
  return round1(normalize(avg))
}

/**
 * 段階×グループのスコアと、個人単位の累積通過率をまとめて算出する。
 *
 * 通過の定義: その段階に属する設問の平均が PASS_THRESHOLD 以上。
 * 累積通過: 認知から当該段階まで、すべての段階を通過している人だけを数える。
 * そのため必ず単調減少する。
 */
export function calcGroupFunnels(
  answers: RespondentAnswer[],
  stageByQuestionId: Map<string, FunnelStage>
): { overall: GroupFunnel; byDepartment: GroupFunnel[] } {
  // 段階ごとの設問IDを集める
  const questionIdsByStage = new Map<FunnelStage, Set<string>>()
  for (const [qid, stage] of stageByQuestionId) {
    if (!questionIdsByStage.has(stage)) questionIdsByStage.set(stage, new Set())
    questionIdsByStage.get(stage)!.add(qid)
  }

  /** 指定グループ（department が null なら全社）で集計する */
  const build = (department: string | null): GroupFunnel => {
    const rows = department === null
      ? answers
      : answers.filter((a) => a.department === department)

    // 段階スコア（回答をそのまま平均＝回答数で重み付けした平均と同値）
    const stageScores: StageScore[] = ALL_STAGES.map((stage) => {
      const ids = questionIdsByStage.get(stage) ?? new Set<string>()
      const inStage = rows.filter((r) => ids.has(r.questionId))
      return {
        stage,
        score: stageScoreOf(inStage, ids),
        questionCount: new Set(inStage.map((r) => r.questionId)).size,
        responseCount: inStage.length,
      }
    })

    // 個人ごとの段階別平均 → 通過判定
    const byRespondent = new Map<string, Map<FunnelStage, { sum: number; count: number }>>()
    for (const a of rows) {
      const stage = stageByQuestionId.get(a.questionId)
      if (!stage) continue
      if (!byRespondent.has(a.respondentKey)) byRespondent.set(a.respondentKey, new Map())
      const m = byRespondent.get(a.respondentKey)!
      const cur = m.get(stage) ?? { sum: 0, count: 0 }
      cur.sum += a.score
      cur.count += 1
      m.set(stage, cur)
    }

    const respondentCount = byRespondent.size
    const passedStages: Set<FunnelStage>[] = []
    for (const m of byRespondent.values()) {
      const passed = new Set<FunnelStage>()
      for (const stage of FUNNEL_STAGES) {
        const e = m.get(stage)
        if (e && e.count > 0 && e.sum / e.count >= PASS_THRESHOLD) passed.add(stage)
      }
      passedStages.push(passed)
    }

    const pct = (n: number) =>
      respondentCount > 0 ? Math.round((n / respondentCount) * 1000) / 10 : 0

    const standalone: PassRate[] = FUNNEL_STAGES.map((stage) => {
      const count = passedStages.filter((p) => p.has(stage)).length
      return { stage, count, rate: pct(count) }
    })

    const cumulative: PassRate[] = FUNNEL_STAGES.map((stage, i) => {
      const upTo = FUNNEL_STAGES.slice(0, i + 1)
      const count = passedStages.filter((p) => upTo.every((s) => p.has(s))).length
      return { stage, count, rate: pct(count) }
    })

    return { department, respondentCount, stageScores, cumulative, standalone }
  }

  const departments = [...new Set(answers.map((a) => a.department).filter((d): d is string => !!d))]
  departments.sort()

  return {
    overall: build(null),
    byDepartment: departments.map((d) => build(d)),
  }
}
