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
  Headset,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react'
import { PageHero, GlowCard } from '@/components/lp/ui'

export const metadata: Metadata = {
  title: '機能紹介 | branding.bz',
  description:
    'branding.bz の機能紹介。ブランド掲示・Good Jobタイムライン・KPI・スマート名刺・ブランドスコアなど、ブランドの構築・浸透・発信を支える機能をまとめて紹介します。',
}

type Feature = { title: string; description: string; icon: LucideIcon; tag: string }

const groups: { layer: string; lead: string; features: Feature[] }[] = [
  {
    layer: '構築',
    lead: 'ブランドの"らしさ"を、全社の拠りどころに。',
    features: [
      {
        tag: '構築',
        title: 'ブランド掲示',
        description:
          '方針・戦略・ビジュアルID・バーバルID・提供価値を全社に掲示。いつでも"らしさ"を参照できる、ブランドの拠りどころです。',
        icon: Compass,
      },
    ],
  },
  {
    layer: '浸透',
    lead: '日々の行動と数字で、ブランドを根づかせる。',
    features: [
      {
        tag: '浸透',
        title: 'ダッシュボード',
        description:
          '投稿数・行動指針別の割合・KPI進捗を期間フィルター付きで表示。チームのブランド浸透度が、数字で見えるようになります。',
        icon: LayoutDashboard,
      },
      {
        tag: '浸透',
        title: 'Good Job タイムライン',
        description:
          '行動指針に基づいた取り組みを、写真付きで手軽にシェア。いいね・コメントで称え合い、ブランドを体現する文化を育てます。',
        icon: MessageSquareHeart,
      },
      {
        tag: '浸透',
        title: '個人目標と KPI',
        description:
          'ブランド行動指針に紐づく個人目標を設定し、達成状況を管理。重み付け・達成時期で、優先順位を見える化します。',
        icon: Milestone,
      },
      {
        tag: '浸透',
        title: 'お知らせ',
        description:
          '社内イベントやブランド戦略の進捗を、タイムライン形式で全員に配信。いいね機能付きで、情報共有と反応が一か所にまとまります。',
        icon: Bell,
      },
      {
        tag: '浸透',
        title: 'ブランドスコア',
        description:
          '社員サーベイと名刺の行動データを統合し、ブランド浸透度をスコア化。部署別ヒートマップやギャップ分析で「どこに手を打つべきか」が見えます。',
        icon: Activity,
      },
    ],
  },
  {
    layer: '発信',
    lead: '社内で根づいた"らしさ"を、社外へ届ける。',
    features: [
      {
        tag: '発信',
        title: 'スマート名刺',
        description:
          'QRコードからプロフィール＋企業ブランドページを表示。ブランドカラーが自動適用され、名刺交換がブランド体験に変わります。',
        icon: CreditCard,
      },
      {
        tag: '発信',
        title: '効果計測',
        description:
          '名刺の閲覧数・閲覧トレンド・メンバー別ランキングを自動集計。誰の名刺が、いつ、どれだけ見られたかを把握できます。',
        icon: BarChart3,
      },
    ],
  },
  {
    layer: 'サポート',
    lead: 'ツールだけで終わらせない、プロの伴走。',
    features: [
      {
        tag: 'サポート',
        title: 'ブランディングサポート',
        description:
          'ブランド構築の専門サポートをオプションで提供。戦略策定からデザイン制作まで、ID INC. のプロが伴走します。',
        icon: Headset,
      },
    ],
  },
]

function FeatureCard({ f }: { f: Feature }) {
  return (
    <GlowCard className="p-7">
      <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5">
        <f.icon size={20} className="text-blue-400" />
      </div>
      <div className="mb-2 text-xs font-semibold text-blue-400">{f.tag}</div>
      <h3 className="text-lg font-bold">{f.title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-white/55">{f.description}</p>
    </GlowCard>
  )
}

export default function LpFeaturesPage() {
  return (
    <main>
      <PageHero eyebrow="Features" title="ブランドを加速させる機能">
        構築・浸透・発信。ブランドの旅路を、必要な機能でまるごと支えます。
      </PageHero>

      <div className="space-y-16 px-6 pb-24">
        {groups.map((g) => (
          <section key={g.layer} className="mx-auto max-w-6xl">
            <div className="mb-6 flex flex-col gap-1 border-b border-white/10 pb-4 sm:flex-row sm:items-baseline sm:justify-between">
              <h2 className="text-2xl font-bold tracking-tight">{g.layer}</h2>
              <p className="text-sm text-white/50">{g.lead}</p>
            </div>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {g.features.map((f) => (
                <FeatureCard key={f.title} f={f} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* CTA */}
      <section className="px-6 pb-24 text-center">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          必要なすべてを、ひとつのプラットフォームに。
        </h2>
        <p className="mt-6 text-lg text-white/60">まずは無料で、ブランディングの第一歩を。</p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-8 text-base font-semibold text-black transition-transform hover:scale-105"
          >
            無料で始める <ArrowRight size={18} />
          </Link>
          <Link
            href="/plan"
            className="inline-flex h-12 items-center rounded-full border border-white/15 bg-white/5 px-8 text-base font-semibold text-white transition-colors hover:bg-white/10"
          >
            料金プランを見る
          </Link>
        </div>
      </section>
    </main>
  )
}
