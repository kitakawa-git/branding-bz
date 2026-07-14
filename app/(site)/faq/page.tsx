import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { PageHero } from '@/components/lp/ui'
import FaqItem from '@/components/lp/FaqItem'

export const metadata: Metadata = {
  title: 'よくある質問 | branding.bz',
  description:
    'branding.bz に関するよくある質問と回答。料金プラン・機能・ブランドスコア・スマート名刺・導入方法について。',
  alternates: {
    canonical: '/faq',
  },
  openGraph: {
    title: 'よくある質問 | branding.bz',
    description:
      'branding.bz に関するよくある質問と回答。料金プラン・機能・ブランドスコア・スマート名刺・導入方法について。',
    url: 'https://branding.bz/faq',
  },
}

const faqCategories = [
  {
    title: 'サービスについて',
    items: [
      {
        q: 'branding.bz とはどんなサービスですか？',
        a: 'branding.bz は、中小企業のブランドを「構築→浸透→発信」まで一貫支援するSaaSです。AIを活用したブランド構築ツール（カラー定義・STP分析等）、社内浸透プラットフォーム（ブランド掲示・Good Jobタイムライン・KPI管理・インナーサーベイ等）、スマート名刺による社外発信、そしてブランドスコアによる浸透度の定量化までをワンストップで提供します。',
      },
      {
        q: 'どのような企業に向いていますか？',
        a: 'ブランドの構築・浸透に課題を感じている中小企業（5〜300名規模）に最適です。「ブランドを作ったけど社内に浸透しない」「社外への発信にまとまりがない」「浸透度を数字で把握したい」といったお悩みを解決します。',
      },
      {
        q: 'ブランディングの専門知識がなくても使えますか？',
        a: 'はい。AIがブランド構築をガイドする無料ツール（ブランドカラー定義・STP分析等）を提供しており、専門知識がなくてもプロ品質のブランドアイデンティティを策定できます。また、ID INC. のブランディング専門家によるサポートオプションもご用意しています。',
      },
    ],
  },
  {
    title: '料金・プランについて',
    items: [
      {
        q: '無料で使えますか？',
        a: 'はい。Freeプランでは、AIブランディングツール（月3回・5ターンまで）を無料でご利用いただけます。生成結果の画面上確認も可能です。PDF出力や本体連携をご利用の場合は、Brand Standard以上のプランが必要です。',
      },
      {
        q: 'プランの違いは何ですか？',
        a: '4つのプランをご用意しています。Free（¥0）はAIツールの体験、Brand Card（¥4,980/月）はスマート名刺による社外発信、Brand Standard（¥19,800/月）はAI無制限＋ブランド構築＋発信、Brand Premium（¥59,800/月）は構築＋浸透＋発信＋ブランドスコアによる計測まで全機能をご利用いただけます。詳しくは料金ページをご確認ください。',
      },
      {
        q: '途中でプラン変更できますか？',
        a: 'はい。いつでもアップグレード・ダウングレードが可能です。変更は翌月から適用されます。',
      },
      {
        q: '初期費用はかかりますか？',
        a: 'いいえ。すべてのプランで初期費用は無料です。月額料金のみでご利用いただけます。',
      },
    ],
  },
  {
    title: '機能について',
    items: [
      {
        q: '無料ツール（ミニアプリ）とは何ですか？',
        a: 'ブランドカラー定義やSTP分析など、AIがブランド構築をガイドする無料のWebツールです。対話形式で進めるだけで、カラーパレットやターゲット戦略・ポジショニングマップを策定できます。Freeプランでも月3回までご利用いただけます。',
      },
      {
        q: 'ブランドスコアとは何ですか？',
        a: '社員サーベイ（インナースコア）とスマート名刺の行動データ（アウタースコア）を統合し、ブランド浸透度を0〜100で数値化する機能です。部署別ヒートマップやギャップ分析で「どこに手を打つべきか」が見えます。Brand Premiumプランでご利用いただけます。',
      },
      {
        q: 'Good Jobタイムラインとは何ですか？',
        a: '行動指針に基づいた取り組みを社内で手軽にシェアし、互いに称え合うタイムライン機能です。いいね・コメントに対応しており、ブランドを体現する文化を育てます。Brand Premiumプランでご利用いただけます。',
      },
      {
        q: 'スマート名刺とは何ですか？',
        a: 'QRコードから社員プロフィール＋企業ブランドページを表示するデジタル名刺です。閲覧数やアウタースコアで効果を測定でき、閲覧者からの印象タグ（マイクロフィードバック）も収集できます。Brand Card以上のプランでご利用いただけます。',
      },
      {
        q: 'ダッシュボードではどんな情報が見られますか？',
        a: '行動指針別の投稿数、KPI進捗、利用率をリアルタイムで確認できます。Brand Premiumプランでは、ブランドスコアの推移グラフ・部署別ヒートマップ・ギャップ分析も閲覧可能です。',
      },
    ],
  },
  {
    title: '導入・セキュリティについて',
    items: [
      {
        q: '導入にどのくらい時間がかかりますか？',
        a: 'お申し込みから最短即日でご利用開始いただけます。管理者アカウント発行→ブランド基本情報入力→メンバー招待の3ステップで導入完了です。',
      },
      {
        q: 'データのセキュリティは大丈夫ですか？',
        a: 'SSL暗号化通信、サーバーサイドの認証・認可、データベースのアクセス制御により、セキュリティを確保しています。インナーサーベイの回答は完全匿名で保存され、個人の回答内容を特定することはできない設計です。',
      },
      {
        q: '解約はいつでもできますか？',
        a: 'はい。月単位でいつでも解約可能です。解約後もデータは一定期間保持されます。',
      },
    ],
  },
]

export default function LpFaqPage() {
  return (
    <main>
      <PageHero eyebrow="FAQ" title="よくある質問">
        branding.bz についてよくいただくご質問にお答えします。
      </PageHero>

      <section className="px-6 pb-24">
        <div className="mx-auto max-w-3xl space-y-12">
          {faqCategories.map((category) => (
            <div key={category.title}>
              <h2 className="mb-4 border-b border-white/10 pb-3 text-lg font-bold">
                {category.title}
              </h2>
              <div className="space-y-3">
                {category.items.map((item, i) => (
                  <FaqItem key={i} q={item.q} a={item.a} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-24 text-center">
        <p className="mb-8 text-sm text-white/55">
          ご不明な点がございましたら、お気軽にお問い合わせください。
        </p>
        <Link
          href="/contact"
          className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-8 text-base font-semibold text-black transition-transform hover:scale-105"
        >
          お問い合わせ <ArrowRight size={18} />
        </Link>
      </section>
    </main>
  )
}
