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
        a: 'branding.bz は、中小企業のブランドを「構築→浸透→発信」まで一貫支援するSaaSです。AIを活用した構築ツール（ブランドカラー定義・STP分析等）、社内浸透プラットフォーム（ブランド掲示・Good Action投稿・目標・KPI管理・インナーサーベイ等）、スマート名刺による社外発信、そしてブランドスコアによる浸透度の定量化までをワンストップで提供します。',
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
        a: 'はい。Freeプランでは、AI構築ツール（各ツール 月3回まで）を無料でご利用いただけます。生成結果の画面上確認も可能です。PDF出力や本体連携をご利用の場合は、Standard以上のプランが必要です。',
      },
      {
        q: 'プランの違いは何ですか？',
        a: 'Free（¥0）はAI構築ツールの体験とブランド掲示の編集、Standard（¥19,800/月）はAI構築ツール使用無制限＋Good Action投稿・お知らせ配信＋スマート名刺による発信、Premium（¥59,800/月）はビデオラーニング・ブランド理解度テスト・目標・KPI管理・ブランドスコア（簡易版）など社内浸透の全機能をご利用いただけます。インナーサーベイと統合ブランドスコアによる計測は、結果の解釈と打ち手をセットでご提供するため Enterprise（個別見積）でのご提供です。詳しくは料金ページをご確認ください。',
      },
      {
        q: '想定規模より少ない人数でも上位プランを契約できますか？',
        a: 'はい。想定規模はあくまで目安です。たとえば5〜9名の企業でも Standard をご契約いただけます。メンバー上限（Free 5名／Standard 50名／Premium 300名／Enterprise 無制限）だけが規模による制限です。',
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
        q: '無料の構築ツールとは何ですか？',
        a: 'ブランドカラー定義やSTP分析など、AIがブランド構築をガイドする無料のWebツールです。ブランドカラー定義ツールの調整チャットは、1セッションあたり5ターンまでです（全プラン共通）。対話形式で進めるだけで、カラーパレットやターゲット戦略・ポジショニングマップを策定できます。Freeプランでも各ツール 月3回までご利用いただけます。',
      },
      {
        q: 'ブランドスコアとは何ですか？',
        a: 'ブランド浸透度を0〜100で数値化する機能です。Premium プランの「ブランドスコア（簡易版）」では、スマート名刺・ブランドページの行動データ（アウタースコア）を確認できます。インナーサーベイと統合した「統合ブランドスコア」、スコア推移の自動記録、ギャップ分析は、結果の解釈と打ち手をセットでご提供するため、四半期の伴走レビューが付く Enterprise プランでのご提供です。',
      },
      {
        q: 'Good Action投稿とは何ですか？',
        a: '行動指針に基づいた取り組みを社内で手軽にシェアし、互いに称え合うタイムライン機能です。いいね・コメントに対応しており、ブランドを体現する文化を育てます。Standard以上のプランでご利用いただけます。',
      },
      {
        q: 'スマート名刺とは何ですか？',
        a: 'QRコードから社員プロフィール＋企業ブランドページを表示するデジタル名刺です。閲覧数やアウタースコアで効果を測定でき、閲覧者からの印象タグ（マイクロフィードバック）も収集できます。Standard以上のプランでご利用いただけます。',
      },
      {
        q: 'ダッシュボードではどんな情報が見られますか？',
        a: '行動指針別の投稿数、KPI進捗、利用率をリアルタイムで確認できます。Enterpriseプランでは、ブランドスコアの推移グラフ・ギャップ分析も閲覧可能です。',
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
