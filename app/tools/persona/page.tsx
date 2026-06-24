'use client'

// ペルソナビルダー ランディングページ（LPダークデザインに準拠）
import Link from 'next/link'
import { UserCircle, Route, CheckCircle2, Lightbulb, Download, Unplug, Target, ArrowRight, type LucideIcon } from 'lucide-react'
import Nav from '@/components/lp/Nav'
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
  { icon: '2', title: 'ペルソナ生成', description: 'AIがペルソナの属性を提案' },
  { icon: '3', title: '課題・購買行動', description: '目標や悩み、購買行動を深掘り' },
  { icon: '4', title: 'ジャーニー設計', description: 'AIが5段階のカスタマージャーニーを生成' },
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

export default function PersonaLandingPage() {
  return (
    <div data-dark className="min-h-screen bg-[#08080a] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'ペルソナビルダー',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'JPY' },
            description: 'AIがターゲット顧客のペルソナを自動生成。名前・年齢・職業・行動パターン・インサイトまで具体化。',
            provider: { '@type': 'Organization', name: 'branding.bz', url: 'https://branding.bz' },
          }),
        }}
      />
      <Nav />

      {/* ヒーロー＋「ペルソナとは？」を1枚の背景（NEBULA調グラデ）で覆う */}
      <div style={{ background: 'linear-gradient(160deg,#0f172a,#312e81 60%,#a855f7)' }}>
      {/* ヒーロー */}
      <section className="relative overflow-hidden px-6 pt-32 pb-16 text-center md:pt-40">
        <div className="mx-auto max-w-4xl">
          <p className="mb-7 text-sm text-white">AIでブランディングを加速させる。</p>
          <h1 className="text-5xl font-bold leading-[1.05] tracking-[-0.03em] md:text-7xl">
            ペルソナビルダー
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg text-white/60 md:text-xl">
            STP分析で決めた「誰に届けるか」を、リアルな顧客像に。
            <br className="hidden sm:block" />
            名前・年齢・職業・行動パターンまで、AIと一緒に深掘りします。
          </p>
          <div className="mt-10">
            <Link
              href="/portal/auth?from=persona"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-8 text-base font-semibold text-black transition-transform hover:scale-105"
            >
              無料で始める <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ペルソナとは？（上のラッパーの背景を共有） */}
      <section className="px-6 pt-16 pb-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-8 text-center text-3xl font-bold tracking-tight md:text-4xl">
            ペルソナ＆ジャーニーマップとは？
          </h2>
          <div className="grid gap-5 md:grid-cols-3">
            {PERSONA_CARDS.map((card) => (
              <FeatureCard key={card.label} icon={card.icon} label={card.label} title={card.title} description={card.description} />
            ))}
          </div>
        </div>
      </section>
      </div>

      {/* ステップ説明 */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-center text-3xl font-bold tracking-tight md:text-4xl">
            5ステップでペルソナを完成
          </h2>
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
            style={{
              background:
                'radial-gradient(80% 120% at 50% 0%, rgba(37,99,235,0.4) 0%, rgba(8,8,10,0) 60%), #0d0d11',
            }}
          >
            <div className="mb-7 inline-flex flex-wrap items-center justify-center gap-4 text-sm text-white/70">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-blue-400" /> 無料で3回まで利用可能</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-blue-400" /> クレジットカード不要</span>
            </div>
            <h2 className="text-balance text-3xl font-bold tracking-tight md:text-5xl">
              今すぐペルソナを作成する
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg text-white/60">
              ブランドは、作った瞬間から走り出す。branding.bz で、その加速を始めませんか。
            </p>
            <div className="mt-10">
              <Link
                href="/portal/auth?from=persona"
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
