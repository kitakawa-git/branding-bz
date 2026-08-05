// 設問の見方（レンズ）の定義
// ============================================================
// 同じ32問を3通りの切り口で見る。目的が違うので併存させる。
//
//   1. 設問タイプ  … 感情 / 言語化・実践 / 環境・仕組み
//        「何が足りないのか」を性質で捉える。施策の種類が直接決まる。
//        分析レポート（2026-08）の中核。上位は「感じるか／思うか」、
//        下位は「説明できるか／機会があるか／仕組みがあるか」に
//        きれいに分かれ、約1.0点の断層があるという発見に対応する。
//
//   2. 4領域      … 理念浸透 / ブランド理解 / 行動体現 / 文化・定着
//        設問番号の並び順による外形的な区分。分析レポートと
//        前年資料との継続性のために持つ。
//
//   3. 浸透段階   … 認知→理解→共感→行動→推奨（funnel-stages.ts）
//        プロセス仮説を前提にした見方。補助的に使う。
//
// ⚠️ どの対応表も定点観測の基準。一度決めたら変更しないこと。
// ============================================================

// ────────────────────────────────────────────
// 1. 設問タイプ
// ────────────────────────────────────────────

export type QuestionLens = 'emotion' | 'articulation' | 'environment'

export const LENS_ORDER: readonly QuestionLens[] = ['emotion', 'articulation', 'environment']

export const LENS_LABELS: Record<QuestionLens, string> = {
  emotion: '感情・態度',
  articulation: '言語化・実践',
  environment: '環境・仕組み',
}

/** その分類が何を問うているか */
export const LENS_QUESTIONS: Record<QuestionLens, string> = {
  emotion: '感じるか・思うか',
  articulation: '説明できるか・実践しているか',
  environment: '機会や仕組みがあるか',
}

/** スコアが低いときに何をすべきか */
export const LENS_ACTIONS: Record<QuestionLens, string> = {
  emotion:
    '共感そのものを増やす施策。ここが高い場合、追加投資の限界効用は小さい。',
  articulation:
    '抽象語を各部門の具体的な業務行動に翻訳し、誰でも同じ言葉で言える形に固定する。',
  environment:
    '個人の意識に依存させず、評価・表彰・業務フォーマットなど会社側の仕組みに埋め込む。',
}

/**
 * 設問タイプの対応表（32問構成の sort_order）。
 *
 * 分類の基準:
 *   emotion      … 感じる / 思う / 共感する / 誇りに思う / 納得する
 *   articulation … 説明できる / 伝えられる / 紹介できる / 意識して行動する
 *   environment  … 機会がある / 基準が明確 / 共有されている / 落とし込まれている /
 *                  文化がある（＝会社側が用意するもの、個人の能力ではないもの）
 */
const LENS_MAP_32: Record<number, QuestionLens> = {
  // 感情・態度
  2: 'emotion', // ビジョンに共感しているか
  3: 'emotion', // 自分の仕事がミッション実現につながっていると感じるか
  5: 'emotion', // 理念は現場の実態と一致していると感じるか
  8: 'emotion', // 理念に誇りを持っているか
  10: 'emotion', // 10年後もこの会社の理念のもとで働きたいか
  16: 'emotion', // ブランド戦略の方向性に納得しているか
  17: 'emotion', // 競合他社と明確に差別化されていると感じるか
  20: 'emotion', // 社会に対して価値ある存在だと感じるか
  25: 'emotion', // ブランドにそわない行動をした際に違和感を覚えるか
  28: 'emotion', // 採用活動にも良い影響を与えていると感じるか

  // 言語化・実践
  1: 'articulation', // ミッションを自分の言葉で説明できるか
  4: 'articulation', // リィツスピリットを日常業務で意識しているか
  6: 'articulation', // 新しく入社したメンバーに理念を伝えられるか
  11: 'articulation', // ブランドの個性を理解しているか
  12: 'articulation', // 顧客に伝えるべき強みを説明できるか
  13: 'articulation', // ターゲット顧客像を明確に理解しているか
  15: 'articulation', // ビジュアルの使用ルールを認識しているか
  21: 'articulation', // 社内の他部門・パートナーとの接点で価値観を意識しているか（本社版）
  22: 'articulation', // 社外でも誇りを持って伝えられるか
  23: 'articulation', // SNSや日常会話でポジティブに紹介できるか
  24: 'articulation', // 自部門の貢献を説明できるか（本社版）
  27: 'articulation', // 業務改善の際にブランドの観点を取り入れているか
  31: 'articulation', // クライアントとの接点で価値観を意識して行動しているか（現場版）
  32: 'articulation', // 名刺交換・自己紹介で強みを自然に伝えられるか（現場版）

  // 環境・仕組み
  7: 'environment', // 理念に基づいた経営判断がなされていると感じるか
  9: 'environment', // 理念を学べる機会が十分にあるか
  14: 'environment', // 対外コミュニケーションの基準が明確か
  18: 'environment', // 経営層から情報が適切に共有されているか
  19: 'environment', // ブランド方針が現場の業務に落とし込まれているか
  26: 'environment', // チームメンバーがブランドに沿った行動をしていると感じるか
  29: 'environment', // 体現が評価・称賛される文化があるか
  30: 'environment', // 1年前と比べて浸透してきたと感じるか
}

// ────────────────────────────────────────────
// 2. 4領域（分析レポートの区分）
// ────────────────────────────────────────────

export type QuestionDomain = 'philosophy' | 'understanding' | 'behavior' | 'culture'

export const DOMAIN_ORDER: readonly QuestionDomain[] = [
  'philosophy',
  'understanding',
  'behavior',
  'culture',
]

export const DOMAIN_LABELS: Record<QuestionDomain, string> = {
  philosophy: '理念浸透',
  understanding: 'ブランド理解',
  behavior: '行動体現',
  culture: '文化・定着',
}

/** 分析レポートで併記されている設問番号の範囲 */
export const DOMAIN_RANGES: Record<QuestionDomain, string> = {
  philosophy: 'Q1-10',
  understanding: 'Q11-20',
  behavior: 'Q21-27',
  culture: 'Q28-30',
}

/**
 * 設問番号 → 4領域。
 * Q31/Q32 は現場版の Q21/Q24 にあたるため行動体現に入れる
 * （分析レポートは両版を同一設問として合算しており、その区分に合わせる）。
 */
function domainOf(sortOrder: number): QuestionDomain | null {
  if (sortOrder >= 1 && sortOrder <= 10) return 'philosophy'
  if (sortOrder >= 11 && sortOrder <= 20) return 'understanding'
  if (sortOrder >= 21 && sortOrder <= 27) return 'behavior'
  if (sortOrder >= 28 && sortOrder <= 30) return 'culture'
  if (sortOrder === 31 || sortOrder === 32) return 'behavior'
  return null
}

// ────────────────────────────────────────────
// 解決
// ────────────────────────────────────────────

const VALID_LENS = new Set<string>(LENS_ORDER)

/**
 * 設問タイプを解決する。
 * reference_data.lens の明示指定 → 対応表（32問/30問構成）→ null。
 */
export function resolveLens(
  sortOrder: number,
  questionCount: number,
  referenceData?: Record<string, unknown> | null
): QuestionLens | null {
  const override = referenceData?.lens
  if (typeof override === 'string' && VALID_LENS.has(override)) {
    return override as QuestionLens
  }
  // 30問構成は 32問構成から Q31/Q32 を除いたもの＝同じ表で引ける
  if (questionCount === 32 || questionCount === 30) {
    return LENS_MAP_32[sortOrder] ?? null
  }
  return null
}

/** 4領域を解決する。設問数が想定外なら null */
export function resolveDomain(
  sortOrder: number,
  questionCount: number
): QuestionDomain | null {
  if (questionCount !== 32 && questionCount !== 30) return null
  return domainOf(sortOrder)
}

// ────────────────────────────────────────────
// 集計
// ────────────────────────────────────────────

/** 1回答（1人×1設問） */
export interface LensAnswer {
  questionId: string
  /** 1〜5 */
  score: number
  department: string | null
}

/** 設問のメタ情報 */
export interface LensQuestion {
  questionId: string
  sortOrder: number
  questionText: string
  referenceData?: Record<string, unknown> | null
}

/** 回答の内訳。肯定=4-5点 / 中立=3点 / 否定=1-2点 */
export interface Distribution {
  responseCount: number
  /** 1〜5 の平均 */
  avg: number
  /** 0〜100 に正規化したスコア */
  score: number
  /** % */
  positiveRate: number
  neutralRate: number
  negativeRate: number
}

export interface GroupDistribution extends Distribution {
  questionCount: number
}

export interface QuestionBreakdown extends Distribution {
  questionId: string
  sortOrder: number
  questionText: string
  lens: QuestionLens | null
  domain: QuestionDomain | null
}

export interface Breakdown {
  overall: Distribution
  byDepartment: (Distribution & { department: string })[]
  byLens: (GroupDistribution & { lens: QuestionLens })[]
  byDomain: (GroupDistribution & { domain: QuestionDomain })[]
  byQuestion: QuestionBreakdown[]
  /** 設問タイプが解決できたか（できない構成ではセクションを出さない） */
  hasLens: boolean
  hasDomain: boolean
}

const r1 = (v: number) => Math.round(v * 10) / 10
const r2 = (v: number) => Math.round(v * 100) / 100
/** 1〜5 の平均を 0〜100 に正規化（既存インナースコアと同じ換算式） */
const normalize = (avg: number) => ((avg - 1) / 4) * 100

/** 回答の集まりから内訳を出す */
function distribute(scores: number[]): Distribution {
  const n = scores.length
  if (n === 0) {
    return { responseCount: 0, avg: 0, score: 0, positiveRate: 0, neutralRate: 0, negativeRate: 0 }
  }
  const avg = scores.reduce((a, b) => a + b, 0) / n
  const pct = (c: number) => Math.round((c / n) * 1000) / 10
  return {
    responseCount: n,
    avg: r2(avg),
    score: r1(normalize(avg)),
    positiveRate: pct(scores.filter((s) => s >= 4).length),
    neutralRate: pct(scores.filter((s) => s === 3).length),
    negativeRate: pct(scores.filter((s) => s <= 2).length),
  }
}

/**
 * 設問タイプ・4領域・部門ごとの内訳をまとめて算出する。
 * 群のスコアは回答をそのままプールした平均＝回答数で重み付けした平均。
 * 本社のみ／現場のみの設問（Q21/24/31/32）が過大に効かないようにするため。
 */
export function calcBreakdown(answers: LensAnswer[], questions: LensQuestion[]): Breakdown {
  const questionCount = questions.length

  const lensOf = new Map<string, QuestionLens | null>()
  const domainOfQ = new Map<string, QuestionDomain | null>()
  for (const q of questions) {
    lensOf.set(q.questionId, resolveLens(q.sortOrder, questionCount, q.referenceData))
    domainOfQ.set(q.questionId, resolveDomain(q.sortOrder, questionCount))
  }

  const scoresBy = <K,>(key: (a: LensAnswer) => K | null) => {
    const m = new Map<K, number[]>()
    for (const a of answers) {
      const k = key(a)
      if (k === null || k === undefined) continue
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(a.score)
    }
    return m
  }

  const byDeptMap = scoresBy((a) => a.department)
  const byLensMap = scoresBy((a) => lensOf.get(a.questionId) ?? null)
  const byDomainMap = scoresBy((a) => domainOfQ.get(a.questionId) ?? null)
  const byQuestionMap = scoresBy((a) => a.questionId)

  /** その群に含まれる設問の種類数 */
  const questionsIn = (pred: (q: LensQuestion) => boolean) =>
    questions.filter(pred).filter((q) => (byQuestionMap.get(q.questionId)?.length ?? 0) > 0).length

  return {
    overall: distribute(answers.map((a) => a.score)),

    // 回答数の多い部署から並べる。母数の大きい側を先に見せたいのと、
    // 名前の五十音順だと部署名を変えるだけで並びが変わってしまうため
    byDepartment: [...byDeptMap.entries()]
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
      .map(([department, scores]) => ({ department, ...distribute(scores) })),

    byLens: LENS_ORDER.filter((l) => byLensMap.has(l)).map((lens) => ({
      lens,
      questionCount: questionsIn((q) => lensOf.get(q.questionId) === lens),
      ...distribute(byLensMap.get(lens)!),
    })),

    byDomain: DOMAIN_ORDER.filter((d) => byDomainMap.has(d)).map((domain) => ({
      domain,
      questionCount: questionsIn((q) => domainOfQ.get(q.questionId) === domain),
      ...distribute(byDomainMap.get(domain)!),
    })),

    byQuestion: questions
      .filter((q) => (byQuestionMap.get(q.questionId)?.length ?? 0) > 0)
      .map((q) => ({
        questionId: q.questionId,
        sortOrder: q.sortOrder,
        questionText: q.questionText,
        lens: lensOf.get(q.questionId) ?? null,
        domain: domainOfQ.get(q.questionId) ?? null,
        ...distribute(byQuestionMap.get(q.questionId)!),
      })),

    hasLens: byLensMap.size > 0,
    hasDomain: byDomainMap.size > 0,
  }
}
