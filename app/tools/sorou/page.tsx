'use client'

// 日程調整ツール ランディングページ（LPダークデザインに準拠）
import Link from 'next/link'
import { sendGAEvent } from '@next/third-parties/google'
import { CalendarDays, Link2, BarChart3, CheckCircle2, CalendarRange, UserCheck, Trophy, PencilLine, ArrowRight, Plus, type LucideIcon } from 'lucide-react'
import Nav from '@/components/lp/Nav'
import Footer from '@/components/Footer'
import { FREE_TIER_BADGE_LABEL, FREE_TIER_REVIEW_NOTE, FREE_TIER_REVIEW_BADGE } from '@/lib/tools/free-limits'
import DocumentFloatingCta from '@/components/lp/DocumentFloatingCta'
import { ctaClass } from '@/components/lp/cta'
import { headingClass } from '@/components/lp/heading'
import JaWrap from '@/components/lp/JaWrap'
import { ToolJsonLd } from '@/components/seo/ToolJsonLd'

const CONCEPT_CARDS = [
  { label: '日程調整ツールとは？', icon: CalendarDays, title: '候補日を選んでリンクを送るだけ', description: '打ち合わせ・研修・ワークショップの日程を、カレンダーで選んだ候補から決めます。メールでの往復はもう要りません。' },
  { label: 'ログイン不要で回答', icon: Link2, title: '回答する人は登録なし', description: '共有リンクを開いて、名前と ○△× を入れるだけ。社外の人やお客様にもそのまま送れます。' },
  { label: '集計が見える', icon: BarChart3, title: '最有力の日程がひと目で', description: '候補ごとに参加できる人数を集計し、いちばん集まりやすい日程に「最有力」を付けます。' },
]

const STEPS = [
  { icon: '1', title: '候補日を選ぶ', description: 'カレンダーで日付を選び、時間を決める（1日に複数の時間も可）' },
  { icon: '2', title: 'リンクを共有', description: 'できた共有リンクをメールやチャットで送る' },
  { icon: '3', title: '回答を集める', description: '回答する人はログイン不要。○△×とコメントを入れるだけ' },
  { icon: '4', title: '日程を決める', description: '集計と回答表を見て、最有力の日程に決める' },
]

const HIGHLIGHTS = [
  { label: 'まとめて選ぶ', icon: CalendarRange, title: ['毎週の曜日も', 'ワンクリックで'], description: '「毎週火曜」を一度に追加したり、既定の時刻を全候補にそろえたり。候補づくりの手間を減らします。' },
  { label: '回答', icon: UserCheck, title: ['回答する人は', 'ログイン不要'], description: '名前と ○（可）△（未定）×（不可）を選ぶだけ。自分の回答は、回答した端末から後で直せます。' },
  { label: '集計', icon: Trophy, title: ['最有力の日程を', '自動で表示'], description: '参加できる人数の多い順に並べ替えも可能。回答表で、誰がどの日に来られるかも一覧できます。' },
  { label: '編集', icon: PencilLine, title: ['日程や時間を', '後から直せる'], description: '時刻の間違いも後から修正。変えていない候補への回答はそのまま残ります。' },
]

// 表示と FAQPage schema は同じ配列を参照して完全一致を担保する
const FAQ_ITEMS = [
  {
    q: '無料で使えますか？',
    a: 'はい。無料登録で、日程調整を月3回までつくれます（毎月リセット）。クレジットカード登録は不要です。Standard 以上のプランでは回数の上限はありません。',
  },
  {
    q: '回答する人も登録が必要ですか？',
    a: 'いいえ。共有リンクを開けば、ログインや登録なしで回答できます。社外の方にもそのまま送れます。',
  },
  {
    q: '回答を後から直せますか？',
    a: '回答した端末からなら、回答表の名前を押して修正・削除できます。日程調整をつくった人は、すべての回答を修正・削除できます。',
  },
  {
    q: '候補日を後から変えられますか？',
    a: 'つくった人は「日程・時間を編集」から変更できます。変えていない候補への回答はそのまま残り、消した候補への回答だけがなくなります。',
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
        <Icon size={20} className="text-amber-400" />
      </div>
      <div className="mb-2 text-sm font-semibold text-amber-400">{label}</div>
      <h3 className={headingClass('card', 'text-white')}><JaWrap>{title}</JaWrap></h3>
      <p className="mt-3 text-sm leading-relaxed text-white/55">{description}</p>
    </GlowCard>
  )
}

export default function SorouLandingPage() {
  return (
    <div className="min-h-screen bg-[#08080a] text-white">
      <ToolJsonLd
        name="日程調整ツール"
        description="カレンダーで候補日と時間を選んで、共有リンクを送るだけ。回答する人はログイン不要。参加できる人が多い日程がひと目でわかる。"
        path="/tools/sorou"
        faqItems={FAQ_ITEMS}
      />
      <Nav />

      {/* ヒーロー＋「日程調整ツールとは？」を1枚の背景（ツールカード色のアンバー）で覆う */}
      <div className="relative" style={{ background: 'radial-gradient(120% 120% at 25% 20%,#f59e0b 0%,#7c2d12 40%,#0f172a 72%)' }}>
        {/* 視認性のための暗幕（2セクション共通） */}
        <div className="pointer-events-none absolute inset-0 bg-black/30" />

        {/* ヒーロー */}
        <section className="relative overflow-hidden px-6 pt-32 pb-16 text-center md:pt-40">
          <div className="relative mx-auto max-w-5xl">
            <p className="mb-7 text-sm text-white">ブランドづくりの打ち合わせを、すぐ決める。</p>
            <h1 className={headingClass('display', 'md:whitespace-nowrap')}><JaWrap>日程調整ツール</JaWrap></h1>
            <p className="mx-auto mt-7 max-w-2xl text-lg text-white/80 md:text-xl">
              候補日を選んで、リンクを送るだけ。
              <br className="hidden sm:block" />
              回答する人はログイン不要。いちばん集まれる日程がひと目でわかります。
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup?from=sorou"
                onClick={() => sendGAEvent('event', 'tool_cta_click', { tool: 'sorou', position: 'hero', destination: 'signup' })}
                className={ctaClass({ size: 'l', variant: 'primary', className: 'gap-2' })}
              >
                無料で始める <ArrowRight size={18} />
              </Link>
              <Link
                href="/document?from=tool_sorou"
                onClick={() => sendGAEvent('event', 'tool_doc_click', { tool: 'sorou', position: 'hero' })}
                className={ctaClass({ size: 'l', variant: 'outline' })}
              >
                サービス資料を見る
              </Link>
            </div>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-white/60">{FREE_TIER_REVIEW_NOTE}</p>
            <p className="mt-3 text-sm text-white/50">
              すでにアカウントをお持ちの方は{' '}
              <Link
                href="/portal/auth?from=sorou"
                onClick={() => sendGAEvent('event', 'tool_login_click', { tool: 'sorou', position: 'hero' })}
                className="font-semibold text-white underline underline-offset-4 hover:text-white/80"
              >
                ログイン
              </Link>
            </p>
          </div>
        </section>

        {/* 日程調整ツールとは？ */}
        <section className="relative px-6 pt-16 pb-20">
          <div className="mx-auto max-w-6xl">
            <h2 className={headingClass('section', 'mb-8 text-center')}><JaWrap>日程調整ツールとは？</JaWrap></h2>
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
          <h2 className={headingClass('section', 'mb-12 text-center')}><JaWrap>4ステップで日程が決まる</JaWrap></h2>
          <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:gap-16">
            <div className="absolute top-5 hidden h-px bg-white/15 md:block" style={{ left: 'calc((100% - 12rem) / 8)', right: 'calc((100% - 12rem) / 8)' }} />
            {STEPS.map((step) => (
              <div key={step.title} className="flex items-center gap-3 md:flex-1 md:flex-col md:gap-0 md:text-center">
                <div className="relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-black md:mb-3">
                  {step.icon}
                </div>
                <div>
                  <h3 className={headingClass('cardSm', 'text-white')}><JaWrap>{step.title}</JaWrap></h3>
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
          <h2 className={headingClass('section', 'mb-8 text-center')}><JaWrap>よくある質問</JaWrap></h2>
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
            style={{ background: 'radial-gradient(80% 120% at 50% 0%, rgba(245,158,11,0.4) 0%, rgba(8,8,10,0) 60%), #0d0d11' }}
          >
            <div className="mb-7 inline-flex flex-wrap items-center justify-center gap-4 text-sm text-white/70">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-amber-400" /> {FREE_TIER_BADGE_LABEL}</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-amber-400" /> クレジットカード不要</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-amber-400" /> {FREE_TIER_REVIEW_BADGE}</span>
            </div>
            <h2 className={headingClass('section', 'text-balance')}><JaWrap>今すぐ日程調整をつくる</JaWrap></h2>
            <p className="mx-auto mt-6 max-w-xl text-lg text-white/60">
              ブランドは、つくった瞬間から走り出す。<br />branding.bz で、その加速を始めませんか。
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup?from=sorou"
                onClick={() => sendGAEvent('event', 'tool_cta_click', { tool: 'sorou', position: 'footer', destination: 'signup' })}
                className={ctaClass({ size: 'l', variant: 'primary', className: 'gap-2' })}
              >
                無料で始める <ArrowRight size={18} />
              </Link>
              <Link
                href="/document?from=tool_sorou"
                onClick={() => sendGAEvent('event', 'tool_doc_click', { tool: 'sorou', position: 'footer' })}
                className={ctaClass({ size: 'l', variant: 'outline' })}
              >
                サービス資料を見る
              </Link>
            </div>
            <p className="mt-4 text-sm text-white/50">
              すでにアカウントをお持ちの方は{' '}
              <Link
                href="/portal/auth?from=sorou"
                onClick={() => sendGAEvent('event', 'tool_login_click', { tool: 'sorou', position: 'footer' })}
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
