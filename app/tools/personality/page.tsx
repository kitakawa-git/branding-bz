'use client'

// ブランドパーソナリティ診断 ランディングページ
import Link from 'next/link'
import { WandSparkles, Fingerprint, Radar, Drama, CheckCircle2, Sparkles, SlidersHorizontal, Download, Unplug } from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

const CONCEPT_CARDS = [
  {
    label: 'パーソナリティとは？',
    icon: Fingerprint,
    title: 'ブランドを「人格」に翻訳',
    description: '「もしブランドが人だったら、どんな性格か」。頭の中にある感覚を10問の質問で引き出し、AIが人格として言語化します。',
  },
  {
    label: 'スコアで診断',
    icon: Radar,
    title: 'Aaker 5次元スコア型',
    description: '誠実・刺激・能力・洗練・素朴の5次元をスコア化し、レーダーチャートで表示。分析的にブランドの輪郭を把握できます。',
  },
  {
    label: 'タイプで診断',
    icon: Drama,
    title: '12アーキタイプ タイプ型',
    description: '英雄・賢者・探検家など12の元型から主人格と副人格を判定。「うちは賢者×援助者」とひと言で語れるようになります。',
  },
]

const STEPS = [
  { icon: '1', title: '基本情報入力', description: '業種・事業内容と診断タイプの選択' },
  { icon: '2', title: '診断質問（前半）', description: '言われたい姿・距離感など5問' },
  { icon: '3', title: '診断質問（後半）', description: '価値観・語り口など5問' },
  { icon: '4', title: 'AI診断', description: 'AIがブランドの人格を生成' },
  { icon: '5', title: '結果・出力', description: '微調整してPDF出力・本体連携' },
]

const HIGHLIGHTS = [
  {
    label: 'AI診断',
    icon: Sparkles,
    title: ['10問の回答から', 'AIが人格を生成'],
    description: '選択式中心の10問に答えるだけ。スコアもタイプも1回の診断で同時に算出し、タブで切り替えて見られます。',
  },
  {
    label: '微調整',
    icon: SlidersHorizontal,
    title: ['スコアを', '自分の感覚で調整'],
    description: 'AIの診断結果はスライダーで微調整可能。「ここはもう少し誠実寄り」という肌感覚を反映できます。',
  },
  {
    label: '出力',
    icon: Download,
    title: ['診断結果を', 'PDFでダウンロード'],
    description: '人格スコア・タイプカード・トーンオブボイスをまとめたレポートをワンクリックでPDF出力。',
  },
  {
    label: '連携',
    icon: Unplug,
    title: ['ワンクリックで', 'branding.bz に連携'],
    description: '確定した人格をブランディングプラットフォームに登録。トーン・期待タグまでブランド運用に即反映。',
  },
]

export default function PersonalityLandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'ブランドパーソナリティ診断',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'JPY',
            },
            description: '10問の質問に答えるだけで、AIがブランドの人格を診断。Aaker 5次元と12アーキタイプの2フレームワークで「らしさ」を言語化。',
            provider: {
              '@type': 'Organization',
              name: 'branding.bz',
              url: 'https://branding.bz',
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
          <span className="relative z-10">10問・約5〜10分で診断</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 md:text-5xl">
          ブランドパーソナリティ診断
        </h1>
        <p className="mt-6 mx-auto max-w-2xl text-[20px] text-gray-600 leading-relaxed">
          あなたのブランドが「人」だったら、どんな性格？<br className="hidden sm:block" />
          10問の質問から、AIがブランドの人格を言語化します。
        </p>
        <div className="mt-10">
          <Link
            href="/portal/auth?from=personality"
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

      {/* パーソナリティ診断とは？ */}
      <section className="bg-gray-50 px-6 py-12 md:py-16">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-xl md:text-[1.625rem] font-bold text-gray-900 mb-8">
            ブランドパーソナリティ診断とは？
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {CONCEPT_CARDS.map((card) => (
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
            5ステップで人格を言語化
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
            今すぐブランドの人格を診断する
          </h2>
          <p className="mt-6 text-lg md:text-xl text-gray-700 max-w-2xl mx-auto leading-relaxed">
            ブランドは、作った瞬間から走り出す。<br />branding.bz で、その加速を始めませんか。
          </p>
          <div className="mt-10">
            <Link
              href="/portal/auth?from=personality"
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
