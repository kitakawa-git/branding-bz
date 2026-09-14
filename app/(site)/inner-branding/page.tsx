'use client'

// インナーブランディング ランディングページ（LPダークデザインに準拠）
//
// 無料ツール目当ての流入とは別に、「インナーブランディング ツール」「理念浸透」など
// 導入を検討している層の受け皿。主CTAは登録ではなく資料ダウンロード（/document）。
//
// Nav / Footer / ダーク背景は app/(site)/layout.tsx が付けるので、ここでは描画しない
// （/tools/personality はルートグループの外にあるため自前で持っている）。
//
// ⚠️ 事例・実績・企業名は書かない（対外的に使える事例がまだ無い）。
//    数字は料金と人数上限だけ。プラン表記は lib/billing/entitlements.ts と一致させる。
import Link from 'next/link'
import { sendGAEvent } from '@next/third-parties/google'
import { ArrowRight, MessageSquareOff, Unlink, CircleHelp, Compass, HandHeart, GraduationCap, BarChart3, type LucideIcon } from 'lucide-react'
import { PageHero, GlowCard } from '@/components/lp/ui'
import FaqItem from '@/components/lp/FaqItem'
import FinalCta from '@/components/lp/FinalCta'

type CtaTarget = 'document' | 'signup' | 'plan'
type CtaPosition = 'hero' | 'pricing' | 'footer'

function trackCta(target: CtaTarget, position: CtaPosition) {
  sendGAEvent('event', 'lp_cta_click', { lp: 'inner-branding', target, position })
}

const PAGE_URL = 'https://branding.bz/inner-branding'
const WIKI_TERM = 'インナーブランディング'

const STUMBLES: { icon: LucideIcon; title: string; description: string }[] = [
  { icon: MessageSquareOff, title: '言えない', description: '理念やスローガンはあるが、社員が自分の言葉で説明できない。掲示物とファイルサーバーの奥で眠っている。' },
  { icon: Unlink, title: '落ちない', description: 'ブランドが日々の判断・行動につながらない。「らしい仕事」を称え合う場も、学ぶ場もない。' },
  { icon: CircleHelp, title: '測れない', description: '浸透したのか誰も分からない。社外からどう見えているかは、なおさら分からない。' },
]

// plan は entitlements.ts と一致させる:
//   brandGuidelinesEdit=free / timeline・announcements=standard /
//   videoLearning・brandQuiz・innerSurvey・brandScoreInner=premium
const MEASURES: { no: string; icon: LucideIcon; title: string; plan: string; description: string; features: string[] }[] = [
  {
    no: '①',
    icon: Compass,
    title: '拠りどころをつくる',
    plan: 'Free 〜',
    description: '方針・戦略・ビジュアルID・バーバルID・提供価値を全社に掲示。いつでも参照できる場所を1つに決めます。',
    features: ['ブランド掲示'],
  },
  {
    no: '②',
    icon: HandHeart,
    title: '体現を称え合う',
    plan: 'Standard 〜',
    description: '行動指針に沿った取り組みを写真つきで共有し、いいね・コメントで称え合う。「らしい仕事」が見える化され、真似できる状態になります。',
    features: ['Good Action投稿', 'お知らせ配信＋Web Push'],
  },
  {
    no: '③',
    icon: GraduationCap,
    title: '学ぶ・確かめる',
    plan: 'Premium 〜',
    description: 'ブランドを学ぶ動画を配信し、誰がどこまで見たかを把握。理解度は設問で測り、部署別・役職別に集計します。設問案はAIが生成します。',
    features: ['ビデオラーニング', 'ブランド理解度テスト'],
  },
  {
    no: '④',
    icon: BarChart3,
    title: '浸透を数字で見る',
    plan: 'Premium 〜',
    description: '社内サーベイと理解度テストの結果をスコア化し、推移で追跡。「理解はしているが共感が薄い」といったギャップも見えます。',
    features: ['インナーサーベイ＋AI設問生成', 'インナースコア＋推移', '理解度×共感ギャップ分析'],
  },
]

// app/(site)/plan/page.tsx の PLANS と同じ値
const PRICING: { name: string; price: string; suffix: string | null; scale: string }[] = [
  { name: 'Free', price: '¥0', suffix: null, scale: '〜5名' },
  { name: 'Standard', price: '¥19,800', suffix: '/月（税別）', scale: '5〜50名' },
  { name: 'Premium', price: '¥59,800', suffix: '/月（税別）', scale: '50〜300名' },
]

// 表示と FAQPage schema は同じ配列を参照して完全一致を担保する
const FAQ_ITEMS = [
  {
    q: 'インナーブランディングは、何から始めればいいですか？',
    a: 'まず「拠りどころ」を1か所にまとめるところからです。方針・戦略・ビジュアルID・バーバルID・提供価値をブランド掲示として全社で共有できる状態をつくります。ここは無料プランでも編集・閲覧いただけます。',
  },
  {
    q: 'すでに理念やスローガンがある場合も使えますか？',
    a: '使えます。すでにある言葉をブランド掲示に登録すれば、そこから浸透の施策を始められます。ゼロからつくり直す必要はありません。',
  },
  {
    q: '何名から使えますか？',
    a: '無料プランは5名まで、Standard は50名まで、Premium は300名までです。300名を超える場合は Enterprise で個別にご相談ください。',
  },
  {
    q: '浸透しているかどうかは、どうやって測るのですか？',
    a: '社内向けサーベイと理解度テストの結果をスコア化し、推移で追えます（Premium以上）。理解度と共感のギャップ分析もご利用いただけます。',
  },
]

// 表示は無し。BreadcrumbList schema の単一ソース
const BREADCRUMBS = [
  { name: 'ホーム', item: 'https://branding.bz/' },
  { name: 'インナーブランディング', item: PAGE_URL },
]

export default function InnerBrandingLandingPage() {
  return (
    <main>
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
            itemListElement: BREADCRUMBS.map((b, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: b.name,
              item: b.item,
            })),
          }),
        }}
      />

      {/* 1. ヒーロー */}
      <PageHero eyebrow="インナーブランディング" title="理念は、掲げるだけでは根づかない。">
        <p>
          掲示して終わり、研修して終わりにしない。ブランドを日々の業務のなかに置き、
          <br className="hidden md:block" />
          浸透の進み具合を数字で追えるところまでを1つの場所で。
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/document"
            onClick={() => trackCta('document', 'hero')}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-8 text-base font-semibold text-black transition-transform hover:scale-105"
          >
            資料をダウンロード <ArrowRight size={18} />
          </Link>
          <Link
            href="/signup"
            onClick={() => trackCta('signup', 'hero')}
            className="inline-flex h-12 items-center rounded-full border border-white/15 bg-white/5 px-8 text-base font-semibold text-white backdrop-blur transition-colors hover:bg-white/10"
          >
            無料で始める
          </Link>
        </div>
      </PageHero>

      {/* 2. 3つのつまずき */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-10 text-center text-3xl font-bold tracking-tight md:text-4xl">
            理念が根づかない、3つのつまずき
          </h2>
          <div className="grid gap-5 md:grid-cols-3">
            {STUMBLES.map(({ icon: Icon, title, description }) => (
              <GlowCard key={title} className="p-7">
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                  <Icon size={20} className="text-ds-app-accent-soft" />
                </div>
                <h3 className="text-xl font-bold text-white">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/60">{description}</p>
              </GlowCard>
            ))}
          </div>
        </div>
      </section>

      {/* 3. インナーブランディングとは */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <GlowCard className="px-7 py-10 md:px-12">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">インナーブランディングとは</h2>
            <p className="mt-5 text-base leading-[1.9] text-white/70">
              社員が自社のブランド（理念・価値観・らしさ）を理解し、共感し、日々の行動として体現できる状態をつくる活動のこと。社外に向けた発信（アウターブランディング）と対になる考え方です。掲げた言葉が現場の判断基準になって初めて、ブランドは事業の成果につながります。
            </p>
            <p className="mt-6 text-sm text-white/50">
              用語の詳しい解説はこちら →{' '}
              <Link
                href={`/wiki/${encodeURIComponent(WIKI_TERM)}`}
                className="inline-flex min-h-11 items-center font-medium text-ds-app-accent-soft underline underline-offset-4 hover:text-white"
              >
                ブランディング用語wiki『インナーブランディング』
              </Link>
            </p>
          </GlowCard>
        </div>
      </section>

      {/* 4. 4つの打ち手 */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-10 text-center text-3xl font-bold tracking-tight md:text-4xl">
            浸透を、4つの打ち手に分解する
          </h2>
          <div className="grid gap-5 md:grid-cols-2">
            {MEASURES.map(({ no, icon: Icon, title, plan, description, features }) => (
              <GlowCard key={title} className="flex flex-col p-7">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                    <Icon size={20} className="text-ds-app-accent-soft" />
                  </div>
                  {/* プラン表記は必ず出す（どこから使えるかを先に伝える） */}
                  <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm font-semibold text-white/80">
                    {plan}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white">
                  <span className="mr-1 text-ds-app-accent-soft">{no}</span>
                  {title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-white/60">{description}</p>
                <div className="mt-5 border-t border-white/10 pt-4">
                  <p className="mb-2 text-sm font-semibold text-white/40">使う機能</p>
                  <ul className="flex flex-wrap gap-2">
                    {features.map((f) => (
                      <li key={f} className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-sm text-white/75">
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </GlowCard>
            ))}
          </div>
        </div>
      </section>

      {/* 5. 料金への導線 */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-10 text-center text-3xl font-bold tracking-tight md:text-4xl">
            小さく始めて、必要な分だけ広げる
          </h2>
          <div className="grid gap-5 sm:grid-cols-3">
            {PRICING.map((p) => (
              <GlowCard key={p.name} className="px-6 py-8 text-center">
                <p className="text-base font-bold text-white">{p.name}</p>
                <p className="mt-3">
                  <span className="text-3xl font-bold tracking-tight">{p.price}</span>
                  {p.suffix && <span className="ml-1 text-sm text-white/50">{p.suffix}</span>}
                </p>
                <p className="mt-3 text-sm text-white/60">想定規模 {p.scale}</p>
              </GlowCard>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-white/50">※ 金額はすべて税別。初期費用は無料。</p>
          <div className="mt-4 text-center">
            <Link
              href="/plan"
              onClick={() => trackCta('plan', 'pricing')}
              className="inline-flex min-h-11 items-center gap-1.5 text-base font-medium text-ds-app-accent-soft underline underline-offset-4 hover:text-white"
            >
              プランの詳細を見る <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* 6. FAQ */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-center text-3xl font-bold tracking-tight md:text-4xl">よくある質問</h2>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* 7. 最終CTA。FinalCta は onClick を受けないので、外側でリンククリックを拾って計測する */}
      <div
        onClickCapture={(e) => {
          const a = (e.target as HTMLElement).closest('a')
          if (a?.getAttribute('href') === '/document') trackCta('document', 'footer')
        }}
      >
        <FinalCta
          title="まず資料で、進め方を確かめる"
          lead="branding.bz の機能・料金・導入の流れを、資料にまとめています。"
          primary={{ href: '/document', label: '資料をダウンロード' }}
          secondary={null}
          note={null}
        />
      </div>
    </main>
  )
}
