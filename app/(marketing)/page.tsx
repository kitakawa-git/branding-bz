import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'brandconnect — ブランドを、つくり、根づかせ、届ける',
  description: '中小企業のブランドを「構築→浸透→発信」まで一貫支援するSaaS。ミニアプリでブランドを作り、社内に根づかせ、スマート名刺で届ける。',
}

/* ─── セクション1: Hero ─── */
function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white px-6 pt-24 pb-20 md:pt-32 md:pb-28">
      <div className="max-w-[960px] mx-auto text-center">
        <p className="font-comfortaa text-teal text-sm font-semibold tracking-widest uppercase mb-6">
          Build — Embed — Deliver
        </p>
        <h1 className="font-comfortaa text-[clamp(1.8rem,4vw,3.2rem)] font-bold text-gray-900 leading-tight mb-6">
          ブランドを、つくり、<br className="sm:hidden" />
          根づかせ、届ける。
        </h1>
        <p className="text-lg md:text-xl text-lp-gray leading-relaxed mb-4 max-w-[640px] mx-auto">
          中小企業のためのブランディングSaaS。<br className="hidden sm:block" />
          AIでブランドを構築し、社内に浸透させ、スマート名刺で社外に届ける。
        </p>
        <p className="font-comfortaa text-teal text-base font-semibold mb-10">
          &ldquo;らしさ&rdquo;をひろげよう
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link
            href="/contact"
            className="inline-flex items-center h-14 px-10 text-base font-bold text-white bg-gray-900 rounded-full hover:opacity-80 transition-opacity"
          >
            無料で始める
          </Link>
          <Link
            href="/plan"
            className="inline-flex items-center h-14 px-10 text-base font-medium text-gray-900 border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
          >
            料金を見る
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ─── セクション2: 3レイヤー ─── */
const layers = [
  {
    num: '01',
    label: '構築',
    title: 'ミニアプリでブランドを作る',
    description:
      '理念・コピー・カラー・ペルソナをAIがガイド。専門知識がなくても、プロ品質のブランドアイデンティティを短時間で策定できます。',
    color: 'bg-teal/10 text-teal',
    icon: '/marketing/icons/auto-awesome.svg',
  },
  {
    num: '02',
    label: '浸透',
    title: 'brandconnect で社内に根づかせる',
    description:
      'ブランド掲示・Good Job タイムライン・KPI管理・学習コンテンツを統合。日々の業務のなかでブランドが自然と「わがこと」になります。',
    color: 'bg-lp-orange/10 text-lp-orange',
    icon: '/marketing/icons/explore.svg',
  },
  {
    num: '03',
    label: '発信',
    title: 'スマート名刺で社外に届ける',
    description:
      'QRコードから個人プロフィール＋企業ブランドの簡易ページを表示。ブランドの「らしさ」を一人ひとりが体現する発信ツールです。',
    color: 'bg-lp-pink/10 text-lp-pink',
    icon: '/marketing/icons/accessibility_new.svg',
  },
]

function LayersSection() {
  return (
    <section className="bg-lp-gray-bg px-6 py-20 md:py-28">
      <div className="max-w-[1100px] mx-auto">
        <h2 className="font-comfortaa text-center text-2xl md:text-3xl font-bold text-gray-900 mb-4">
          3つのレイヤーで、ブランドを支える
        </h2>
        <p className="text-center text-lp-gray mb-14 max-w-[600px] mx-auto">
          作って終わりにしない。構築から浸透・発信まで、ブランドの旅路をまるごとサポートします。
        </p>

        <div className="grid md:grid-cols-3 gap-8">
          {layers.map((layer) => (
            <div key={layer.num} className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-5">
                <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold ${layer.color}`}>
                  {layer.num}
                </span>
                <span className="font-comfortaa text-sm font-semibold tracking-wide text-lp-gray-dark">
                  {layer.label}
                </span>
              </div>
              <div className="mb-4 flex justify-center">
                <Image src={layer.icon} alt="" width={56} height={56} className="opacity-70" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">{layer.title}</h3>
              <p className="text-sm text-lp-gray leading-relaxed">{layer.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── セクション3: About + YouTube ─── */
function AboutSection() {
  return (
    <section className="bg-white px-6 py-20 md:py-28">
      <div className="max-w-[960px] mx-auto">
        <h2 className="font-comfortaa text-center text-2xl md:text-3xl font-bold text-gray-900 mb-4">
          brandconnect とは
        </h2>
        <p className="text-center text-lp-gray mb-12 max-w-[680px] mx-auto leading-relaxed">
          ノーコードでブランド構築から学習・運用・共有まで実現するクラウドサービス。<br className="hidden md:block" />
          3つのレイヤーが連動し、企業のブランド力を日々少しずつ底上げします。
        </p>

        {/* YouTube 埋め込み */}
        <div className="aspect-video max-w-[800px] mx-auto rounded-2xl overflow-hidden shadow-lg">
          <iframe
            src="https://www.youtube.com/embed/AhhiwxAgnxM"
            title="brandconnect紹介動画"
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </section>
  )
}

/* ─── セクション4: 機能紹介 ─── */
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
    description: 'ブランド方針・戦略・ビジュアルID・バーバルIDを全社に掲示。いつでも「らしさ」を参照できます。',
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
    <section className="bg-lp-gray-bg px-6 py-20 md:py-28">
      <div className="max-w-[1100px] mx-auto">
        <h2 className="font-comfortaa text-center text-2xl md:text-3xl font-bold text-gray-900 mb-4">
          主な機能
        </h2>
        <p className="text-center text-lp-gray mb-14">
          ブランドの浸透に必要なすべてを、ひとつのプラットフォームに。
        </p>

        <div className="grid md:grid-cols-2 gap-8">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className={`bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow ${
                i === features.length - 1 && features.length % 2 !== 0 ? 'md:col-span-2 md:max-w-[calc(50%-1rem)] md:mx-auto' : ''
              }`}
            >
              {feature.gif && (
                <div className="aspect-video bg-lp-gray-bg2">
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
              <div className="p-6 flex items-start gap-4">
                <Image src={feature.icon} alt="" width={32} height={32} className="mt-1 opacity-60 shrink-0" />
                <div>
                  <h3 className="text-base font-bold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-sm text-lp-gray leading-relaxed">{feature.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── セクション5: CTA ─── */
function CTASection() {
  return (
    <section className="bg-white px-6 py-20 md:py-28 text-center">
      <div className="max-w-[720px] mx-auto">
        <h2 className="font-comfortaa text-2xl md:text-3xl font-bold text-gray-900 mb-4">
          さぁ、&ldquo;らしさ&rdquo;をひろげよう
        </h2>
        <p className="text-lp-gray mb-6">
          brandconnect で、ブランドを社内に根づかせ、社外に届けましょう。
        </p>

        {/* βテスター募集 */}
        <div className="inline-block bg-teal/10 rounded-full px-6 py-2 mb-10">
          <span className="text-teal font-bold text-sm">残り2社限定</span>
          <span className="text-lp-gray-dark text-sm ml-2">βテスター企業 募集中！</span>
        </div>

        <div className="flex gap-4 justify-center flex-wrap">
          <Link
            href="/contact"
            className="inline-flex items-center h-14 px-10 text-base font-bold text-white bg-gray-900 rounded-full hover:opacity-80 transition-opacity"
          >
            お問い合わせ
          </Link>
          <Link
            href="/plan"
            className="inline-flex items-center h-14 px-10 text-base font-medium text-gray-900 border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
          >
            料金プランを見る
          </Link>
        </div>

        <p className="mt-8 text-xs text-lp-gray-light">
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
      <HeroSection />
      <LayersSection />
      <AboutSection />
      <FeaturesSection />
      <CTASection />
    </>
  )
}
