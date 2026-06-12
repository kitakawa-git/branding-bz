'use client'

// ペルソナビルダー ランディングページ
import Link from 'next/link'
import { WandSparkles, UserCircle, Route, CheckCircle2, Lightbulb, Download, Unplug, Target } from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

const PERSONA_CARDS = [
  {
    label: 'ペルソナとは？',
    icon: UserCircle,
    title: 'ターゲットを1人に具体化',
    description: 'STP分析で決めた「誰に届けるか」を、名前・年齢・職業・行動パターンまで具体的な1人の人物像に落とし込みます。',
  },
  {
    label: 'なぜ必要？',
    icon: Target,
    title: 'チーム全員の共通認識に',
    description: '「30代女性」では曖昧すぎる。ペルソナがあれば、デザイン・コピー・施策の判断基準が明確になります。',
  },
  {
    label: 'ジャーニーマップ',
    icon: Route,
    title: '顧客体験を可視化',
    description: '認知から購入、リピートまでの5段階を可視化。各タッチポイントでの感情や課題が一目でわかります。',
  },
]

const STEPS = [
  { icon: '1', title: '基本情報入力', description: '企業情報とターゲットの選択' },
  { icon: '2', title: 'デモグラフィック', description: 'AIがペルソナの属性を提案' },
  { icon: '3', title: 'ゴール・課題', description: '目標や悩み、購買行動を深掘り' },
  { icon: '4', title: 'ジャーニーマップ', description: 'AIが5段階のカスタマージャーニーを生成' },
  { icon: '5', title: '確認・出力', description: 'ペルソナシートとジャーニーマップをPDF出力' },
]

const HIGHLIGHTS = [
  {
    label: 'AI提案',
    icon: Lightbulb,
    title: ['AIが属性を', '自動提案'],
    description: 'ターゲット情報をもとに、年齢・職業・趣味・行動パターンまでAIが具体的なペルソナ像を提案します。',
  },
  {
    label: 'ジャーニー',
    icon: Route,
    title: ['カスタマージャーニー', 'マップを自動生成'],
    description: '認知→興味→検討→購入→継続の5段階で、顧客の行動・感情・タッチポイントを可視化します。',
  },
  {
    label: '出力',
    icon: Download,
    title: ['PDF・画像を', 'ワンクリック出力'],
    description: 'ペルソナシートとジャーニーマップをPDFでワンクリックダウンロード。社内共有にそのまま使えます。',
  },
  {
    label: '連携',
    icon: Unplug,
    title: ['ワンクリックで', 'branding.bz に連携'],
    description: '確定したペルソナをブランディングプラットフォームに登録。ブランド戦略に即反映。',
  },
]

export default function PersonaLandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'ペルソナビルダー',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'JPY',
            },
            description: 'AIがターゲット顧客のペルソナを自動生成。名前・年齢・職業・行動パターン・インサイトまで具体化。',
            provider: {
              '@type': 'Organization',
              name: 'branding.bz',
              url: 'https://branding.bz',
            },
            publisher: {
              '@type': 'Organization',
              '@id': 'https://include.bz/#organization',
              name: 'ID INC.',
              url: 'https://include.bz',
            },
            audience: {
              '@type': 'BusinessAudience',
              audienceType: '中小企業・スタートアップの経営者・マーケ担当者',
            },
          }),
        }}
      />
      <Header />

      {/* ヒーロー */}
      <section className="mx-auto max-w-7xl px-6 pt-24 pb-8 text-center md:pt-32 md:pb-12">
        <div
          className="mb-8 inline-flex items-center gap-2 rounded-full px-6 py-1.5 text-sm text-ds-app-accent-hover relative overflow-hidden"
          style={{
            background: 'rgba(0, 97, 255, 0.1)',
            backdropFilter: 'blur(12px) saturate(120%)',
            WebkitBackdropFilter: 'blur(12px) saturate(120%)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0px 8px 24px 0 rgba(12, 74, 110, 0.15), inset 0px 0px 4px 2px rgba(255, 255, 255, 0.2)',
          }}
        >
          <div className="absolute inset-0 pointer-events-none rounded-full"
            style={{ background: 'linear-gradient(to left top, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 50%)' }} />
          <WandSparkles className="h-4 w-4 relative z-10" />
          <span className="relative z-10">AIガイドで約10〜15分</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 md:text-5xl">
          ペルソナビルダー
        </h1>
        <p className="mt-6 mx-auto max-w-2xl text-[20px] text-gray-600 leading-relaxed">
          STP分析で決めた「誰に届けるか」を、リアルな顧客像に。<br className="hidden sm:block" />
          名前・年齢・職業・行動パターンまで、AIと一緒に深掘りします。
        </p>
        <div className="mt-10">
          <Link
            href="/portal/auth?from=persona"
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
          </Link>
        </div>
      </section>

      {/* ペルソナとは？ */}
      <section className="bg-gray-50 px-6 py-12 md:py-16">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-xl md:text-[1.625rem] font-bold text-gray-900 mb-8">
            ペルソナ＆ジャーニーマップとは？
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {PERSONA_CARDS.map((card) => (
              <div
                key={card.label}
                className="relative rounded-2xl overflow-hidden transition-all hover:scale-[1.02] hover:shadow-2xl"
                style={{
                  background: 'rgba(255, 255, 255, 0.7)',
                  backdropFilter: 'blur(12px) saturate(120%)',
                  WebkitBackdropFilter: 'blur(12px) saturate(120%)',
                  border: '1px solid rgba(255, 255, 255, 0.8)',
                  boxShadow: '0px 8px 24px 0 rgba(12, 74, 110, 0.12), inset 0px 0px 4px 2px rgba(255, 255, 255, 0.15)',
                }}
              >
                <div
                  className="absolute inset-0 pointer-events-none rounded-2xl"
                  style={{ background: 'linear-gradient(to left top, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 50%)' }}
                />
                <div
                  className="absolute inset-0 pointer-events-none rounded-2xl"
                  style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 100%)' }}
                />
                <div className="relative z-10 p-8">
                  <div className="mb-5">
                    <span className="text-sm font-semibold tracking-wide text-gray-700">
                      {card.label}
                    </span>
                  </div>
                  <div className="mb-4">
                    <card.icon size={32} strokeWidth={1.5} className="text-foreground" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3">
                    {card.title}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{card.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ステップ説明 */}
      <section className="bg-white px-6 py-16 md:py-24">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-12 text-center text-xl md:text-[1.625rem] font-bold text-gray-900">
            5ステップでペルソナを完成
          </h2>
          <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:gap-24">
            <div className="hidden md:block absolute top-5 h-px bg-gray-900" style={{ left: 'calc((100% - 24rem) / 10)', right: 'calc((100% - 24rem) / 10)' }} />
            {STEPS.map((step) => (
              <div key={step.title} className="flex items-center gap-3 md:flex-1 md:flex-col md:gap-0 md:text-center">
                <div className="relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-900 text-sm font-bold text-white md:mb-3">
                  {step.icon}
                </div>
                <div className="md:mt-0">
                  <h3 className="text-base font-bold text-gray-900">{step.title}</h3>
                  <p className="text-sm text-gray-500">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 機能ハイライト */}
      <section className="bg-gray-50 px-6 py-16 md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {HIGHLIGHTS.map((item) => (
              <div
                key={item.label}
                className="relative rounded-2xl overflow-hidden transition-all hover:scale-[1.02] hover:shadow-2xl"
                style={{
                  background: 'rgba(255, 255, 255, 0.7)',
                  backdropFilter: 'blur(12px) saturate(120%)',
                  WebkitBackdropFilter: 'blur(12px) saturate(120%)',
                  border: '1px solid rgba(255, 255, 255, 0.8)',
                  boxShadow: '0px 8px 24px 0 rgba(12, 74, 110, 0.08), inset 0px 0px 4px 2px rgba(255, 255, 255, 0.3)',
                }}
              >
                <div
                  className="absolute inset-0 pointer-events-none rounded-2xl"
                  style={{ background: 'linear-gradient(to left top, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 50%)' }}
                />
                <div
                  className="absolute inset-0 pointer-events-none rounded-2xl"
                  style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 100%)' }}
                />
                <div className="relative z-10 p-8">
                  <div className="mb-5">
                    <span className="text-sm font-semibold tracking-wide text-gray-700">
                      {item.label}
                    </span>
                  </div>
                  <div className="mb-4">
                    <item.icon size={32} strokeWidth={1.5} className="text-foreground" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3">
                    {item.title[0]}<br />{item.title[1]}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden px-6 py-16 md:py-24 text-center">
        <div className="absolute inset-0 z-0" style={{
          background: [
            'radial-gradient(ellipse 180% 160% at 5% 20%, rgba(196, 181, 253, 0.8) 0%, transparent 55%)',
            'radial-gradient(ellipse 160% 140% at 85% 10%, rgba(253, 186, 116, 0.7) 0%, transparent 55%)',
            'radial-gradient(ellipse 150% 130% at 50% 90%, rgba(167, 243, 208, 0.65) 0%, transparent 55%)',
            'radial-gradient(ellipse 130% 110% at 95% 65%, rgba(251, 207, 232, 0.6) 0%, transparent 55%)',
            'linear-gradient(135deg, rgba(245, 243, 255, 1) 0%, rgba(255, 251, 245, 1) 50%, rgba(243, 255, 251, 1) 100%)',
          ].join(', '),
        }} />
        <div className="relative z-10 w-full max-w-4xl mx-auto">
          <div
            className="mb-8 inline-flex items-center gap-2 rounded-full px-6 py-1.5 text-sm text-ds-app-accent-hover relative overflow-hidden"
            style={{
              background: 'rgba(0, 97, 255, 0.1)',
              backdropFilter: 'blur(12px) saturate(120%)',
              WebkitBackdropFilter: 'blur(12px) saturate(120%)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0px 8px 24px 0 rgba(12, 74, 110, 0.15), inset 0px 0px 4px 2px rgba(255, 255, 255, 0.2)',
            }}
          >
            <div className="absolute inset-0 pointer-events-none rounded-full"
              style={{ background: 'linear-gradient(to left top, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 50%)' }} />
            <span className="relative z-10 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              無料で3回まで利用可能
            </span>
            <span className="relative z-10 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              クレジットカード不要
            </span>
          </div>
          <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-gray-900">
            今すぐペルソナを作成する
          </h2>
          <p className="mt-6 text-lg md:text-xl text-gray-700 max-w-2xl mx-auto leading-relaxed">
            ブランドは、作った瞬間から走り出す。<br />branding.bz で、その加速を始めませんか。
          </p>
          <div className="mt-10">
            <Link
              href="/portal/auth?from=persona"
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
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
