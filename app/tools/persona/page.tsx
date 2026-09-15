'use client'

// ペルソナビルダー ランディングページ（LPダークデザインに準拠）
import Link from 'next/link'
import { sendGAEvent } from '@next/third-parties/google'
import { UserCircle, Route, CheckCircle2, Lightbulb, Download, Unplug, Target, ArrowRight, Plus, type LucideIcon } from 'lucide-react'
import Nav from '@/components/lp/Nav'
import Footer from '@/components/Footer'
import { FREE_TIER_BADGE_LABEL, FREE_TIER_REVIEW_NOTE, FREE_TIER_REVIEW_BADGE } from '@/lib/tools/free-limits'
import DocumentFloatingCta from '@/components/lp/DocumentFloatingCta'

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
    description: '「30代女性」では曖昧すぎる。ペルソナがあれば、デザイン・コピー・施策の判断基準が誰の目にも明確になります。',
  },
  {
    label: 'ジャーニーマップ',
    icon: Route,
    title: '顧客体験を可視化',
    description: '認知から購入、継続までの5段階を可視化。各タッチポイントでの感情や課題がひと目ではっきりわかります。',
  },
]

const STEPS = [
  { icon: '1', title: '基本情報入力', description: '企業の基本情報と狙うべきターゲットの選択' },
  { icon: '2', title: 'ペルソナ生成', description: 'AIがペルソナの属性や行動・人物像を提案' },
  { icon: '3', title: '課題・購買行動', description: '顧客の目標や悩み、購買行動の傾向を深掘り' },
  { icon: '4', title: 'ジャーニー設計', description: 'AIが5段階のカスタマージャーニーを生成' },
  { icon: '5', title: '確認・出力', description: 'ペルソナの確定と、PDF出力・ブランド情報への反映' },
]

const HIGHLIGHTS = [
  {
    label: 'AI提案',
    icon: Lightbulb,
    title: ['AIが属性を', '自動提案'],
    description: 'ターゲット情報をもとに、年齢・職業・趣味・行動パターンまでAIがペルソナを提案します。提案される人物像は、検討の出発点となる仮説です。',
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
    title: ['PDFで', 'ワンクリック出力'],
    description: 'ペルソナシートとジャーニーマップをPDFでワンクリック出力。社内共有にすぐに使えます（PDF出力とブランド情報への反映は Standard 以上）。',
  },
  {
    label: '反映',
    icon: Unplug,
    title: ['ワンクリックで', 'ブランド情報に反映'],
    description: '確定したペルソナを、branding.bz のブランド情報（ブランド戦略）に反映できます（Standard 以上）。',
  },
]

// 表示と FAQPage schema は同じ配列を参照して完全一致を担保する
const FAQ_ITEMS = [
  {
    q: '無料で使えますか？',
    a: 'はい。無料登録で、各ツールを月3回までご利用いただけます（毎月リセット）。クレジットカード登録は不要です。PDF出力と branding.bz のブランド情報への反映は Standard 以上のプランで利用できます。',
  },
  {
    q: 'どんなペルソナが作れますか？',
    a: '属性だけでなく、価値観・課題・購買行動、5段階のカスタマージャーニー（認知→興味→検討→購入→継続）までAIが提案します。',
  },
  {
    q: 'どんな業種でも使えますか？',
    a: 'はい。業種や事業内容を入力すると、AIがそれに合ったペルソナを生成します。',
  },
  {
    q: '作ったペルソナは出力できますか？',
    a: 'ペルソナシートとカスタマージャーニーマップの両方をPDF出力できます。確定したペルソナは branding.bz のブランド情報にも反映できます（いずれも Standard 以上）。',
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
              { '@type': 'ListItem', position: 2, name: 'ペルソナビルダー', item: 'https://branding.bz/tools/persona' },
            ],
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
            ペルソナビルダーツール
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg text-white/60 md:text-xl">
            届けたい相手を、チームで共有できる具体的な人物像に。
            <br className="hidden sm:block" />
            名前・年齢・職業・行動パターンまで、AIと一緒に深掘りします。
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup?from=persona"
              onClick={() => sendGAEvent('event', 'tool_cta_click', { tool: 'persona', position: 'hero', destination: 'signup' })}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-8 text-base font-semibold text-black transition-transform hover:scale-105"
            >
              無料で始める <ArrowRight size={18} />
            </Link>
            <Link
              href="/document?from=tool_persona"
              onClick={() => sendGAEvent('event', 'tool_doc_click', { tool: 'persona', position: 'hero' })}
              className="inline-flex h-12 items-center rounded-full border border-white/25 px-8 text-base font-semibold text-white transition-colors hover:bg-white/10"
            >
              サービス資料を見る
            </Link>
          </div>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-white/60">{FREE_TIER_REVIEW_NOTE}</p>
          <p className="mt-3 text-sm text-white/50">
            すでにアカウントをお持ちの方は{' '}
            <Link
              href="/portal/auth?from=persona"
              onClick={() => sendGAEvent('event', 'tool_login_click', { tool: 'persona', position: 'hero' })}
              className="font-semibold text-white underline underline-offset-4 hover:text-white/80"
            >
              ログイン
            </Link>
          </p>
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
            style={{
              background:
                'radial-gradient(80% 120% at 50% 0%, rgba(37,99,235,0.4) 0%, rgba(8,8,10,0) 60%), #0d0d11',
            }}
          >
            <div className="mb-7 inline-flex flex-wrap items-center justify-center gap-4 text-sm text-white/70">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-blue-400" /> {FREE_TIER_BADGE_LABEL}</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-blue-400" /> クレジットカード不要</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-blue-400" /> {FREE_TIER_REVIEW_BADGE}</span>
              <span className="basis-full text-xs text-white/50">PDF出力と branding.bz のブランド情報への反映は Standard 以上のプランで利用できます。</span>
            </div>
            <h2 className="text-balance text-3xl font-bold tracking-tight md:text-5xl">
              今すぐペルソナを作成する
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg text-white/60">
              ブランドは、つくった瞬間から走り出す。<br />branding.bz で、その加速を始めませんか。
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup?from=persona"
                onClick={() => sendGAEvent('event', 'tool_cta_click', { tool: 'persona', position: 'footer', destination: 'signup' })}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-10 text-base font-semibold text-black transition-transform hover:scale-105"
              >
                無料で始める <ArrowRight size={18} />
              </Link>
              <Link
                href="/document?from=tool_persona"
                onClick={() => sendGAEvent('event', 'tool_doc_click', { tool: 'persona', position: 'footer' })}
                className="inline-flex h-12 items-center rounded-full border border-white/25 px-10 text-base font-semibold text-white transition-colors hover:bg-white/10"
              >
                サービス資料を見る
              </Link>
            </div>
            <p className="mt-4 text-sm text-white/50">
              すでにアカウントをお持ちの方は{' '}
              <Link
                href="/portal/auth?from=persona"
                onClick={() => sendGAEvent('event', 'tool_login_click', { tool: 'persona', position: 'footer' })}
                className="font-semibold text-white underline underline-offset-4 hover:text-white/80"
              >
                ログイン
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* 資料請求の常駐バナー（ツール本体には出さないため、app/tools/layout.tsx ではなくLPにだけ置く） */}
      <DocumentFloatingCta />
      <Footer />
    </div>
  )
}
