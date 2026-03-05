import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowRight, Sparkles, MessageSquareText, ChartLine, CreditCard } from 'lucide-react'

export const metadata: Metadata = {
  title: 'branding.bz — AIで、ブランディングを加速させる。',
  description: '社員が体現し、顧客に届く。ブランドの構築・浸透・発信をひとつのプラットフォームで。branding.bz はブランディング会社の現場から生まれたSaaSです。',
  openGraph: {
    title: 'branding.bz — AIで、ブランディングを加速させる。',
    description: '社員が体現し、顧客に届く。ブランドの構築・浸透・発信をひとつのプラットフォームで。',
    siteName: 'branding.bz',
  },
}

/* ─── セクション1: Hero ─── */
function HeroSection() {
  return (
    <section className="text-center">
      <div className="w-full max-w-4xl mx-auto px-6 pt-16 pb-16 md:pt-24 md:pb-24">
        <div
          className="mb-8 inline-flex items-center gap-2 rounded-full px-6 py-1.5 text-sm text-blue-700 relative overflow-hidden"
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
          <Sparkles className="h-4 w-4 relative z-10" />
          <span className="relative z-10">AIガイドで約5〜10分</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-gray-900">
          AIで、ブランディングを加速させる
        </h1>
        <p className="mt-6 text-lg md:text-xl text-gray-700 max-w-2xl mx-auto leading-relaxed">
          社員が体現し、顧客に届く。<br className="hidden sm:block" />
          ブランドの構築・浸透・発信を、ひとつのプラットフォームで。
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/contact">
            <Button size="lg" className="h-12 w-48 text-base font-bold">
              無料で始める
            </Button>
          </Link>
          <Link href="/plan">
            <Button variant="outline" size="lg" className="h-12 w-48 text-base font-bold">
              料金を見る
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ─── セクション2: 3レイヤー ─── */
const layers = [
  {
    label: '構築',
    title: 'ブランドの言語化を、対話型AIがサポート',
    description:
      '「自社の"らしさ"は分かっているけど、うまく言葉にできない」そんな悩みに、AIが壁打ち相手として伴走。理念・スローガン・カラー・ペルソナを、対話しながら形にします。',
    icon: MessageSquareText,
  },
  {
    label: '浸透',
    title: 'ブランドの定着と可視化を、AIがサポート',
    description:
      'ブランド掲示・タイムライン・KPIを統合した浸透プラットフォーム。AIが社員の活動データから浸透度を分析し、「どこが根づいていて、どこに手を打つべきか」を可視化します。',
    icon: ChartLine,
  },
  {
    label: '発信',
    title: 'ブランドの発信を、スマート名刺がサポート',
    description:
      'QRコードから社員プロフィール＋企業ブランドページへ。社内で根づいた"らしさ"が、一人ひとりの名刺を通じて社外に届きます。誰の名刺が、いつ、どれだけ見られたかも把握できます。',
    icon: CreditCard,
  },
]

function LayersSection() {
  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-7xl">
        <h2 className="text-center text-2xl font-bold text-gray-900 mb-8">
          あらゆるステップを、AIがサポート
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {layers.map((layer) => (
            <div
              key={layer.label}
              className="relative rounded-2xl overflow-hidden transition-all hover:scale-[1.02] hover:shadow-2xl"
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                backdropFilter: 'blur(12px) saturate(120%)',
                WebkitBackdropFilter: 'blur(12px) saturate(120%)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                boxShadow: '0px 8px 24px 0 rgba(12, 74, 110, 0.12), inset 0px 0px 4px 2px rgba(255, 255, 255, 0.15)',
              }}
            >
              {/* リフレクションハイライト */}
              <div
                className="absolute inset-0 pointer-events-none rounded-2xl"
                style={{ background: 'linear-gradient(to left top, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 50%)' }}
              />
              <div
                className="absolute inset-0 pointer-events-none rounded-2xl"
                style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 100%)' }}
              />
              {/* カードコンテンツ */}
              <div className="relative z-10 p-8">
                <div className="mb-5">
                  <span className="text-sm font-semibold tracking-wide text-gray-700">
                    {layer.label}
                  </span>
                </div>
                <div className="mb-4">
                  <layer.icon size={32} strokeWidth={1.5} className="text-foreground" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">
                  {layer.title.split('、')[0]}、<br />{layer.title.split('、')[1]}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">{layer.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── セクション4: About ─── */
function AboutSection() {
  return (
    <section className="bg-gray-50 px-6 py-16 md:py-24">
      <div className="mx-auto max-w-7xl">
        <h2 className="text-center text-2xl md:text-3xl font-bold text-gray-900 mb-10">
          ブランディング会社の現場から生まれたSaaS
        </h2>

        <div className="mx-auto max-w-3xl space-y-4 text-gray-600 leading-relaxed text-center">
          <p>
            ID INC. は15年以上、企業のブランディングを手がけてきました。<br className="hidden md:block" />
            その現場で何度も直面したのは、「作ったブランドが浸透しない」という壁。<br className="hidden md:block" />
            どれだけ良い理念を作っても、社員の行動が変わらなければ意味がない。
          </p>
          <p className="text-gray-900 font-semibold">
            この「浸透の壁」をAIとテクノロジーで壊すために、branding.bz は生まれました。<br className="hidden md:block" />
            構築から浸透、発信まで——ブランドの旅路をまるごと支える、はじめてのプラットフォームです。
          </p>
        </div>

        {/* YouTube 埋め込み */}
        <div className="aspect-video max-w-3xl mx-auto rounded-xl overflow-hidden shadow-lg mt-12">
          <iframe
            src="https://www.youtube.com/embed/AhhiwxAgnxM"
            title="branding.bz 紹介動画"
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </section>
  )
}

/* ─── セクション5: 機能紹介 ─── */
const features = [
  {
    title: 'ダッシュボード',
    description: '行動指針別の投稿数やKPI進捗をリアルタイムで表示。チームのブランド浸透度が一目でわかります。',
    gif: '/marketing/gifs/dashboard.gif',
    icon: '/marketing/icons/splitscreen.svg',
  },
  {
    title: 'Good Job タイムライン',
    description: '行動指針に基づいた行動を、タイムラインで手軽にシェア。互いに称え合う文化を醸成します。',
    gif: '/marketing/gifs/timeline.gif',
    icon: '/marketing/icons/explore.svg',
  },
  {
    title: '個人目標と KPI',
    description: '年度目標に沿ったKPIを設定し、達成状況を管理。優先順位と期限を見える化します。',
    gif: '/marketing/gifs/kpi.gif',
    icon: '/marketing/icons/fact_check.svg',
  },
  {
    title: 'ブランド掲示',
    description: 'ブランド方針・戦略・ビジュアルID・バーバルIDを全社に掲示。いつでも"らしさ"を参照できます。',
    gif: '/marketing/gifs/guidelines.gif',
    icon: '/marketing/icons/folder_special.svg',
  },
  {
    title: 'お知らせ',
    description: '社内イベントやブランド戦略の進捗を全メンバーに配信。情報の一元化で認識を揃えます。',
    gif: '/marketing/gifs/announcements.gif',
    icon: '/marketing/icons/notifications-1.svg',
  },
  {
    title: 'スマート名刺',
    description: 'QRコードからプロフィール＋企業ブランドページを表示。名刺交換の瞬間がブランド体験になります。',
    gif: null,
    icon: '/marketing/icons/accessibility_new.svg',
  },
  {
    title: '効果計測',
    description: '利用率や投稿分類などを計測。ブランド浸透を定量評価し、次のアクションにつなげます。',
    gif: null,
    icon: '/marketing/icons/pie_chart.svg',
  },
  {
    title: 'ブランディングサポート',
    description: 'ブランド構築の専門サポートをオプションで提供。戦略策定からデザイン相談まで対応します。',
    gif: '/marketing/gifs/support.gif',
    icon: '/marketing/icons/design_services.svg',
  },
]

function FeaturesSection() {
  return (
    <section className="bg-white px-6 py-16 md:py-24">
      <div className="mx-auto max-w-7xl">
        <h2 className="text-center text-2xl md:text-3xl font-bold text-gray-900 mb-4">
          ブランドを加速させる機能
        </h2>
        <p className="text-center text-gray-500 mb-12">
          ブランドの浸透に必要なすべてを、ひとつのプラットフォームに。
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          {features.map((feature, i) => (
            <Card
              key={feature.title}
              className={`overflow-hidden transition-shadow hover:shadow-lg ${
                i === features.length - 1 && features.length % 2 !== 0 ? 'md:col-span-2 md:max-w-[calc(50%-0.75rem)] md:mx-auto' : ''
              }`}
            >
              {feature.gif && (
                <div className="aspect-video bg-gray-100">
                  <Image
                    src={feature.gif}
                    alt={`${feature.title}のデモ`}
                    width={600}
                    height={338}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </div>
              )}
              <CardContent className="p-6 flex items-start gap-4">
                <Image src={feature.icon} alt="" width={32} height={32} className="mt-1 opacity-60 shrink-0" />
                <div>
                  <h3 className="text-base font-bold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{feature.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── セクション6: CTA ─── */
function CTASection() {
  return (
    <section className="bg-gray-50 px-6 py-16 md:py-24 text-center">
      <div className="mx-auto max-w-7xl">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
          さぁ、&ldquo;らしさ&rdquo;をひろげよう。
        </h2>
        <p className="text-gray-600 mb-6 leading-relaxed">
          ブランドは、作った瞬間から走り出す。<br className="hidden sm:block" />
          branding.bz で、その加速を始めませんか。
        </p>

        {/* βテスター募集 */}
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-5 py-2 mb-8">
          <span className="text-blue-700 font-bold text-sm">残り2社限定</span>
          <span className="text-gray-700 text-sm">βテスター企業 募集中！</span>
        </div>

        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="/contact">
            <Button size="lg" className="h-12 px-8 text-base font-bold">
              お問い合わせ
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/plan">
            <Button variant="outline" size="lg" className="h-12 px-8 text-base font-medium">
              料金プランを見る
            </Button>
          </Link>
        </div>

        <p className="mt-6 text-xs text-gray-400">
          無料で最新バージョンをいち早くお試しいただけます
        </p>
      </div>
    </section>
  )
}

/* ─── メインページ ─── */
export default function MarketingPage() {
  return (
    <>
      {/* パララックス背景画像（ビューポートに固定） */}
      <div className="fixed inset-0 z-0">
        <Image
          src="/marketing/images/hero-bg.jpg"
          alt=""
          fill
          className="object-cover"
          priority
          unoptimized
        />
      </div>

      {/* Hero + Layers（背景画像の上をスクロール） */}
      <div className="relative z-10">
        <HeroSection />
        <LayersSection />
      </div>

      {/* 以降のセクション（背景色で固定画像を隠す） */}
      <div className="relative z-10">
        <AboutSection />
        <FeaturesSection />
        <CTASection />
      </div>
    </>
  )
}
