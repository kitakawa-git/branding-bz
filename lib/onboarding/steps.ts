// 初回セットアップ案内（管理者向け）の唯一の定義源。
//
// ポータルのカードと管理画面の鏡写しカードが同じ進捗を出す必要があるので、
// ステップ定義も完了判定もここ1箇所に置く。2箇所に書くと必ず片方だけ直す日が来る。
//
// 表示の方針:
//   - 順序は固定。メンバー招待を最後に置き、空のポータルを社員に見せない順路にする
//   - 完了判定は「データがあるか」だけ。文字数や品質などの程度判定は入れない
//   - プラン外のステップは 🔒 で見せるが、進捗の分母には数えない。
//     free で ②③ が永久に未完了だと、4/4 に到達できずカードが消えなくなるため
import { can, type FeatureKey } from '@/lib/billing/entitlements'

export type OnboardingStepId = 'philosophy' | 'post' | 'announcement' | 'invite'

export type OnboardingStep = {
  id: OnboardingStepId
  title: string
  /** 所要目安。無い場合は出さない */
  duration?: string
  description: string
  ctaLabel: string
  href: string
  /** 必要な機能。未指定ならどのプランでも実行できる */
  feature?: FeatureKey
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'philosophy',
    title: '会社の「らしさ」を登録する',
    duration: '約15分',
    description:
      'ミッション・行動指針・ブランドカラーを登録します。AI構築ツールで下書きから作ることもできます。',
    ctaLabel: 'ブランド掲示を登録する',
    href: '/admin/brand/guidelines',
  },
  {
    id: 'post',
    title: '最初の Good Job を投稿する',
    duration: '約1分',
    description:
      'タイムラインの最初の1件はあなたの投稿です。社員は入った日に、空でないタイムラインを見ます。',
    ctaLabel: '投稿する',
    href: '/portal/timeline?compose=1',
    feature: 'timeline',
  },
  {
    id: 'announcement',
    title: 'お知らせを1本出す',
    duration: '約3分',
    description: '「branding.bz を始めます」の一言で十分です。',
    ctaLabel: 'お知らせを書く',
    href: '/admin/announcements',
    feature: 'announcements',
  },
  {
    id: 'invite',
    title: 'メンバーを招待する',
    description:
      '準備ができてから招待すると、社員には完成した状態のポータルが届きます。',
    ctaLabel: '招待リンクを発行する',
    href: '/admin/members-portal',
  },
]

/** 各ステップが済んでいるか。API が data の existence だけを見て埋める */
export type OnboardingStatus = Record<OnboardingStepId, boolean>

export type OnboardingStepView = OnboardingStep & {
  /** 1始まりの表示番号。ロックされたステップも番号は詰めない */
  index: number
  done: boolean
  /** プラン外。表示はするが進捗には数えない */
  locked: boolean
  /** 実行できて未完了のうち、最初の1つ */
  current: boolean
}

export type OnboardingView = {
  steps: OnboardingStepView[]
  /** 実行できるステップのうち完了した数 */
  doneCount: number
  /** 実行できるステップ数（＝進捗の分母） */
  total: number
  /** 実行できるステップがすべて完了したか。ここが true ならカードを出さない */
  allDone: boolean
}

type CompanyLike = Parameters<typeof can>[0]

/**
 * ステップ定義と完了状況から、そのまま描画できる形を作る。
 * ポータル・管理画面の両方がこの関数を通す。
 */
export function buildOnboardingView(
  company: CompanyLike,
  status: OnboardingStatus,
): OnboardingView {
  const withState = ONBOARDING_STEPS.map((step, i) => {
    const locked = !!step.feature && !can(company, step.feature)
    return {
      ...step,
      index: i + 1,
      done: !!status[step.id],
      locked,
      current: false,
    }
  })

  // 「現在のステップ」は、実行できて未完了の最初の1つ
  const currentIdx = withState.findIndex((s) => !s.locked && !s.done)
  if (currentIdx >= 0) withState[currentIdx].current = true

  const actionable = withState.filter((s) => !s.locked)
  const doneCount = actionable.filter((s) => s.done).length

  return {
    steps: withState,
    doneCount,
    total: actionable.length,
    allDone: actionable.length > 0 && doneCount === actionable.length,
  }
}
