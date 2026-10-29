'use client'

// ロゴ規定ツール ランディングページ（LPダークデザインに準拠）
import Link from 'next/link'
import { sendGAEvent } from '@next/third-parties/google'
import { Ruler, ScanEye, BookCheck, CheckCircle2, Layers, Frame, Smartphone, ClipboardCopy, ArrowRight, Plus, type LucideIcon } from 'lucide-react'
import Nav from '@/components/lp/Nav'
import Footer from '@/components/Footer'
import { FREE_TIER_REVIEW_NOTE, FREE_TIER_REVIEW_BADGE } from '@/lib/tools/free-limits'
import DocumentFloatingCta from '@/components/lp/DocumentFloatingCta'
import { ctaClass } from '@/components/lp/cta'
import { headingClass } from '@/components/lp/heading'
import JaWrap from '@/components/lp/JaWrap'
import { ToolJsonLd } from '@/components/seo/ToolJsonLd'

const CONCEPT_CARDS = [
  { label: 'ロゴ規定ツールとは？', icon: Ruler, title: 'ロゴの「最小サイズ」を実寸で測る', description: 'シンボル・ロゴタイプ・組み合わせを版ごとに、画面を実寸に合わせて小さくしていき、どこまで読めるかを確かめます。' },
  { label: '出力条件ごとに確認', icon: ScanEye, title: 'カラー・単色・白抜き・1bit', description: '印刷やモノクロ、暗い背景など、出力条件ごとの見え方を並べて比べ、いちばん厳しい条件で限界を決めます。' },
  { label: '使用規定にまとめる', icon: BookCheck, title: 'ガイドラインに書ける形で', description: '最小サイズ・クリアスペース・使用シーンでの判定・禁止事項を、ブランドガイドラインに貼れる形で書き出します。' },
]

const STEPS = [
  { icon: '1', title: '取り込み', description: 'ロゴを読み込み、画面をクレジットカードの幅で実寸に合わせる' },
  { icon: '2', title: '測定', description: '版ごと・出力条件ごとに、読める限界のサイズを決める' },
  { icon: '3', title: '規定', description: '最小サイズの一覧と、クリアスペースの規定を決める' },
  { icon: '4', title: '検証', description: 'アプリアイコン・ウェブヘッダー・ファビコン・名刺に当てて確かめる' },
  { icon: '5', title: '仕様', description: '使用規定をまとめ、Markdown でコピーする' },
]

const HIGHLIGHTS = [
  { label: '分割', icon: Layers, title: ['組み合わせロゴを', '自動で分割'], description: '1枚のロゴからシンボルとロゴタイプを切り分け、横組み・縦組みの版もつくって並べて測れます。' },
  { label: '実寸', icon: Frame, title: ['画面を実寸に', '合わせて測定'], description: 'カードの幅で画面を校正し、2mm〜25mm の実寸で見え方を確認。目安となるサイズも自動で示します。' },
  { label: '使用シーン', icon: Smartphone, title: ['アイコンや名刺で', 'そのまま検証'], description: 'アプリアイコン・ウェブヘッダー・ファビコン・名刺に当てて、規定を満たす版を判定します。' },
  { label: '書き出し', icon: ClipboardCopy, title: ['使用規定を', 'Markdown でコピー'], description: '最小サイズ・クリアスペース・使用シーン・禁止事項をまとめた仕様を、そのままガイドラインに貼れます。' },
]

// 表示と FAQPage schema は同じ配列を参照して完全一致を担保する
const FAQ_ITEMS = [
  {
    q: '無料で使えますか？',
    a: 'はい。無料登録で、回数の制限なくご利用いただけます。クレジットカード登録は不要です。',
  },
  {
    q: 'アップロードしたロゴはどこかに保存されますか？',
    a: 'いいえ。ロゴの読み込みと画像の処理はすべてお使いのブラウザの中で行い、サーバーには送りません。ページを閉じると内容は消えます。',
  },
  {
    q: 'どんなファイルを使えますか？',
    a: 'SVG・PNG・JPG に対応しています。最小サイズの判定は、ベクター（SVG）で測るのがいちばん正確です。',
  },
  {
    q: '結果はどのように受け取れますか？',
    a: '最後の「仕様」ステップで、使用規定をまとめた Markdown をコピーできます。ブランドガイドラインやマニュアルにそのまま貼れます。',
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
        <Icon size={20} className="text-pink-400" />
      </div>
      <div className="mb-2 text-sm font-semibold text-pink-400">{label}</div>
      <h3 className={headingClass('card', 'text-white')}><JaWrap>{title}</JaWrap></h3>
      <p className="mt-3 text-sm leading-relaxed text-white/55">{description}</p>
    </GlowCard>
  )
}

export default function LogoCheckerLandingPage() {
  return (
    <div className="min-h-screen bg-[#08080a] text-white">
      <ToolJsonLd
        name="ロゴ規定ツール"
        description="ロゴの最小使用サイズを版ごと・出力条件ごとに実寸で測り、クリアスペースと使用シーンでの見え方まで検証。ガイドラインに書ける使用規定にまとめる。"
        path="/tools/logo-checker"
        faqItems={FAQ_ITEMS}
      />
      <Nav />

      {/* ヒーロー＋「ロゴ規定ツールとは？」を1枚の背景（ツールカードと同じ色）で覆う */}
      <div className="relative" style={{ background: 'linear-gradient(140deg,#E4007F 0%,#4c1d95 50%,#0f172a 85%)' }}>
        {/* 視認性のための暗幕（2セクション共通） */}
        <div className="pointer-events-none absolute inset-0 bg-black/30" />

        {/* ヒーロー */}
        <section className="relative overflow-hidden px-6 pt-32 pb-16 text-center md:pt-40">
          <div className="relative mx-auto max-w-5xl">
            <p className="mb-7 text-sm text-white">ロゴの使い方を、感覚ではなく実寸で決める。</p>
            <h1 className={headingClass('display', 'md:whitespace-nowrap')}><JaWrap>ロゴ規定ツール</JaWrap></h1>
            <p className="mx-auto mt-7 max-w-2xl text-lg text-white/80 md:text-xl">
              ロゴは、どこまで小さくして使えるか。
              <br className="hidden sm:block" />
              最小サイズとクリアスペースを実寸で検証し、使用規定にまとめます。
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup?from=logo-checker"
                onClick={() => sendGAEvent('event', 'tool_cta_click', { tool: 'logo-checker', position: 'hero', destination: 'signup' })}
                className={ctaClass({ size: 'l', variant: 'primary', className: 'gap-2' })}
              >
                無料で始める <ArrowRight size={18} />
              </Link>
              <Link
                href="/document?from=tool_logo-checker"
                onClick={() => sendGAEvent('event', 'tool_doc_click', { tool: 'logo-checker', position: 'hero' })}
                className={ctaClass({ size: 'l', variant: 'outline' })}
              >
                サービス資料を見る
              </Link>
            </div>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-white/60">{FREE_TIER_REVIEW_NOTE}</p>
            <p className="mt-3 text-sm text-white/50">
              すでにアカウントをお持ちの方は{' '}
              <Link
                href="/portal/auth?from=logo-checker"
                onClick={() => sendGAEvent('event', 'tool_login_click', { tool: 'logo-checker', position: 'hero' })}
                className="font-semibold text-white underline underline-offset-4 hover:text-white/80"
              >
                ログイン
              </Link>
            </p>
          </div>
        </section>

        {/* ロゴ規定ツールとは？ */}
        <section className="relative px-6 pt-16 pb-20">
          <div className="mx-auto max-w-6xl">
            <h2 className={headingClass('section', 'mb-8 text-center')}><JaWrap>ロゴ規定ツールとは？</JaWrap></h2>
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
          <h2 className={headingClass('section', 'mb-12 text-center')}><JaWrap>5ステップで使用規定ができる</JaWrap></h2>
          <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:gap-16">
            <div className="absolute top-5 hidden h-px bg-white/15 md:block" style={{ left: 'calc((100% - 24rem) / 10)', right: 'calc((100% - 24rem) / 10)' }} />
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
            style={{ background: 'radial-gradient(80% 120% at 50% 0%, rgba(228,0,127,0.35) 0%, rgba(8,8,10,0) 60%), #0d0d11' }}
          >
            <div className="mb-7 inline-flex flex-wrap items-center justify-center gap-4 text-sm text-white/70">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-pink-400" /> 無料・回数制限なし</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-pink-400" /> クレジットカード不要</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-pink-400" /> {FREE_TIER_REVIEW_BADGE}</span>
            </div>
            <h2 className={headingClass('section', 'text-balance')}><JaWrap>今すぐロゴの使用規定をつくる</JaWrap></h2>
            <p className="mx-auto mt-6 max-w-xl text-lg text-white/60">
              ブランドは、つくった瞬間から走り出す。<br />branding.bz で、その加速を始めませんか。
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup?from=logo-checker"
                onClick={() => sendGAEvent('event', 'tool_cta_click', { tool: 'logo-checker', position: 'footer', destination: 'signup' })}
                className={ctaClass({ size: 'l', variant: 'primary', className: 'gap-2' })}
              >
                無料で始める <ArrowRight size={18} />
              </Link>
              <Link
                href="/document?from=tool_logo-checker"
                onClick={() => sendGAEvent('event', 'tool_doc_click', { tool: 'logo-checker', position: 'footer' })}
                className={ctaClass({ size: 'l', variant: 'outline' })}
              >
                サービス資料を見る
              </Link>
            </div>
            <p className="mt-4 text-sm text-white/50">
              すでにアカウントをお持ちの方は{' '}
              <Link
                href="/portal/auth?from=logo-checker"
                onClick={() => sendGAEvent('event', 'tool_login_click', { tool: 'logo-checker', position: 'footer' })}
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
