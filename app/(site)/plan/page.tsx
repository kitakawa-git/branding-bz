import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, ArrowRight } from 'lucide-react'
import { PageHero, GlowCard } from '@/components/lp/ui'

export const metadata: Metadata = {
  title: '料金プラン | branding.bz',
  description:
    'AIブランディングSaaS branding.bz の料金プラン。Free / Standard / Premium / Enterprise から、あなたのブランドフェーズに最適なプランを選べます。',
  alternates: {
    canonical: '/plan',
  },
  openGraph: {
    title: '料金プラン | branding.bz',
    description:
      'AIブランディングSaaS branding.bz の料金プラン。Free / Standard / Premium / Enterprise から、あなたのブランドフェーズに最適なプランを選べます。',
    url: 'https://branding.bz/plan',
  },
}

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    subtitle: '体験する',
    price: '¥0',
    priceSuffix: null,
    description: 'AIツールを体験し、ブランド掲示を自分の手で作り始める。',
    scale: '個人',
    members: '—',
    support: '—',
    perPerson: '—',
    features: [
      'AIツール体験（各ツール 月3回）',
      // Free で自社ブランドを作り始められるようにする（v3の目玉）。
      // メンバー上限1名なので「社員に見せたい→Standard」の動線になる
      'ブランド掲示 編集＋閲覧',
    ],
    ctaLabel: '無料で始める',
    ctaHref: '/tools/colors',
    ctaStyle: 'outline' as const,
    reference: null,
    isHighlight: false,
  },
  {
    id: 'standard',
    name: 'Standard',
    subtitle: '構築＋発信する',
    price: '¥19,800',
    priceSuffix: '/月（税別）',
    description:
      'AIでブランドを構築し、名刺で届ける。コンサルの1/10以下の投資で、ブランド戦略を自社で策定。',
    scale: '10〜50名',
    members: '50名',
    support: 'メール',
    perPerson: '¥396〜1,980',
    features: [
      '― 構築 ―',
      'AIツール使用無制限',
      'STP分析',
      'ブランドカラー定義',
      'ペルソナビルダー',
      'パーソナリティ診断',
      'CIマニュアル出力',
      '― 浸透 ―',
      'ブランド掲示 編集＋閲覧',
      '― 発信 ―',
      'スマート名刺 全機能',
    ],
    ctaLabel: 'ブランド構築を始める',
    ctaHref: '/signup',
    ctaStyle: 'primary' as const,
    reference: 'ブランディングコンサル 月30〜100万円 → 年間約24万円で1/10以下',
    isHighlight: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    subtitle: '構築＋浸透＋発信する',
    price: '¥59,800',
    priceSuffix: '/月（税別）',
    description:
      '構築から浸透まで全機能。社員が学び、理解し、体現する仕組みを、日常の運用に組み込む。',
    scale: '50〜300名',
    members: '300名',
    support: 'チャット＋電話',
    perPerson: '¥199〜1,196',
    // 計測グループは Enterprise へ移動（スコアは解釈と打ち手＝伴走とセットで出す）。
    // Premium が浸透のみになったので「― 浸透 ―」の区切りラベルも不要
    features: [
      'Standard全機能に加えて：',
      'ビデオラーニング',
      'ブランド理解度テスト',
      'Good Jobタイムライン',
      'お知らせ配信＋Web Push',
      'KPI・目標管理',
    ],
    ctaLabel: 'フル機能で導入する',
    ctaHref: '/contact',
    ctaStyle: 'primary' as const,
    reference: 'コンサル浸透込み 年間500〜1,000万円 → 年間約72万円で1/10以下',
    isHighlight: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    subtitle: 'すべてを、伴走つきで',
    price: '個別見積',
    priceSuffix: null,
    description:
      '300名超の組織、複数ブランドの統合管理、コンサルティングによる伴走。要件に合わせて設計します。',
    scale: '300名超',
    members: '無制限',
    support: '専任担当',
    perPerson: '—',
    features: [
      'Premium 全機能',
      'メンバー数 無制限',
      '― 計測（伴走つき） ―',
      'インナーサーベイ＋AI設問生成',
      '統合ブランドスコア',
      'スコア推移の自動記録',
      '部署別ヒートマップ',
      'ギャップ分析',
      '― 体制 ―',
      'ID INC. による四半期伴走レビュー',
      // SSO・マルチブランドは未実装。商談後に要件ベースで作る方針のため
      // 確定機能として書かない（誇大表示の回避）
      'マルチブランド管理（対応予定）',
      'SSO・監査ログ等の統制要件（対応予定）',
      '導入オンボーディング・社内研修',
    ],
    ctaLabel: 'お問い合わせ',
    ctaHref: '/contact',
    ctaStyle: 'outline' as const,
    reference: null,
    isHighlight: false,
  },
]

// カード名＝現在地、trigger＝次に進みたくなる瞬間。
// 最終段（Enterprise）はその先が無いので trigger を持たない
const UPSELL_STEPS = [
  { name: 'Free', subtitle: '体験する', trigger: 'AIを無制限に使い\n名刺で発信したい' },
  { name: 'Standard', subtitle: '構築＋発信', trigger: '社員に\n浸透させたい' },
  { name: 'Premium', subtitle: '浸透する', trigger: '浸透の効果を\n数値で測りたい' },
  { name: 'Enterprise', subtitle: '計測＋伴走', trigger: '' },
]

const COMMON_ITEMS = [
  '初期費用 ¥0',
  '月払い（年払い割引は今後検討）',
  'データエクスポート対応',
  'SSL暗号化通信',
  'プランの変更・解約はいつでも可能',
  '名刺カードは追加発注可（実費）',
  'PWA対応・スマホのホーム画面に追加可能',
  'ブランド用語wiki（238語）は誰でも無料閲覧',
]

export default function LpPlanPage() {
  return (
    <main>
      <PageHero eyebrow="Pricing" title={<>あなたのブランドフェーズに<br className="hidden sm:block" />最適なプランを</>}>
        体験から始めて、ブランドの成長に合わせてステップアップ。すべてのプランに初期費用はかかりません。
      </PageHero>

      {/* プランカード */}
      <section className="px-6 pb-20">
        {/* CTAの高さを揃えるため、カードの中身を「本文／ボタン／注記」の3行に分け、
            subgrid で4枚の行を共有する。注記の行数がプランごとに違うので、
            カード内で flex-1 を使うだけではボタンの位置が揃わない */}
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 pt-5 md:grid-cols-2 lg:grid-cols-4 lg:grid-rows-[1fr_auto_auto] lg:gap-y-0">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className="relative flex flex-col lg:row-span-3 lg:grid lg:grid-rows-subgrid"
            >
              {plan.isHighlight && (
                <div className="absolute -top-3 inset-x-0 z-20 flex justify-center">
                  <span className="rounded-full bg-gradient-to-r from-orange-400 to-rose-500 px-4 py-1 text-xs font-bold uppercase tracking-widest text-white">
                    おすすめ
                  </span>
                </div>
              )}
              <GlowCard
                className={`flex flex-1 flex-col p-6 lg:row-span-3 lg:grid lg:grid-rows-subgrid ${plan.isHighlight ? 'border-orange-400/40 ring-1 ring-orange-400/30' : ''}`}
              >
                {/* 1行目: 本文（プランごとに高さが違う） */}
                <div className="flex flex-1 flex-col">
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-blue-400">
                  {plan.subtitle}
                </p>
                <h3 className="mb-4 text-xl font-bold">{plan.name}</h3>
                <div className="mb-3">
                  {/* 「個別見積」のような文言の価格は、金額と同じサイズだと
                      字面が重く見えるので一段下げる */}
                  <span
                    className={`font-bold tracking-tight ${
                      plan.price.startsWith('¥')
                        ? 'text-3xl md:text-4xl'
                        : 'text-2xl md:text-3xl'
                    }`}
                  >
                    {plan.price}
                  </span>
                  {plan.priceSuffix && (
                    <span className="ml-1 text-sm text-white/45">{plan.priceSuffix}</span>
                  )}
                </div>
                <p className="mb-4 text-sm leading-relaxed text-white/55" style={{ minHeight: '5rem' }}>
                  {plan.description}
                </p>

                <div className="mb-4 grid grid-cols-2 gap-x-3 gap-y-2 border-y border-white/10 py-3">
                  {[
                    ['想定規模', plan.scale],
                    ['メンバー上限', plan.members],
                    ['サポート', plan.support],
                    ['1人あたり目安', plan.perPerson],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p className="mb-0.5 text-xs text-white/40">{k}</p>
                      <p className="text-xs font-semibold text-white/80">{v}</p>
                    </div>
                  ))}
                </div>

                <ul className="mb-4 space-y-2">
                  {plan.features.map((feature, idx) =>
                    feature.endsWith('：') || feature.startsWith('―') ? (
                      <li key={idx} className="text-xs font-semibold tracking-wide text-white/40">
                        {feature}
                      </li>
                    ) : (
                      <li key={idx} className="flex items-start gap-2">
                        <Check size={13} strokeWidth={2.5} className="mt-0.5 shrink-0 text-emerald-400" />
                        <span className="text-sm text-white/75">{feature}</span>
                      </li>
                    )
                  )}
                </ul>

                <div className="flex-1" />
                </div>

                {/* 2行目: ボタン。4枚で同じ行を共有するので位置が揃う */}
                <Link
                  href={plan.ctaHref}
                  className={`flex h-11 w-full items-center justify-center rounded-xl text-sm font-bold transition-transform hover:scale-[1.03] ${
                    plan.ctaStyle === 'primary'
                      ? 'bg-white text-black'
                      : 'border border-white/15 text-white/80'
                  }`}
                >
                  {plan.ctaLabel}
                </Link>

                {/* 3行目: 注記。行数が違っても上のボタンには影響しない */}
                <div className="mt-3 flex min-h-[60px] items-start justify-center">
                  {plan.reference && (
                    <p className="text-center text-xs leading-relaxed text-white/40">{plan.reference}</p>
                  )}
                </div>
              </GlowCard>
            </div>
          ))}
        </div>
      </section>

      {/* アップセルパス */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-12 text-center text-2xl font-bold tracking-tight md:text-3xl">
            ブランドの成長に合わせてステップアップ
          </h2>
          <div className="grid grid-cols-2 items-start gap-4 md:grid-cols-4 md:gap-6">
            {UPSELL_STEPS.map((step, idx) => (
              <div key={step.name} className="relative flex flex-col items-center text-center">
                {idx < UPSELL_STEPS.length - 1 && (
                  <div className="absolute top-6 -right-3 z-10 hidden md:flex md:-right-4">
                    <ArrowRight size={16} className="text-white/30" />
                  </div>
                )}
                <GlowCard className="w-full p-5">
                  <div className="mb-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold text-black">
                    {step.subtitle}
                  </div>
                  <h3 className="mb-2 text-base font-bold">{step.name}</h3>
                  {/* 最終段は trigger を持たないので、空の枠を残さず出さない */}
                  {step.trigger && (
                    <div className="inline-block rounded-lg bg-blue-500/10 px-3 py-1.5">
                      <p className="whitespace-pre-line text-xs leading-relaxed text-white/50">
                        {step.trigger}
                      </p>
                    </div>
                  )}
                </GlowCard>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 共通事項 */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <GlowCard className="px-6 py-8 text-center">
            <h2 className="mb-6 text-2xl font-bold tracking-tight md:text-3xl">すべてのプランに共通</h2>
            <div className="mx-auto grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
              {COMMON_ITEMS.map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                    <Check size={11} strokeWidth={2.5} className="text-emerald-400" />
                  </span>
                  <span className="text-left text-sm text-white/70">{item}</span>
                </div>
              ))}
            </div>
          </GlowCard>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 text-center">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          まずは無料でAIブランディングを体験
        </h2>
        <p className="mt-6 text-lg text-white/60">クレジットカード不要。今すぐ始められます。</p>
        <div className="mt-10">
          <Link
            href="/tools/colors"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-10 text-base font-semibold text-black transition-transform hover:scale-105"
          >
            無料で始める <ArrowRight size={18} />
          </Link>
        </div>
        <p className="mt-6 text-xs text-white/40">
          ※ 業種業態によってはご利用をお断りする場合があります。
        </p>
      </section>
    </main>
  )
}
