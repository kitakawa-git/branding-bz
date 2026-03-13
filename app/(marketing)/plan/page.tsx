import type { Metadata } from 'next'
import Link from 'next/link'
import { Check } from 'lucide-react'
import ComparisonSection from './ComparisonSection'

export const metadata: Metadata = {
  title: '料金プラン | branding.bz',
  description: 'AIブランディングSaaS branding.bz の料金プラン。Free / Brand Card / Brand Standard / Brand Premium の4プランから、あなたのブランドフェーズに最適なプランを選べます。',
}

/* ─── プランデータ ─── */
const PLANS = [
  {
    id: 'free',
    name: 'Free',
    subtitle: '体験する',
    price: null,
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
    price: '4,980',
    priceSuffix: '/月（税別）',
    description: 'スマート名刺で、ブランドを社外に届ける。閲覧解析＋アウタースコアで効果を実感。',
    scale: '5〜30名',
    members: '30名',
    support: 'メール',
    perPerson: '¥166〜996',
    features: [
      'スマート名刺カード発行',
      'ブランドページ閲覧',
      '閲覧解析＋アウタースコア',
      'マイクロフィードバック',
    ],
    ctaLabel: 'まずは名刺から始める',
    ctaHref: '/signup',
    ctaStyle: 'secondary' as const,
    reference: 'NFC名刺カード ¥3,000〜5,000＋月額なし → ブランドページ・解析・スコア付きで月¥4,980',
    isHighlight: false,
  },
  {
    id: 'standard',
    name: 'Brand Standard',
    subtitle: '構築＋発信する',
    price: '19,800',
    priceSuffix: '/月（税別）',
    description: 'AIでブランドを構築し、名刺で届ける。コンサルの1/10以下の投資で、ブランド戦略を自社で策定。',
    scale: '5〜50名',
    members: '50名',
    support: 'メール',
    perPerson: '¥396〜3,960',
    features: [
      'AI生成 無制限',
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
    price: '59,800',
    priceSuffix: '/月（税別）',
    description: '構築から浸透・計測まで全機能。インナーサーベイ×アウタースコアで、ブランド浸透度を定量化。',
    scale: '50〜300名',
    members: '300名',
    support: 'メール＋チャット',
    perPerson: '¥199〜1,196',
    features: [
      'Standard全機能に加えて：',
      'インナーサーベイ＋AI設問',
      '統合ブランドスコア',
      '部署別ヒートマップ',
      'ギャップ分析',
      'KPI・Good Jobタイムライン',
    ],
    ctaLabel: 'フル機能で導入する',
    ctaHref: '/contact',
    ctaStyle: 'primary' as const,
    reference: 'コンサル浸透込み 年間500〜1,000万円 → 年間約72万円で1/10以下',
    isHighlight: false,
  },
]

/* ─── アップセルパスデータ ─── */
const UPSELL_STEPS = [
  {
    name: 'Free',
    subtitle: '体験する',
    trigger: 'PDF・連携ボタンを\n押した瞬間',
  },
  {
    name: 'Card',
    subtitle: '発信する',
    trigger: 'ブランド掲示を\n編集したい',
  },
  {
    name: 'Standard',
    subtitle: '構築する',
    trigger: '社員に浸透させたい\n浸透度を測りたい',
  },
  {
    name: 'Premium',
    subtitle: '浸透＋計測',
    trigger: '全社のブランド力を\n数値で把握したい',
  },
]

/* ─── グラスカード共通スタイル ─── */
const glassCard = {
  background: 'rgba(255, 255, 255, 0.7)',
  backdropFilter: 'blur(12px) saturate(120%)',
  WebkitBackdropFilter: 'blur(12px) saturate(120%)',
  border: '1px solid rgba(255, 255, 255, 0.8)',
  boxShadow: '0px 8px 24px 0 rgba(12, 74, 110, 0.08), inset 0px 0px 4px 2px rgba(255, 255, 255, 0.3)',
} as React.CSSProperties

/* ─── ハイライトカード（Brand Standard）スタイル ─── */
const glassCardHighlight = {
  background: 'rgba(255, 251, 235, 0.88)',
  backdropFilter: 'blur(12px) saturate(120%)',
  WebkitBackdropFilter: 'blur(12px) saturate(120%)',
  border: '1.5px solid rgba(251, 146, 60, 0.45)',
  boxShadow: '0px 12px 32px 0 rgba(251, 146, 60, 0.15), inset 0px 0px 4px 2px rgba(255, 255, 255, 0.3)',
} as React.CSSProperties

import React from 'react'

export default function PlanPage() {
  return (
    <>
      {/* ── セクション A: ヒーロー ── */}
      <section className="px-6 pt-[120px] pb-16 md:pt-[120px] md:pb-24 text-center">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.25em] text-gray-400 uppercase mb-4">
            Pricing
          </p>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-gray-900 leading-snug md:leading-snug">
            あなたのブランドフェーズに<br className="hidden sm:block" />
            最適なプランを
          </h1>
          <p className="mt-6 text-lg md:text-xl text-gray-700 max-w-2xl mx-auto leading-relaxed">
            体験から始めて、ブランドの成長に合わせてステップアップ。<br className="hidden sm:block" />
            すべてのプランに初期費用はかかりません。
          </p>
        </div>
      </section>

      {/* ── セクション B: プランカード ── */}
      <section className="bg-gray-50 px-6 pb-16 md:pb-24">
        <div className="mx-auto max-w-7xl">
          {/* MOST POPULARバッジ分の余白 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-5">
            {PLANS.map((plan) => (
              <div key={plan.id} className="relative flex flex-col">
                {/* MOST POPULAR バッジ（Brand Standard のみ） */}
                {plan.isHighlight && (
                  <div className="absolute -top-4 inset-x-0 flex justify-center z-20 pointer-events-none">
                    <span
                      className="inline-flex items-center px-4 py-1 rounded-full text-xs font-bold tracking-widest text-white uppercase"
                      style={{
                        background: 'linear-gradient(135deg, rgba(251, 146, 60, 0.95) 0%, rgba(239, 68, 68, 0.88) 100%)',
                        boxShadow: '0px 4px 12px rgba(251, 146, 60, 0.4)',
                      }}
                    >
                      人気 No.1
                    </span>
                  </div>
                )}

                {/* カード本体 */}
                <div
                  className="relative rounded-2xl overflow-hidden transition-all hover:scale-[1.02] hover:shadow-2xl flex flex-col flex-1"
                  style={plan.isHighlight ? glassCardHighlight : glassCard}
                >
                  {/* リフレクション */}
                  <div className="absolute inset-0 pointer-events-none rounded-2xl"
                    style={{ background: 'linear-gradient(to left top, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 50%)' }} />
                  <div className="absolute inset-0 pointer-events-none rounded-2xl"
                    style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 100%)' }} />

                  <div className="relative z-10 p-6 flex flex-col flex-1">
                    {/* 1. サブタイトル */}
                    <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-1">
                      {plan.subtitle}
                    </p>

                    {/* 2. プラン名 */}
                    <h3 className="text-xl font-bold text-gray-900 mb-4">
                      {plan.name}
                    </h3>

                    {/* 3. 価格 */}
                    <div className="mb-3">
                      {plan.price ? (
                        <>
                          <span className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight"
                            style={{ letterSpacing: '-1px' }}>
                            ¥{plan.price}
                          </span>
                          <span className="text-sm text-gray-500 ml-1">{plan.priceSuffix}</span>
                        </>
                      ) : (
                        <span className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
                          ¥0
                        </span>
                      )}
                    </div>

                    {/* 4. 説明文（min-height で高さ揃え） */}
                    <p className="text-sm text-gray-600 leading-relaxed mb-4"
                      style={{ minHeight: '5rem' }}>
                      {plan.description}
                    </p>

                    {/* 5. メタ情報グリッド */}
                    <div className="border-t border-b border-gray-100/80 py-3 mb-4">
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">想定規模</p>
                          <p className="text-xs font-semibold text-gray-700">{plan.scale}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">メンバー上限</p>
                          <p className="text-xs font-semibold text-gray-700">{plan.members}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">サポート</p>
                          <p className="text-xs font-semibold text-gray-700">{plan.support}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">1人あたり目安</p>
                          <p className="text-xs font-semibold text-gray-700">{plan.perPerson}</p>
                        </div>
                      </div>
                    </div>

                    {/* 6. 主要機能リスト */}
                    <ul className="space-y-2 mb-4">
                      {plan.features.map((feature, idx) => (
                        <li key={idx}>
                          {feature.endsWith('：') ? (
                            <span className="text-xs font-semibold text-gray-400 tracking-wide">
                              {feature}
                            </span>
                          ) : (
                            <span className="flex items-start gap-2">
                              <Check size={13} className="text-green-500 mt-0.5 shrink-0" strokeWidth={2.5} />
                              <span className="text-sm text-gray-700">{feature}</span>
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>

                    {/* スペーサー：ボタン位置を底部に固定 */}
                    <div className="flex-1" />

                    {/* 7. CTAボタン（rounded-xl、幅いっぱい） */}
                    <Link href={plan.ctaHref}>
                      {plan.ctaStyle === 'primary' ? (
                        <button
                          className="relative w-full h-11 rounded-xl text-sm font-bold text-white overflow-hidden transition-all hover:scale-105 hover:shadow-xl"
                          style={{
                            background: 'rgba(0, 0, 0, 0.8)',
                            backdropFilter: 'blur(12px) saturate(120%)',
                            WebkitBackdropFilter: 'blur(12px) saturate(120%)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            boxShadow: '0px 4px 16px 0 rgba(0, 0, 0, 0.2), inset 0px 1px 0px 0px rgba(255, 255, 255, 0.15)',
                          }}
                        >
                          <span className="relative z-10">{plan.ctaLabel}</span>
                        </button>
                      ) : plan.ctaStyle === 'secondary' ? (
                        <button
                          className="relative w-full h-11 rounded-xl text-sm font-bold text-gray-800 overflow-hidden transition-all hover:scale-105 hover:shadow-lg"
                          style={{
                            background: 'rgba(255, 255, 255, 0.5)',
                            backdropFilter: 'blur(12px) saturate(120%)',
                            WebkitBackdropFilter: 'blur(12px) saturate(120%)',
                            border: '1px solid rgba(255, 255, 255, 0.7)',
                            boxShadow: '0px 4px 12px 0 rgba(12, 74, 110, 0.08), inset 0px 1px 0px 0px rgba(255, 255, 255, 0.5)',
                          }}
                        >
                          <span className="relative z-10">{plan.ctaLabel}</span>
                        </button>
                      ) : (
                        /* outline style（Free） */
                        <button
                          className="relative w-full h-11 rounded-xl text-sm font-semibold text-gray-600 overflow-hidden transition-all hover:bg-gray-100 hover:scale-105"
                          style={{
                            background: 'transparent',
                            border: '1px solid rgba(0, 0, 0, 0.15)',
                          }}
                        >
                          {plan.ctaLabel}
                        </button>
                      )}
                    </Link>

                    {/* 8. 参考テキスト（固定高さ確保でボタン位置を揃える） */}
                    <div className="min-h-[60px] mt-3 flex items-start justify-center">
                      {plan.reference && (
                        <p className="text-center text-xs text-gray-400 leading-relaxed">
                          {plan.reference}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── セクション C: 全機能比較表（クライアントコンポーネント） ── */}
      <ComparisonSection />

      {/* ── セクション D: アップセルパス ── */}
      <section className="bg-white px-6 py-16 md:py-24">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-12 text-center text-xl md:text-[1.625rem] font-bold text-gray-900">
            ブランドの成長に合わせてステップアップ
          </h2>
          <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:gap-24">
            {/* デスクトップ: ステップ間の接続線 */}
            <div className="hidden md:block absolute top-5 h-px bg-gray-900" style={{ left: 'calc((100% - 24rem) / 10)', right: 'calc((100% - 24rem) / 10)' }} />
            {UPSELL_STEPS.map((step, idx) => (
              <div key={step.name} className="flex items-center gap-3 md:flex-1 md:flex-col md:gap-0 md:text-center">
                <div className="relative z-10 flex h-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-900 px-4 text-sm font-bold text-white md:mb-3">
                  {step.subtitle}
                </div>
                <div className="md:mt-0">
                  <h3 className="text-base font-bold text-gray-900">{step.name}</h3>
                  {step.trigger && (
                    <p className="text-sm text-gray-500 whitespace-pre-line">{step.trigger}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── セクション F: CTA ── */}
      <section className="relative overflow-hidden px-6 py-16 md:py-24 text-center">
        {/* トップLPと同じグラデーション背景 */}
        <div
          className="absolute inset-0 z-0"
          style={{
            background: [
              'radial-gradient(ellipse 180% 160% at 5% 20%, rgba(196, 181, 253, 0.8) 0%, transparent 55%)',
              'radial-gradient(ellipse 160% 140% at 85% 10%, rgba(253, 186, 116, 0.7) 0%, transparent 55%)',
              'radial-gradient(ellipse 150% 130% at 50% 90%, rgba(167, 243, 208, 0.65) 0%, transparent 55%)',
              'radial-gradient(ellipse 130% 110% at 95% 65%, rgba(251, 207, 232, 0.6) 0%, transparent 55%)',
              'linear-gradient(135deg, rgba(245, 243, 255, 1) 0%, rgba(255, 251, 245, 1) 50%, rgba(243, 255, 251, 1) 100%)',
            ].join(', '),
          }}
        />

        <div className="relative z-10 mx-auto max-w-4xl">
          <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-gray-900">
            まずは無料でAIブランディングを体験
          </h2>
          <p className="mt-6 text-lg md:text-xl text-gray-700 leading-relaxed">
            クレジットカード不要。今すぐ始められます。
          </p>
          <div className="mt-10">
            <Link href="/tools/colors">
              <button
                className="relative inline-flex items-center justify-center h-12 px-12 rounded-full text-base font-bold text-white overflow-hidden transition-all hover:scale-105 hover:shadow-2xl"
                style={{
                  background: 'rgba(0, 0, 0, 0.75)',
                  backdropFilter: 'blur(12px) saturate(120%)',
                  WebkitBackdropFilter: 'blur(12px) saturate(120%)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  boxShadow: '0px 8px 24px 0 rgba(0, 0, 0, 0.2), inset 0px 1px 0px 0px rgba(255, 255, 255, 0.15)',
                }}
              >
                <span className="relative z-10">無料で始める</span>
              </button>
            </Link>
          </div>
          <p className="mt-6 text-xs text-gray-400">
            ※ 業種業態によってはご利用をお断りする場合があります。
          </p>
        </div>
      </section>
    </>
  )
}
