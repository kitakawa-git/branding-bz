'use client'

// STP分析ツール ランディングページ（LPダークデザインに準拠）
import Link from 'next/link'
import { LayoutGrid, Target, MapPin, CheckCircle2, Lightbulb, SlidersHorizontal, Download, Unplug, ArrowRight, type LucideIcon } from 'lucide-react'
import Nav from '@/components/lp/Nav'
import Footer from '@/components/Footer'

const STP_CARDS = [
  { label: 'S（Segmentation）', icon: LayoutGrid, title: '市場を細分化する', description: '顧客の特性や行動パターンから、市場を意味のあるグループに分類します。' },
  { label: 'T（Targeting）', icon: Target, title: '狙う市場を決める', description: 'セグメントを評価し、自社が最も価値を提供できるターゲットを選定します。' },
  { label: 'P（Positioning）', icon: MapPin, title: '独自のポジションを築く', description: '競合との差別化ポイントを明確にし、ポジショニングマップで可視化します。' },
]

const STEPS = [
  { icon: '1', title: '基本情報', description: '業種や商品、競合など基本的な情報を入力' },
  { icon: '2', title: 'セグメンテーション', description: 'AIが業種に最適な市場の分け方を提案' },
  { icon: '3', title: 'ターゲティング', description: '各セグメントを評価して狙う市場を決定' },
  { icon: '4', title: 'ポジショニング', description: 'スライダーで自社と競合をマップ上に配置' },
  { icon: '5', title: '確認・出力', description: '分析シートとマップをPDF出力・本体連携' },
]

const HIGHLIGHTS = [
  { label: 'AI提案', icon: Lightbulb, title: ['AI自動', 'セグメント提案'], description: '業種や商品特性をもとに、最適なセグメント変数をAIが自動提案。市場分析を大幅に短縮します。' },
  { label: 'マップ', icon: SlidersHorizontal, title: ['インタラクティブ', 'ポジショニングマップ'], description: 'スライダーで直感的に自社・競合をマップ上に配置。ポジショニングの空白地帯が一目でわかります。' },
  { label: '出力', icon: Download, title: ['PDF・画像を', 'ワンクリック出力'], description: '分析結果をPDFでワンクリックダウンロード。ポジショニングマップも画像で保存できます。' },
  { label: '連携', icon: Unplug, title: ['ワンクリックで', 'branding.bz に連携'], description: '確定したSTP分析をブランディングプラットフォームに登録。ブランド戦略に即反映。' },
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
        <Icon size={20} className="text-blue-400" />
      </div>
      <div className="mb-2 text-sm font-semibold text-blue-400">{label}</div>
      <h3 className="text-lg font-bold leading-snug text-white">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-white/55">{description}</p>
    </GlowCard>
  )
}

export default function STPLandingPage() {
  return (
    <div className="min-h-screen bg-[#08080a] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'STP分析ツール',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'JPY' },
            description: 'AIが最適なセグメンテーション・ターゲティング・ポジショニングを提案。ポジショニングマップの自動作成・PDF出力に対応。',
            provider: { '@type': 'Organization', name: 'branding.bz', url: 'https://branding.bz' },
          }),
        }}
      />
      <Nav />

      {/* ヒーロー＋「STP分析とは？」を1枚の背景（STPカード色の斜めグラデ）で覆う */}
      <div className="relative" style={{ background: 'linear-gradient(135deg,#1d4ed8 0%,#7c3aed 55%,#0ea5e9 100%)' }}>
        {/* 視認性のための暗幕（2セクション共通） */}
        <div className="pointer-events-none absolute inset-0 bg-black/35" />

        {/* ヒーロー */}
        <section className="relative overflow-hidden px-6 pt-32 pb-16 text-center md:pt-40">
          <div className="relative mx-auto max-w-4xl">
            <p className="mb-7 text-sm text-white">AIでブランディングを加速させる。</p>
            <h1 className="text-5xl font-bold leading-[1.05] tracking-[-0.03em] md:text-7xl">STP分析ツール</h1>
            <p className="mx-auto mt-7 max-w-2xl text-lg text-white/80 md:text-xl">
              市場をどう分け、誰を狙い、どう差別化するか。
              <br className="hidden sm:block" />
              AIがあなたのSTP戦略を、分析からマップ作成までサポートします。
            </p>
            <div className="mt-10">
              <Link
                href="/portal/auth?from=stp"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-8 text-base font-semibold text-black transition-transform hover:scale-105"
              >
                無料でSTP分析を始める <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </section>

        {/* STP分析とは？ */}
        <section className="relative px-6 pt-16 pb-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-8 text-center text-3xl font-bold tracking-tight md:text-4xl">STP分析とは？</h2>
            <div className="grid gap-5 md:grid-cols-3">
              {STP_CARDS.map((card) => (
                <FeatureCard key={card.label} icon={card.icon} label={card.label} title={card.title} description={card.description} />
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* ステップ説明 */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-center text-3xl font-bold tracking-tight md:text-4xl">5ステップでSTP分析を完了</h2>
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

      {/* CTA */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div
            className="relative overflow-hidden rounded-[2rem] border border-white/10 px-8 py-20 text-center"
            style={{ background: 'radial-gradient(80% 120% at 50% 0%, rgba(37,99,235,0.4) 0%, rgba(8,8,10,0) 60%), #0d0d11' }}
          >
            <div className="mb-7 inline-flex flex-wrap items-center justify-center gap-4 text-sm text-white/70">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-blue-400" /> 無料で3回まで利用可能</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-blue-400" /> クレジットカード不要</span>
            </div>
            <h2 className="text-balance text-3xl font-bold tracking-tight md:text-5xl">今すぐSTP分析を始める</h2>
            <p className="mx-auto mt-6 max-w-xl text-lg text-white/60">
              ブランドは、作った瞬間から走り出す。branding.bz で、その加速を始めませんか。
            </p>
            <div className="mt-10">
              <Link
                href="/portal/auth?from=stp"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-10 text-base font-semibold text-black transition-transform hover:scale-105"
              >
                無料でSTP分析を始める <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
