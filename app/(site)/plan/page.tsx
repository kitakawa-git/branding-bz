import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, ArrowRight } from 'lucide-react'
import { PageHero, GlowCard } from '@/components/lp/ui'

export const metadata: Metadata = {
  title: '料金プラン | branding.bz',
  description:
    'AIブランディングSaaS branding.bz の料金プラン。Free / Brand Card / Brand Standard / Brand Premium の4プランから、あなたのブランドフェーズに最適なプランを選べます。',
  alternates: {
    canonical: '/plan',
  },
  openGraph: {
    title: '料金プラン | branding.bz',
    description:
      'AIブランディングSaaS branding.bz の料金プラン。Free / Brand Card / Brand Standard / Brand Premium の4プランから、あなたのブランドフェーズに最適なプランを選べます。',
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
    description: 'AIブランディングツールを体験。生成結果を画面で確認できます。',
    scale: '個人',
    members: '—',
    support: '—',
    perPerson: '—',
    features: [
      'AIツール体験（月3回）',
      '生成結果の画面確認',
      '名刺ページの公開閲覧',
      'ブランド用語wiki 閲覧',
    ],
    ctaLabel: '無料で始める',
    ctaHref: '/tools/colors',
    ctaStyle: 'outline' as const,
    reference: null,
    isHighlight: false,
  },
  {
    id: 'card',
    name: 'Brand Card',
    subtitle: '発信する',
    price: '¥4,980',
    priceSuffix: '/月（税別）',
    description:
      'スマート名刺で、ブランドを社外に届ける。閲覧解析＋アウタースコアで効果を実感。',
    scale: '5〜30名',
    members: '30名',
    support: 'メール',
    perPerson: '¥166〜996',
    features: [
      'スマート名刺カード発行',
      'ブランドページ閲覧',
      '閲覧解析＋アウタースコア',
      'マイクロフィードバック',
      'PWA対応（ホーム画面に追加）',
    ],
    ctaLabel: 'まずは名刺から始める',
    ctaHref: '/signup',
    ctaStyle: 'secondary' as const,
    reference:
      'デジタル名刺SaaS 1人あたり月300〜800円 → 30名で月9,000〜24,000円。branding.bz は人数無制限（30名まで）で月¥4,980',
    isHighlight: false,
  },
  {
    id: 'standard',
    name: 'Brand Standard',
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
      'AIミニアプリ 4本 使い放題：',
      'ブランドカラー定義 / STP分析',
      'ペルソナビルダー / パーソナリティ診断',
      'PDF出力＋本体連携',
      'ブランド掲示 編集＋閲覧',
      'CIマニュアルPDF',
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
    name: 'Brand Premium',
    subtitle: '構築＋浸透＋発信＋計測する',
    price: '¥59,800',
    priceSuffix: '/月（税別）',
    description:
      '構築から浸透・計測まで全機能。社員が学び、理解し、体現する仕組みと、それを数値で追う計測基盤。',
    scale: '50〜300名',
    members: '300名',
    support: 'メール＋チャット',
    perPerson: '¥199〜1,196',
    features: [
      'Standard全機能に加えて：',
      '― 浸透 ―',
      'ビデオラーニング',
      'ブランド理解度テスト',
      'Good Jobタイムライン',
      'お知らせ配信＋Web Push',
      'KPI・目標管理',
      '― 計測 ―',
      'インナーサーベイ＋AI設問生成',
      '統合ブランドスコア',
      'スコア推移の自動記録',
      '部署別ヒートマップ',
      'ギャップ分析',
    ],
    ctaLabel: 'フル機能で導入する',
    ctaHref: '/contact',
    ctaStyle: 'primary' as const,
    reference: 'コンサル浸透込み 年間500〜1,000万円 → 年間約72万円で1/10以下',
    isHighlight: false,
  },
]

const UPSELL_STEPS = [
  { name: 'Free', subtitle: '体験する', trigger: 'AI提案を\n保存・出力したい' },
  { name: 'Card', subtitle: '発信する', trigger: 'ブランドを\nAIで作りたい' },
  { name: 'Standard', subtitle: '構築する', trigger: '社員に\n浸透させたい' },
  { name: 'Premium', subtitle: '浸透＋計測', trigger: '全社のブランド力を\n数値で把握したい' },
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
                  <span className="text-3xl font-bold tracking-tight md:text-4xl">{plan.price}</span>
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
                      : plan.ctaStyle === 'secondary'
                        ? 'border border-white/15 bg-white/10 text-white'
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
                  <div className="inline-block rounded-lg bg-blue-500/10 px-3 py-1.5">
                    <p className="whitespace-pre-line text-xs leading-relaxed text-white/50">
                      {step.trigger}
                    </p>
                  </div>
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
