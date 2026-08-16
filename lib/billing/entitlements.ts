// プラン判定の唯一の正。
//
// ⚠️ この外にプラン分岐を書かないこと。画面・API のどちらからも、
//    can() / requirePlan() / getEffectivePlan() を通して判定する。
//    companies.plan を直接読む箇所を作らない（期限切れを取りこぼすため）。
//
// 根拠: 260716_プラン制限実装_指示書_v1.md（v1.3 まで反映）
//       260716_料金ページ改訂案_v2.md（Card削除＋Enterprise枠）
//       260716_料金ページ改訂案_v3.md（Free掲示編集＋計測のEnterprise移動）
import { MONTHLY_FREE_LIMIT } from '@/lib/tools/free-limits'

// ============================================================
// プラン
// ============================================================

/**
 * card は販売終了（v1.1）。DB の check 制約には含めず、コード上だけ温存する。
 * Early Access 終了後に「構築済みのブランドを名刺で配り続ける維持プラン」として
 * 復活させる可能性があるため、復活を SELLABLE_PLANS に1語足すだけにしておく。
 */
export type Plan = 'free' | 'card' | 'standard' | 'premium' | 'enterprise'

/** 販売中のプラン。card はここに入れない＝新規に割り当てる経路を作らない */
export const SELLABLE_PLANS: readonly Plan[] = ['free', 'standard', 'premium', 'enterprise']

/** セルフサーブで選べるプラン。enterprise は商談経由で superadmin が手動割り当て */
export const SELF_SERVE_PLANS: readonly Plan[] = ['free', 'standard', 'premium']

export type FeatureKey =
  | 'buildTools'           // 構築ツール（colors/persona/personality/stp）の利用そのもの
  | 'buildToolsUnlimited'  // false の場合は各ツール月3回の上限あり
  | 'pdfExport'
  | 'portalSync'           // 構築ツール → 本体連携
  | 'brandGuidelinesView'
  | 'brandGuidelinesEdit'
  | 'ciManualPdf'
  | 'smartCard'
  | 'cardAnalytics'        // 閲覧解析＋アウタースコア
  | 'microFeedback'
  | 'timeline'             // Good Action投稿
  | 'announcements'        // お知らせ＋Web Push
  | 'videoLearning'
  | 'brandQuiz'            // ブランド理解度テスト
  | 'kpi'
  | 'brandScoreInner'      // インナースコア＋推移＋ギャップ（自己計測で完結する範囲）
  | 'innerSurvey'
  | 'brandScoreIntegrated' // 統合スコア（インナー×アウター）＋市場調査（伴走とセット）

/**
 * プラン → 機能。指示書 v1.3 の最終版をそのまま表にしている。
 *
 * 「最低プラン＋序列」ではなく明示的な表にしているのは、card が序列に乗らないため。
 * card は free より上（スマート名刺が使える）だが standard より下（構築系が無い）で、
 * 単純な rank では表現できない。
 */
const FEATURE_MATRIX: Record<FeatureKey, Record<Plan, boolean>> = {
  //                     free   card   standard premium enterprise
  buildTools:          { free: true,  card: true,  standard: true,  premium: true,  enterprise: true  },
  buildToolsUnlimited: { free: false, card: false, standard: true,  premium: true,  enterprise: true  },
  pdfExport:           { free: false, card: false, standard: true,  premium: true,  enterprise: true  },
  portalSync:          { free: false, card: false, standard: true,  premium: true,  enterprise: true  },
  // v3 で Free に掲示編集が降りた（Free に「自分のブランドを作って保存する場所」を与える）
  brandGuidelinesView: { free: true,  card: true,  standard: true,  premium: true,  enterprise: true  },
  brandGuidelinesEdit: { free: true,  card: true,  standard: true,  premium: true,  enterprise: true  },
  ciManualPdf:         { free: false, card: false, standard: true,  premium: true,  enterprise: true  },
  // スマート名刺系は v1.1 で standard 開始に変更（Card 削除に伴う）
  smartCard:           { free: false, card: true,  standard: true,  premium: true,  enterprise: true  },
  cardAnalytics:       { free: false, card: true,  standard: true,  premium: true,  enterprise: true  },
  microFeedback:       { free: false, card: true,  standard: true,  premium: true,  enterprise: true  },
  // v1.3 で premium → standard に降格。
  // ⚠️ timeline / announcements / kpi はブラウザから supabase-js で直接テーブルを書くため、
  //    RLS 側にも同じプラン条件がある（migration 20260814140000_rls_plan_conditions）。
  //    プラン構成を変えるときは、この表と RLS の company_plan_allows(...) の両方を直すこと。
  timeline:            { free: false, card: false, standard: true,  premium: true,  enterprise: true  },
  announcements:       { free: false, card: false, standard: true,  premium: true,  enterprise: true  },
  videoLearning:       { free: false, card: false, standard: false, premium: true,  enterprise: true  },
  brandQuiz:           { free: false, card: false, standard: false, premium: true,  enterprise: true  },
  // ⚠️ RLS 側にも同条件あり（20260814140000_rls_plan_conditions・goal_kpis / goal_periods）
  kpi:                 { free: false, card: false, standard: false, premium: true,  enterprise: true  },
  // v4 で計測の split を入れ替えた。以前は「basic＝アウター（premium）／full＝インナー（enterprise）」
  // だったが、インナーは自社だけで完結する自己計測なので premium 側が正しい。
  // 外の目線（市場調査を含むアウター）と、その総合値だけが伴走とセットの enterprise。
  // ⚠️ RLS 側にも同条件あり（20260816120000_rls_inner_survey_premium）。片方だけ直さないこと。
  brandScoreInner:     { free: false, card: false, standard: false, premium: true,  enterprise: true  },
  innerSurvey:         { free: false, card: false, standard: false, premium: true,  enterprise: true  },
  brandScoreIntegrated:{ free: false, card: false, standard: false, premium: false, enterprise: true  },
}

/** メンバー上限。null は無制限 */
const MAX_MEMBERS: Record<Plan, number | null> = {
  // 5名。1名だと「自分ひとりで触るもの」になり、社内で見せ合う体験まで届かない。
  // 小さなチームがひととおり試せて、かつ全社に配るには足りない、が狙い
  free: 5,
  card: 30, // 温存（販売終了のため実際には使われない）
  standard: 50,
  premium: 300,
  enterprise: null,
}

// ============================================================
// 判定
// ============================================================

/** plan / plan_expires_at さえ持っていれば何でも受ける（select の列を絞れるように） */
export type PlanBearer = {
  plan?: string | null
  plan_expires_at?: string | null
} | null | undefined

function isPlan(value: unknown): value is Plan {
  return typeof value === 'string' && value in MAX_MEMBERS
}

/**
 * 実効プランを返す。plan_expires_at が過去なら 'free'。
 *
 * 期限切れを毎回この場で判定する（遅延評価）ことで、日次 Cron が失敗しても
 * 期限切れの企業が上位機能を使い続けることが無い。Cron はデータ整合のためだけ。
 *
 * company が無い・plan が不正な値のときも 'free'（安全側）。
 */
export function getEffectivePlan(company: PlanBearer, now: Date = new Date()): Plan {
  if (!company) return 'free'
  const contracted = isPlan(company.plan) ? company.plan : 'free'
  if (!company.plan_expires_at) return contracted
  const expiresAt = new Date(company.plan_expires_at)
  if (Number.isNaN(expiresAt.getTime())) return contracted // 壊れた値で機能を止めない
  return expiresAt.getTime() <= now.getTime() ? 'free' : contracted
}

/** その企業がその機能を使えるか */
export function can(company: PlanBearer, feature: FeatureKey, now: Date = new Date()): boolean {
  return FEATURE_MATRIX[feature][getEffectivePlan(company, now)]
}

/** requirePlan が投げるエラー。API Route 側で 403 に変換する */
export class PlanRequiredError extends Error {
  readonly feature: FeatureKey
  /** その機能を使える最小の販売中プラン。UI のアップセル表示に使う */
  readonly requiredPlan: Plan
  constructor(feature: FeatureKey, requiredPlan: Plan) {
    super(`このプランでは利用できません（feature=${feature} / requiredPlan=${requiredPlan}）`)
    this.name = 'PlanRequiredError'
    this.feature = feature
    this.requiredPlan = requiredPlan
  }
}

/**
 * その機能を使える最小の販売中プラン。card は販売終了なので候補から外す
 * （card しか使えない機能は無いので、必ずいずれかに当たる）。
 */
export function minimumPlanFor(feature: FeatureKey): Plan {
  const row = FEATURE_MATRIX[feature]
  return SELLABLE_PLANS.find((p) => row[p]) ?? 'enterprise'
}

/** 権限が無ければ throw する。API Route の処理の前に通す */
export function requirePlan(company: PlanBearer, feature: FeatureKey, now: Date = new Date()): void {
  if (can(company, feature, now)) return
  throw new PlanRequiredError(feature, minimumPlanFor(feature))
}

/**
 * 構築ツールの月次上限。null は無制限。
 * 上限は「各ツールにつき月3回」＝ lib/tools/free-limits.ts の実装と同じ数え方。
 */
export function getBuildToolMonthlyLimit(plan: Plan): number | null {
  return FEATURE_MATRIX.buildToolsUnlimited[plan] ? null : MONTHLY_FREE_LIMIT
}

/** メンバー上限。null は無制限 */
export function getMaxMembers(plan: Plan): number | null {
  return MAX_MEMBERS[plan]
}

/**
 * いま current 人いる会社に adding 人足して上限に収まるか。
 * limit が null（無制限）なら常に収まる。
 * 「ちょうど上限ぴったり」は収まる側に入れる（50名プランは50人まで使える）。
 */
export function fitsWithinMemberLimit(
  limit: number | null,
  current: number,
  adding: number,
): boolean {
  if (limit === null) return true
  return current + adding <= limit
}

/** 有償プランか。plan_started_at を埋めるかどうかの判断などに使う */
export function isPaidPlan(plan: Plan): boolean {
  return plan !== 'free'
}
