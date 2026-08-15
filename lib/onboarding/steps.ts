// 初回セットアップ案内（管理者向け）の唯一の定義源。
//
// ポータルのカードと管理画面の鏡写しカードが同じ進捗を出す必要があるので、
// ステップ定義も完了判定もここ1箇所に置く。2箇所に書くと必ず片方だけ直す日が来る。
//
// プランごとに別のステップ列を持つ:
//   free  … ブランド情報の入力に絞った6つ。できることだけで完結させる
//   それ以外 … 掲示から発信まで一巡する4つ
// 「standard の列からプラン外に鍵をかける」引き算にすると、free では
// 「4つのうち2つ押せない」案内になり、できることが埋もれる。
//
// UI 側にプラン分岐を書かせないため、見出し・下部の案内文まで含めて
// getOnboardingConfig() が返す。カードは受け取った内容を並べるだけ。
import { getEffectivePlan, getMaxMembers, type Plan } from '@/lib/billing/entitlements'

export type OnboardingStepId =
  | 'basics'
  | 'philosophy'
  | 'personality'
  | 'visuals'
  | 'verbal'
  | 'post'
  | 'announcement'
  | 'invite'

export type OnboardingStep = {
  id: OnboardingStepId
  title: string
  /** 所要目安。無い場合は出さない */
  duration?: string
  description: string
  ctaLabel: string
  /** 先に済ませてほしいステップが残っているときのラベル。押せることは変えない */
  ctaLabelWaiting?: string
  href: string
  /** 「迷ったら」の下書き支援。完了判定には関与しない */
  assist?: { label: string; href: string }
}

/** 各ステップが済んでいるか。API が data の existence だけを見て埋める */
export type OnboardingStatus = Partial<Record<OnboardingStepId, boolean>>

export type OnboardingConfig = {
  heading: string
  lead: string
  /** 見出し横に現在のプランバッジを出すか */
  showPlanBadge: boolean
  steps: OnboardingStep[]
  /** カード最下部の1行。次の段への案内であってロックではない */
  upsell?: { text: string; href: string }
}

/**
 * free 専用。ブランド情報を入力しきることだけに絞る。
 * 並びは管理画面の分類（基本情報 → ブランド方針 → ビジュアル → バーバル）に合わせる。
 * 受け手側の言い方（考え方／見え方・聞こえ方）だと、登録しに行く画面の名前と
 * 一致せず、着いた先で「どれを触ればいいのか」が分からなくなる。
 *
 * 管理画面でメニューが分かれているものは案内も分ける。
 * ブランド戦略だけはステップにしない（初回に必須ではない）。
 */
function freeConfig(plan: Plan): OnboardingConfig {
  const maxMembers = getMaxMembers(plan)
  return {
    heading: 'まず、会社の「らしさ」をかたちにしましょう',
    lead: '基本情報 → 方針 → パーソナリティ → ビジュアル → バーバルの順に登録すると、ここが会社の全員がブランドと出会う場所になります。AIツールが下書きを手伝います。',
    showPlanBadge: true,
    steps: [
      {
        id: 'basics',
        title: '会社の基本情報を整える',
        duration: '約5分',
        // スマート名刺は Standard 以上（smartCard: free = false）。
        // free の案内で名刺を成果に挙げると、使えない機能を売り込むことになる
        description: '社名・業種・ロゴ。ブランド掲示とポータルの土台になります。',
        ctaLabel: '基本情報を入力する',
        href: '/admin/company',
      },
      {
        id: 'philosophy',
        title: 'ブランド方針を登録する',
        duration: '約15分',
        description:
          'ミッション・ビジョン・行動指針。まだ言葉になっていなくても大丈夫です。',
        ctaLabel: 'ブランド方針を登録する',
        href: '/admin/brand/guidelines',
      },
      {
        id: 'personality',
        title: 'ブランドパーソナリティを登録する',
        duration: '約10分',
        description:
          'ブランドの人格と特性。どんな性格の会社として見られたいかが決まります。',
        ctaLabel: 'パーソナリティを登録する',
        href: '/admin/brand/personality',
        assist: { label: 'パーソナリティ診断で下書きを作る', href: '/tools/personality' },
      },
      {
        id: 'visuals',
        title: 'ビジュアルを登録する',
        duration: '約10分',
        // free には社外向けの面（スマート名刺・公開ブランドページ）が無いので、
        // 「社外に見せる顔」を成果にしない
        description: 'ブランドカラーとロゴの扱い。掲示や資料の見た目が揃います。',
        ctaLabel: 'ビジュアルを登録する',
        href: '/admin/brand/visuals',
        assist: { label: 'カラー定義ツールで下書きを作る', href: '/tools/colors' },
      },
      {
        id: 'verbal',
        title: 'バーバルを登録する',
        duration: '約10分',
        description: '言葉づかいのトーンと用語のルール。社内外での話し方が揃います。',
        ctaLabel: 'バーバルを登録する',
        href: '/admin/brand/verbal',
      },
      {
        id: 'invite',
        title: 'メンバーを招待する',
        // 上限は MAX_MEMBERS から引く。ここに数字を直書きすると、
        // 上限を変えたときに案内だけ古い数字のまま残る（実際 1名→5名 で起きた）
        duration: maxMembers ? `${maxMembers}名まで無料` : undefined,
        description:
          '登録した「らしさ」を、まず身近なメンバーに見てもらいましょう。',
        ctaLabel: '招待リンクを発行する',
        ctaLabelWaiting: 'ステップ1〜5のあとで',
        href: '/admin/members-portal',
      },
    ],
    upsell: {
      text: '登録した「らしさ」を、タイムラインやお知らせで日常に広げるのは Standard から。まずは登録を仕上げましょう。',
      href: '/plan',
    },
  }
}

/** standard 以上。掲示 → 投稿 → お知らせ → 招待で一巡する */
function standardConfig(): OnboardingConfig {
  return {
    heading: 'ようこそ、branding.bz へ',
    lead: 'ここは、あなたの会社の全員がブランドと出会う場所です。いまは空っぽ——4つのステップで、社員を迎える準備をしましょう。',
    showPlanBadge: false,
    steps: [
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
        title: '最初の Good Action を投稿する',
        duration: '約1分',
        description:
          'タイムラインの最初の1件はあなたの投稿です。社員は入った日に、空でないタイムラインを見ます。',
        ctaLabel: '投稿する',
        href: '/portal/timeline?compose=1',
      },
      {
        id: 'announcement',
        title: 'お知らせを1本出す',
        duration: '約3分',
        description: '「branding.bz を始めます」の一言で十分です。',
        ctaLabel: 'お知らせを書く',
        href: '/admin/announcements',
      },
      {
        id: 'invite',
        title: 'メンバーを招待する',
        description:
          '準備ができてから招待すると、社員には完成した状態のポータルが届きます。',
        ctaLabel: '招待リンクを発行する',
        ctaLabelWaiting: 'ステップ2・3のあとで',
        href: '/admin/members-portal',
      },
    ],
  }
}

/**
 * プランに応じたステップ列と文言。
 * card は販売終了だが timeline / announcements を持たないので、
 * 万一残っていた場合に詰まないよう free と同じ列にする。
 */
export function getOnboardingConfig(plan: Plan): OnboardingConfig {
  return plan === 'free' || plan === 'card' ? freeConfig(plan) : standardConfig()
}

export type OnboardingStepView = OnboardingStep & {
  /** 1始まりの表示番号 */
  index: number
  done: boolean
  /** 未完了のうち最初の1つ */
  current: boolean
}

export type OnboardingView = {
  config: OnboardingConfig
  steps: OnboardingStepView[]
  doneCount: number
  total: number
  /** すべて完了したか。ここが true ならカードを出さない */
  allDone: boolean
}

type CompanyLike = Parameters<typeof getEffectivePlan>[0]

/**
 * 会社と完了状況から、そのまま描画できる形を作る。
 * ポータル・管理画面の両方がこの関数を通す。
 */
export function buildOnboardingView(
  company: CompanyLike,
  status: OnboardingStatus,
): OnboardingView {
  const config = getOnboardingConfig(getEffectivePlan(company))

  const steps = config.steps.map((step, i) => ({
    ...step,
    index: i + 1,
    done: !!status[step.id],
    current: false,
  }))

  const currentIdx = steps.findIndex((s) => !s.done)
  if (currentIdx >= 0) steps[currentIdx].current = true

  const doneCount = steps.filter((s) => s.done).length

  return {
    config,
    steps,
    doneCount,
    total: steps.length,
    allDone: steps.length > 0 && doneCount === steps.length,
  }
}
