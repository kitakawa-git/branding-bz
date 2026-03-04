import Link from 'next/link'
import type { Metadata } from 'next'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

export const metadata: Metadata = {
  title: 'よくある質問',
  description: 'brandconnectに関するよくある質問と回答。料金・機能・導入方法について。',
}

const faqCategories = [
  {
    title: 'サービスについて',
    items: [
      {
        q: 'brandconnect とはどんなサービスですか？',
        a: 'brandconnect は、中小企業のブランドを「構築→浸透→発信」まで一貫支援するSaaSです。AIを活用したブランド構築ミニアプリ群、社内浸透のための本体アプリ（Good Jobタイムライン・ダッシュボード・KPI管理等）、そしてスマート名刺による社外発信を提供します。',
      },
      {
        q: 'どのような企業に向いていますか？',
        a: 'ブランドの構築・浸透に課題を感じている中小企業（5〜200名規模）に最適です。「ブランドを作ったけど社内に浸透しない」「発信にまとまりがない」といったお悩みを解決します。',
      },
      {
        q: 'ブランディングの専門知識がなくても使えますか？',
        a: 'はい。AIがブランド構築をガイドするミニアプリを提供しており、専門知識がなくてもプロ品質のブランドアイデンティティを策定できます。また、別途ブランディングサポートオプションもご用意しています。',
      },
    ],
  },
  {
    title: '料金・プランについて',
    items: [
      {
        q: '無料トライアルはありますか？',
        a: 'はい。βテスター企業として無料で最新バージョンをお試しいただけます。お問い合わせフォームよりお申し込みください。',
      },
      {
        q: 'プランの違いは何ですか？',
        a: 'Starter（¥7,800/月・20名まで）は主要機能をすべてご利用いただけます。Growth（¥64,800/月・200名まで）では初回入力代行・ブランディングサポート・デザイン相談などのオプションが追加されます。Enterprise は御社向けにカスタマイズ対応します。',
      },
      {
        q: '途中でプラン変更できますか？',
        a: 'はい。いつでもアップグレード・ダウングレードが可能です。変更は翌月から適用されます。',
      },
      {
        q: '初期費用はかかりますか？',
        a: '初期設定サービス（¥30,000・別途）をご利用いただけますが、必須ではありません。ご自身でセットアップいただくことも可能です。',
      },
    ],
  },
  {
    title: '機能について',
    items: [
      {
        q: 'Good Job タイムラインとは何ですか？',
        a: '行動指針に基づいた行動を社内で手軽にシェアし、互いに称え合うタイムライン機能です。いいね・コメント・匿名投稿にも対応しており、ブランドの「らしさ」をチーム全体で共有する文化を醸成します。',
      },
      {
        q: 'スマート名刺とは何ですか？',
        a: 'QRコードから個人プロフィールと企業ブランドの簡易ページを表示するデジタル名刺です。印刷用の高解像度QRコードもワンクリックでダウンロードでき、名刺交換の瞬間がブランド体験になります。',
      },
      {
        q: 'ダッシュボードではどんな情報が見られますか？',
        a: '行動指針別の投稿数、KPI進捗、利用率、タイムライン連続投稿記録など、ブランド浸透度をリアルタイムで確認できます。期間フィルターで特定期間の成果も把握可能です。',
      },
    ],
  },
  {
    title: '導入・セキュリティについて',
    items: [
      {
        q: '導入にどのくらい時間がかかりますか？',
        a: 'お申し込みから最短即日でご利用開始いただけます。管理者アカウント発行→初期情報入力→メンバー招待の3ステップで導入完了です。',
      },
      {
        q: 'データのセキュリティは大丈夫ですか？',
        a: 'SSL暗号化通信、サーバーサイドの認証・認可、データベースのアクセス制御により、セキュリティを確保しています。',
      },
      {
        q: '解約はいつでもできますか？',
        a: 'はい。月単位でいつでも解約可能です。解約後もデータは一定期間保持されます。',
      },
    ],
  },
]

export default function FAQPage() {
  return (
    <>
      {/* ヒーロー */}
      <section className="bg-white px-6 pt-20 pb-12 text-center">
        <h1 className="font-comfortaa text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          よくある質問
        </h1>
        <p className="text-lp-gray max-w-[480px] mx-auto">
          brandconnect についてよくいただくご質問にお答えします。
        </p>
      </section>

      {/* FAQ本体 */}
      <section className="bg-white px-6 pb-20">
        <div className="max-w-[800px] mx-auto space-y-12">
          {faqCategories.map((category) => (
            <div key={category.title}>
              <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                {category.title}
              </h2>
              <Accordion type="single" collapsible className="w-full">
                {category.items.map((item, i) => (
                  <AccordionItem key={i} value={`${category.title}-${i}`}>
                    <AccordionTrigger className="text-left text-sm font-medium text-gray-900 hover:no-underline">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-lp-gray leading-relaxed">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-lp-gray-bg px-6 py-16 text-center">
        <p className="text-lp-gray mb-6">
          ご不明な点がございましたら、お気軽にお問い合わせください。
        </p>
        <Link
          href="/contact"
          className="inline-flex items-center h-12 px-8 text-sm font-bold text-white bg-gray-900 rounded-full hover:opacity-80 transition-opacity"
        >
          お問い合わせ
        </Link>
      </section>
    </>
  )
}
