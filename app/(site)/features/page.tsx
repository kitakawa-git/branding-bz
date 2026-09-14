import type { Metadata } from 'next'
import Link from 'next/link'
import {
  LayoutDashboard,
  MessageSquareHeart,
  Milestone,
  Compass,
  Bell,
  CreditCard,
  BarChart3,
  Activity,
  GraduationCap,
  ClipboardCheck,
  Headset,
  type LucideIcon,
} from 'lucide-react'
import { PageHero, GlowCard } from '@/components/lp/ui'
import { tools } from '@/components/lp/tools'
import ToolCard from '@/components/lp/ToolCard'
import FinalCta from '@/components/lp/FinalCta'

export const metadata: Metadata = {
  title: '機能紹介 | branding.bz',
  description:
    'branding.bz の機能紹介。ブランド掲示・Good Action投稿・目標・KPI管理・スマート名刺・ブランドスコアなど、ブランドの構築・浸透・発信と、そのすべてを支える計測の機能をまとめて紹介します。',
  alternates: {
    canonical: '/features',
  },
  openGraph: {
    title: '機能紹介 | branding.bz',
    description:
      'branding.bz の機能紹介。ブランド掲示・Good Action投稿・目標・KPI管理・スマート名刺・ブランドスコアなど、ブランドの構築・浸透・発信と、そのすべてを支える計測の機能をまとめて紹介します。',
    url: 'https://branding.bz/features',
  },
}

type Feature = { id?: string; title: string; description: string; icon: LucideIcon; tag: string }

// 構築 → 浸透 → 発信 の3ステップ＋サポート。
// 計測（はかる）はステップではなく3つを横串で評価する軸なので、
// 順番の流れから外して発信のあと・サポートの直前に置く
const groups: { layer: string; lead: string; features: Feature[] }[] = [
  {
    layer: '構築',
    lead: 'ブランドの"らしさ"を、全社の拠りどころに。',
    features: [],
  },
  {
    layer: '浸透',
    lead: '日々の行動と数字で、ブランドを根づかせる。',
    features: [
      {
        id: 'feature-brand',
        tag: '浸透',
        title: 'ブランド掲示',
        description:
          '理念や戦略、|顧客に届ける価値、|デザインと言葉の|ルールを一か所に。|社員が迷ったときに|立ち返れる、|共通の基準をつくります。',
        icon: Compass,
      },
      {
        tag: '浸透',
        title: 'ダッシュボード',
        description:
          '投稿数・行動指針別の割合・KPI進捗を期間フィルター付きで表示。チームのブランド浸透度が、数字で見えるようになります。',
        icon: LayoutDashboard,
      },
      {
        id: 'feature-timeline',
        tag: '浸透',
        title: 'Good Action投稿',
        description:
          '行動指針に基づいた取り組みを、写真付きで手軽にシェア。いいね・コメントで称え合い、ブランドを体現する文化を育てます。',
        icon: MessageSquareHeart,
      },
      {
        id: 'feature-kpi',
        tag: '浸透',
        title: '目標・KPI管理',
        description:
          'ブランド行動指針に紐づく目標を設定し、達成状況を管理。重み付け・達成時期で、優先順位を見える化します。',
        icon: Milestone,
      },
      {
        tag: '浸透',
        title: 'お知らせ配信＋Web Push',
        description:
          '社内イベントや|ブランド戦略の進捗を|全員に配信。|スマートフォンへの|プッシュ通知で、|大切なお知らせの|見逃しを減らします。',
        icon: Bell,
      },
      {
        tag: '浸透',
        title: 'ビデオラーニング',
        description:
          'ブランドを学ぶ動画を|カテゴリ・テーマ別に配信。|誰がどこまで|視聴したかを把握し、|学習の進み具合を|確認できます。',
        icon: GraduationCap,
      },
      {
        tag: '浸透',
        title: 'ブランド理解度テスト',
        description:
          '理念や行動指針の理解度を設問で測定。AIが設問案を生成し、部署別・役職別に正答率を集計します。',
        icon: ClipboardCheck,
      },
    ],
  },
  {
    layer: '発信',
    lead: '社内で根づいた"らしさ"を、社外へ届ける。',
    features: [
      {
        id: 'feature-card',
        tag: '発信',
        title: 'スマート名刺',
        description:
          'QRコードからプロフィール＋企業ブランドページを表示。ブランドカラーが自動適用され、連絡先はvCardでそのまま保存できます。名刺交換がブランド体験に変わります。',
        icon: CreditCard,
      },
      {
        tag: '発信',
        title: '効果計測',
        description:
          '名刺の閲覧数・閲覧トレンド・メンバー別ランキングを自動集計。誰の名刺が、いつ、どれだけ見られたかを把握できます。',
        icon: BarChart3,
      },
      {
        tag: '発信',
        title: 'マイクロフィードバック',
        description:
          '名刺ページを見た人に、|受けた印象を|タグで答えてもらいます。|伝えたいブランドの個性が、|相手にどう|受け取られているかを|確かめられます。',
        icon: MessageSquareHeart,
      },
    ],
  },
  {
    layer: '計測',
    lead: '構築・浸透・発信の3つを、数字で確かめる。',
    features: [
      {
        id: 'feature-score',
        tag: '計測（インナー）',
        title: 'インナースコア＋推移',
        description:
          'インナーサーベイの回答から社内の浸透度をスコア化。推移と、理解度テストとの「知識×共感」ギャップ分析まで、自社だけで完結して追えます。',
        icon: Activity,
      },
      {
        tag: '計測（総合・伴走つき）',
        title: '統合ブランドスコア',
        description:
          'インナーの数字に、|市場調査を含む|アウター（社外からの見え方）を|掛け合わせて|総合スコアに。|結果の解釈と|次の取り組みの検討を含め、|Enterprise プランで|提供します。',
        icon: Activity,
      },
    ],
  },
  {
    layer: 'サポート',
    lead: 'ツールの活用から実践まで、|プロが伴走します。|Enterprise プランで|利用できるサポートを|ご紹介します。',
    features: [
      {
        tag: 'サポート',
        title: 'クリエイティブサポート',
        description:
          'ブランドの方針に沿った|デザインやコンテンツの制作を、|ID INC.が支援します。|ツールで言語化した|"らしさ"を、|制作物として形にします。',
        icon: Headset,
      },
      {
        tag: 'サポート',
        title: 'ID INC. による四半期レビュー',
        description:
          'スコアと現場の動きを四半期ごとに読み解き、次の打ち手まで一緒に決めます。数字を出して終わりにしません。',
        icon: Headset,
      },
      {
        tag: 'サポート',
        title: '市場調査手配',
        description:
          '調査会社の手配から設問設計、集計表の取り込みまで代行。市場での立ち位置を定点で追えるようにします。',
        icon: Headset,
      },
      {
        tag: 'サポート',
        title: 'ブランド研修・ワークショップ',
        description:
          '社員がブランドを自分の言葉で語れるようになるまで、研修とワークショップで伴走します。費用は要件に合わせた個別見積です。',
        icon: Headset,
      },
    ],
  },
]

/* 説明文に「|」で文節の区切りを入れておくと、その単位で折り返す（語の途中で「配／信」などと折れるのを防ぐ）。
   区切りの無い文はそのまま表示する。1つの区切りはスマホ幅の1行（約20字）より短くすること */
function Phrases({ text }: { text: string }) {
  if (!text.includes('|')) return <>{text}</>
  return (
    <>
      {text.split('|').map((p, i) => (
        <span key={i} className="inline-block">
          {p}
        </span>
      ))}
    </>
  )
}

function FeatureCard({ f }: { f: Feature }) {
  return (
    <GlowCard id={f.id} className="p-7">
      <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5">
        <f.icon size={20} className="text-blue-400" />
      </div>
      <div className="mb-2 text-xs font-semibold text-blue-400">{f.tag}</div>
      <h3 className="text-lg font-bold">{f.title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-white/55">
        <Phrases text={f.description} />
      </p>
    </GlowCard>
  )
}

export default function LpFeaturesPage() {
  return (
    <main>
      <PageHero eyebrow="Features" title="ブランドを加速させる機能">
        {/* スマホ幅で「必／要」「支／えます」と語の途中で折れるので、句読点ごとに折り返し単位をまとめる */}
        <span className="inline-block">構築・浸透・発信。</span>
        <span className="inline-block">それぞれの段階に必要な機能を揃え、</span>
        <span className="inline-block">そのすべてを計測が支えます。</span>
      </PageHero>

      <div className="space-y-16 px-6 pb-24">
        {groups.map((g) => (
          <section key={g.layer} className="mx-auto max-w-6xl">
            <div className="mb-6 flex flex-col gap-1 border-b border-white/10 pb-4 sm:flex-row sm:items-baseline sm:justify-between">
              <h2 className="text-2xl font-bold tracking-tight">{g.layer}</h2>
              <p className="text-sm text-white/50">
                <Phrases text={g.lead} />
              </p>
            </div>
            {/* 浸透だけ、進め方を解説したLPへの導線を置く */}
            {g.layer === '浸透' && (
              <p className="-mt-3 mb-6 text-right text-sm text-white/50">
                <Link
                  href="/inner-branding"
                  className="inline-flex min-h-11 items-center gap-1 font-medium text-white/70 underline underline-offset-4 hover:text-white"
                >
                  インナーブランディングの進め方を見る →
                </Link>
              </p>
            )}
            {g.features.length > 0 && (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {g.features.map((f) => (
                  <FeatureCard key={f.title} f={f} />
                ))}
              </div>
            )}

            {/* 「構築」レイヤーには、すぐ試せる無料の構築ツールカードも併置する */}
            {g.layer === '構築' && (
              <div className={g.features.length > 0 ? 'mt-10' : ''}>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {tools.map((t) => (
                    <ToolCard key={t.href} tool={t} />
                  ))}
                </div>
              </div>
            )}
          </section>
        ))}
      </div>

      <FinalCta secondary={{ href: '/plan', label: '料金プランを見る' }} />
    </main>
  )
}
