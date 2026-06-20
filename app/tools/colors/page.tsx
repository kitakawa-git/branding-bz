'use client'

// ブランドカラー定義 ランディングページ（LPダークデザインに準拠）
import Link from 'next/link'
import { Palette, WandSparkles, Download, CheckCircle2, Plug, ArrowRight, type LucideIcon } from 'lucide-react'
import Nav from '../../lp/_components/Nav'
import Footer from '@/components/Footer'

const EXAMPLE_PALETTES = [
  {
    name: '信頼のディープブルー',
    concept: '堅実さと先進性を両立するIT企業向けパレット',
    colors: [
      { hex: '#1A56DB', label: 'Primary', flex: 3 },
      { hex: '#3B82F6', label: 'Secondary', flex: 2 },
      { hex: '#F59E0B', label: 'Accent', flex: 1.5 },
      { hex: '#F8FAFC', label: 'Light', flex: 1 },
      { hex: '#1E293B', label: 'Dark', flex: 1 },
    ],
  },
  {
    name: '自然のハーモニー',
    concept: 'オーガニックブランドの安心感と活力を表現',
    colors: [
      { hex: '#059669', label: 'Primary', flex: 3 },
      { hex: '#34D399', label: 'Secondary', flex: 2 },
      { hex: '#F97316', label: 'Accent', flex: 1.5 },
      { hex: '#FFFBEB', label: 'Light', flex: 1 },
      { hex: '#1F2937', label: 'Dark', flex: 1 },
    ],
  },
  {
    name: '洗練のモノトーン',
    concept: 'ファッション・クリエイティブ向けの都会的配色',
    colors: [
      { hex: '#18181B', label: 'Primary', flex: 3 },
      { hex: '#71717A', label: 'Secondary', flex: 2 },
      { hex: '#E11D48', label: 'Accent', flex: 1.5 },
      { hex: '#FAFAFA', label: 'Light', flex: 1 },
      { hex: '#27272A', label: 'Dark', flex: 1 },
    ],
  },
  {
    name: '情熱のレッド',
    concept: '飲食・エンタメ業界の活気とエネルギーを表現',
    colors: [
      { hex: '#DC2626', label: 'Primary', flex: 3 },
      { hex: '#F87171', label: 'Secondary', flex: 2 },
      { hex: '#FBBF24', label: 'Accent', flex: 1.5 },
      { hex: '#FFF7ED', label: 'Light', flex: 1 },
      { hex: '#1C1917', label: 'Dark', flex: 1 },
    ],
  },
  {
    name: '癒しのパステル',
    concept: '美容・ヘルスケア向けのやさしく上品な配色',
    colors: [
      { hex: '#F9A8D4', label: 'Primary', flex: 3 },
      { hex: '#C4B5FD', label: 'Secondary', flex: 2 },
      { hex: '#6EE7B7', label: 'Accent', flex: 1.5 },
      { hex: '#FFF1F2', label: 'Light', flex: 1 },
      { hex: '#374151', label: 'Dark', flex: 1 },
    ],
  },
  {
    name: 'テクノロジーパープル',
    concept: 'AI・テック企業の革新性と未来感を演出',
    colors: [
      { hex: '#7C3AED', label: 'Primary', flex: 3 },
      { hex: '#A78BFA', label: 'Secondary', flex: 2 },
      { hex: '#06B6D4', label: 'Accent', flex: 1.5 },
      { hex: '#F5F3FF', label: 'Light', flex: 1 },
      { hex: '#1E1B4B', label: 'Dark', flex: 1 },
    ],
  },
]

const STEPS = [
  { icon: '1', title: '基本情報', description: 'ブランド名や業種・ターゲットを入力' },
  { icon: '2', title: 'イメージ選択', description: 'キーワードやムードボードで方向性を設定' },
  { icon: '3', title: 'AI提案', description: 'AIが3パターンのカラーパレットを提案' },
  { icon: '4', title: '調整・磨き込み', description: 'AIチャットで色味やトーンを細かく調整' },
  { icon: '5', title: '確定・出力', description: 'カードのPDF出力やbranding.bzへの連携' },
]

const HIGHLIGHTS = [
  { label: 'アクセシビリティ', icon: Palette, title: ['WCAG準拠の', '配色チェック'], description: 'アクセシビリティ基準を自動で検証し、誰にでも見やすい配色を提案します。' },
  { label: '対話型調整', icon: WandSparkles, title: ['AIチャットで', '自由に調整'], description: '「もう少し温かみがほしい」など、自然な言葉でカラーを何度でも調整できます。' },
  { label: '出力', icon: Download, title: ['PDF・CSSを', 'ワンクリック出力'], description: 'パレットカードPDFやCSSカスタムプロパティをワンクリックでダウンロードできます。' },
  { label: '連携', icon: Plug, title: ['ワンクリックで', 'branding.bz に連携'], description: '確定したカラーをブランディングプラットフォームに登録。社内ガイドラインや名刺に即反映。' },
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

export default function ColorsLandingPage() {
  return (
    <div className="min-h-screen bg-[#08080a] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'ブランドカラー定義ツール',
            applicationCategory: 'DesignApplication',
            operatingSystem: 'Web',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'JPY' },
            description: 'AIがブランドのパーソナリティや業種に合わせてプロ品質のカラーパレットを提案。WCAG準拠チェック、PDF・CSS出力に対応。',
            provider: { '@type': 'Organization', name: 'branding.bz', url: 'https://branding.bz' },
          }),
        }}
      />
      <Nav />

      {/* ヒーロー＋パレット例を1枚の背景（虹色コニックグラデ）で覆う */}
      <div className="relative" style={{ background: 'conic-gradient(from 200deg at 60% 40%,#f43f5e,#8b5cf6,#22d3ee,#f43f5e)' }}>
        {/* 視認性のための暗幕（2セクション共通） */}
        <div className="pointer-events-none absolute inset-0 bg-black/35" />
      {/* ヒーロー */}
      <section className="relative overflow-hidden px-6 pt-32 pb-16 text-center md:pt-40">
        <div className="relative mx-auto max-w-4xl">
          <p className="mb-7 text-sm text-white">AIガイドで約5〜10分</p>
          <h1 className="text-5xl font-bold leading-[1.05] tracking-[-0.03em] md:text-7xl">
            ブランドカラー定義ツール
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg text-white/80 md:text-xl">
            ブランドのパーソナリティや業種に合わせて、
            <br className="hidden sm:block" />
            AIがプロ品質のカラーパレットを提案。
          </p>
          <div className="mt-10">
            <Link
              href="/portal/auth?from=colors"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-8 text-base font-semibold text-black transition-transform hover:scale-105"
            >
              無料でカラーを作る <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* カラーパレット例（マーキー）— 上のラッパー背景を共有
          カード下の実質ギャップ＝マーキー下64px＋セクション下16px＝80px（他ツールと同じ） */}
      <section className="relative pt-16 pb-4">
        {/* マーキー側に上パディング24px（シャドウ確保）があるため、見出し下は8pxにして
            見出し→カードの実質ギャップを他ツールと同じ32pxに揃える */}
        <h2 className="mb-2 text-center text-3xl font-bold tracking-tight md:text-4xl">
          こんなカラーパレットが作れます
        </h2>
        <style>{`
          @keyframes marquee-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        `}</style>
        <div className="overflow-hidden">
          <div
            className="flex gap-6 px-6 pt-6 pb-16 hover:[animation-play-state:paused]"
            style={{ animation: 'marquee-scroll 30s linear infinite', willChange: 'transform', width: 'max-content' }}
          >
            {[...EXAMPLE_PALETTES, ...EXAMPLE_PALETTES].map((palette, idx) => (
              <GlowCard key={`${palette.name}-${idx}`} className="w-[350px] flex-shrink-0">
                <div className="flex h-20">
                  {palette.colors.map((color, i) => (
                    <div key={i} style={{ backgroundColor: color.hex, flex: color.flex }} />
                  ))}
                </div>
                <div className="p-4">
                  <p className="text-base font-bold text-white">{palette.name}</p>
                  <p className="mt-0.5 text-sm text-white/55">{palette.concept}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {palette.colors.map((color, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <div className="h-4 w-4 rounded border border-white/15" style={{ backgroundColor: color.hex }} />
                        <span className="font-mono text-[10px] text-white/40">{color.hex}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </GlowCard>
            ))}
          </div>
        </div>
      </section>
      </div>

      {/* ステップ説明 */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-center text-3xl font-bold tracking-tight md:text-4xl">
            5ステップでカラーを確定
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
            style={{ background: 'radial-gradient(80% 120% at 50% 0%, rgba(236,72,153,0.4) 0%, rgba(8,8,10,0) 60%), #0d0d11' }}
          >
            <div className="mb-7 inline-flex flex-wrap items-center justify-center gap-4 text-sm text-white/70">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-blue-400" /> アカウント登録は30秒</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-blue-400" /> クレジットカード不要</span>
            </div>
            <h2 className="text-balance text-3xl font-bold tracking-tight md:text-5xl">今すぐカラーパレットを作成</h2>
            <p className="mx-auto mt-6 max-w-xl text-lg text-white/60">
              ブランドは、作った瞬間から走り出す。branding.bz で、その加速を始めませんか。
            </p>
            <div className="mt-10">
              <Link
                href="/portal/auth?from=colors"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-10 text-base font-semibold text-black transition-transform hover:scale-105"
              >
                無料でカラーを作る <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
