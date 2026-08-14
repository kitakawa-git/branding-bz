'use client'

// ブランドパーソナリティ診断 ランディングページ（LPダークデザインに準拠）
import Link from 'next/link'
import { Fingerprint, Radar, Drama, CheckCircle2, Sparkles, SlidersHorizontal, Download, Unplug, ArrowRight, Plus, type LucideIcon } from 'lucide-react'
import Nav from '@/components/lp/Nav'
import Footer from '@/components/Footer'
import { FREE_TIER_BADGE_LABEL } from '@/lib/tools/free-limits'

const CONCEPT_CARDS = [
  { label: 'パーソナリティとは？', icon: Fingerprint, title: 'ブランドを「人格」に翻訳', description: '「もしブランドが人だったら、どんな性格か」。頭の中にある感覚を10問の質問で引き出し、AIが人格として言語化します。' },
  { label: 'スコアで診断', icon: Radar, title: 'Aaker 5次元スコア型', description: '誠実・刺激・能力・洗練・素朴の5次元をスコア化し、レーダーチャートで表示。分析的にブランドの輪郭を把握できます。' },
  { label: 'タイプで診断', icon: Drama, title: '12アーキタイプ タイプ型', description: '英雄・賢者・探検家など12の元型から主人格と副人格を判定。「うちは賢者×援助者」とひと言で語れるようになります。' },
]

const STEPS = [
  { icon: '1', title: '基本情報入力', description: '業種・事業内容と診断タイプの選択' },
  { icon: '2', title: '診断質問（前半）', description: 'ブランドの言われたい姿・距離感など5問' },
  { icon: '3', title: '診断質問（後半）', description: '自社が大切にする価値観・語り口など5問' },
  { icon: '4', title: 'AI診断', description: 'AIが回答をもとにブランドの人格を生成' },
  { icon: '5', title: '結果・出力', description: '結果を微調整してPDF出力・本体に連携' },
]

const HIGHLIGHTS = [
  { label: 'AI診断', icon: Sparkles, title: ['10問の回答から', 'AIが人格を生成'], description: '選択式中心の10問に答えるだけ。スコアもタイプも1回で同時に算出し、タブで切り替えられます。' },
  { label: '微調整', icon: SlidersHorizontal, title: ['スコアを', '自分の感覚で調整'], description: '診断結果はスライダーで微調整可能。「ここは少し誠実寄り」という肌感覚を反映できます。' },
  { label: '出力', icon: Download, title: ['診断結果を', 'PDFでダウンロード'], description: '人格スコア・タイプカード・トーンオブボイスをまとめたレポートをワンクリックでPDF出力。' },
  { label: '連携', icon: Unplug, title: ['ワンクリックで', 'branding.bz に連携'], description: '確定した人格をブランディングプラットフォームに登録。トーン・期待タグも運用に即反映。' },
]

// 表示と FAQPage schema は同じ配列を参照して完全一致を担保する
const FAQ_ITEMS = [
  {
    q: '無料で使えますか？',
    a: 'はい。無料で月に3回までご利用いただけます。クレジットカード登録は不要です。毎月リセットされます。',
  },
  {
    q: '何を診断できますか？',
    a: '10問の質問から、Aaker 5次元のスコア型と12アーキタイプのタイプ型の2軸で、ブランドの人格を言語化します。',
  },
  {
    q: '診断結果は調整できますか？',
    a: 'スコアはスライダーで微調整でき、結果はPDF出力・branding.bz 連携に対応しています。',
  },
  {
    q: 'どのくらいの時間でできますか？',
    a: '選択式中心の10問に答えるだけで、スコアとタイプを同時に算出します。',
  },
]

/* LP準拠のダークグラスカード */
function GlowCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] ${className}`}
      style={{ boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 24px 60px -20px rgba(0,0,0,0.8)' }}
    >
      {children}
    </div>
  )
}

function FeatureCard({ icon: Icon, label, title, description }: { icon: LucideIcon; label: string; title: React.ReactNode; description: string }) {
  return (
    <GlowCard className="p-7 transition-transform hover:-translate-y-1">
      <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5">
        <Icon size={20} className="text-emerald-400" />
      </div>
      <div className="mb-2 text-sm font-semibold text-emerald-400">{label}</div>
      <h3 className="text-lg font-bold leading-snug text-white">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-white/55">{description}</p>
    </GlowCard>
  )
}

export default function PersonalityLandingPage() {
  return (
    <div className="min-h-screen bg-[#08080a] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'ブランドパーソナリティ診断',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'JPY' },
            description: '10問の質問に答えるだけで、AIがブランドの人格を診断。Aaker 5次元と12アーキタイプの2フレームワークで「らしさ」を言語化。',
            provider: { '@type': 'Organization', name: 'branding.bz', url: 'https://branding.bz' },
          }),
        }}
      />
      {/* FAQPage: 下の可視FAQと同じ FAQ_ITEMS を参照して1文字違わず一致を担保 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQ_ITEMS.map((item) => ({
              '@type': 'Question',
              name: item.q,
              acceptedAnswer: { '@type': 'Answer', text: item.a },
            })),
          }),
        }}
      />
      {/* BreadcrumbList: 画面表示なし、schema のみ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'ホーム', item: 'https://branding.bz/' },
              { '@type': 'ListItem', position: 2, name: 'ブランドパーソナリティ診断', item: 'https://branding.bz/tools/personality' },
            ],
          }),
        }}
      />
      <Nav />

      {/* ヒーロー＋「パーソナリティ診断とは？」を1枚の背景（診断カード色のエメラルド）で覆う */}
      <div className="relative" style={{ background: 'radial-gradient(120% 120% at 25% 20%,#10b981 0%,#0f172a 65%)' }}>
        {/* 視認性のための暗幕（2セクション共通） */}
        <div className="pointer-events-none absolute inset-0 bg-black/30" />

        {/* ヒーロー */}
        <section className="relative overflow-hidden px-6 pt-32 pb-16 text-center md:pt-40">
          <div className="relative mx-auto max-w-5xl">
            <p className="mb-7 text-sm text-white">AIでブランディングを加速させる。</p>
            <h1 className="text-5xl font-bold leading-[1.05] tracking-[-0.03em] md:whitespace-nowrap md:text-7xl">ブランドパーソナリティ診断</h1>
            <p className="mx-auto mt-7 max-w-2xl text-lg text-white/80 md:text-xl">
              あなたのブランドが「人」だったら、どんな性格？
              <br className="hidden sm:block" />
              10問の質問から、AIがブランドの人格を言語化します。
            </p>
            <div className="mt-10">
              <Link
                href="/portal/auth?from=personality"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-8 text-base font-semibold text-black transition-transform hover:scale-105"
              >
                無料で始める <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </section>

        {/* パーソナリティ診断とは？ */}
        <section className="relative px-6 pt-16 pb-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-8 text-center text-3xl font-bold tracking-tight md:text-4xl">パーソナリティ診断ツールとは？</h2>
            <div className="grid gap-5 md:grid-cols-3">
              {CONCEPT_CARDS.map((card) => (
                <FeatureCard key={card.label} icon={card.icon} label={card.label} title={card.title} description={card.description} />
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* ステップ説明 */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-center text-3xl font-bold tracking-tight md:text-4xl">5ステップで人格を診断</h2>
          <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:gap-16">
            <div className="absolute top-5 hidden h-px bg-white/15 md:block" style={{ left: 'calc((100% - 24rem) / 10)', right: 'calc((100% - 24rem) / 10)' }} />
            {STEPS.map((step) => (
              <div key={step.title} className="flex items-center gap-3 md:flex-1 md:flex-col md:gap-0 md:text-center">
                <div className="relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-black md:mb-3">
                  {step.icon}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{step.title}</h3>
                  <p className="text-sm text-white/50">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 機能ハイライト */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {HIGHLIGHTS.map((item) => (
              <FeatureCard
                key={item.label}
                icon={item.icon}
                label={item.label}
                title={<>{item.title[0]}<br />{item.title[1]}</>}
                description={item.description}
              />
            ))}
          </div>
        </div>
      </section>

      {/* よくある質問 */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-center text-3xl font-bold tracking-tight md:text-4xl">よくある質問</h2>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors open:bg-white/[0.05]"
              >
                <summary className="flex cursor-pointer items-start justify-between gap-4 text-base font-semibold text-white [&::-webkit-details-marker]:hidden">
                  <span>{item.q}</span>
                  <Plus size={18} className="mt-0.5 flex-shrink-0 text-white/50 transition-transform group-open:rotate-45" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-white/70">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div
            className="relative overflow-hidden rounded-[2rem] border border-white/10 px-8 py-20 text-center"
            style={{ background: 'radial-gradient(80% 120% at 50% 0%, rgba(16,185,129,0.4) 0%, rgba(8,8,10,0) 60%), #0d0d11' }}
          >
            <div className="mb-7 inline-flex flex-wrap items-center justify-center gap-4 text-sm text-white/70">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-400" /> {FREE_TIER_BADGE_LABEL}</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-400" /> クレジットカード不要</span>
            </div>
            <h2 className="text-balance text-3xl font-bold tracking-tight md:text-5xl">今すぐブランドの人格を診断する</h2>
            <p className="mx-auto mt-6 max-w-xl text-lg text-white/60">
              ブランドは、作った瞬間から走り出す。<br />branding.bz で、その加速を始めませんか。
            </p>
            <div className="mt-10">
              <Link
                href="/portal/auth?from=personality"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-10 text-base font-semibold text-black transition-transform hover:scale-105"
              >
                無料で始める <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
