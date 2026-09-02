import type { Metadata } from 'next'
import { PageHero } from '@/components/lp/ui'

export const metadata: Metadata = {
  title: '特定商取引法に基づく表記',
  description: 'branding.bz の特定商取引法に基づく表記です。',
  alternates: {
    canonical: '/tokusho',
  },
  openGraph: {
    title: '特定商取引法に基づく表記 | branding.bz',
    description: 'branding.bz の特定商取引法に基づく表記です。',
    url: 'https://branding.bz/tokusho',
  },
}

const rows = [
  {
    label: '販売業者',
    value: 'ID株式会社',
  },
  {
    label: '代表者名',
    value: '北川 巧',
  },
  {
    label: '所在地',
    value: '神奈川県川崎市高津区久本3-6-7-303',
  },
  {
    label: '電話番号',
    value: '044-281-3088',
    link: 'tel:0442813088',
  },
  {
    label: 'メールアドレス',
    value: 'bz@include.bz',
    link: 'mailto:bz@include.bz',
  },
  {
    label: 'サービス名',
    value: 'branding.bz（ブランディングビズ）',
  },
  {
    label: '販売価格',
    value: '各料金プランページに記載のとおりです。表示価格は税別で、別途消費税を申し受けます。',
    href: '/plan',
    hrefLabel: '料金プランを見る',
  },
  {
    label: '支払方法',
    value: 'クレジットカード（Visa・Mastercard・American Express・JCB）',
  },
  {
    label: '支払時期',
    value: '月次（契約開始日を起算日として毎月自動更新・自動決済）',
  },
  {
    label: 'サービス提供時期',
    value: '利用登録完了後、直ちにご利用いただけます。',
  },
  {
    label: '無料トライアル',
    value: '無料プランの範囲内でご利用いただけます。有料プランへの変更はユーザーの任意によります。',
  },
  {
    label: 'キャンセル・解約について',
    value: 'マイページより月次契約をいつでも解約できます。解約は次回更新日をもって有効となり、解約月の日割り返金は行いません。',
  },
  {
    label: '返品・返金について',
    value: 'デジタルサービスの性質上、原則として返品・返金はお受けできません。ただし、当社の責に帰すべき事由によるサービス障害が生じた場合は、個別に対応いたします。',
  },
  {
    label: '動作環境',
    value: '最新バージョンのGoogle Chrome・Safari・Firefox・Microsoft Edgeを推奨します。インターネット接続環境が必要です。',
  },
]

export default function TokushoPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="特定商取引法に基づく表記">最終更新日：2026年3月10日</PageHero>

      {/* テーブル */}
      <section className="px-6 pt-6 pb-16 md:pb-24">
        <div className="mx-auto max-w-4xl">
        <div className="border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.label}
                  className={i % 2 === 0 ? 'bg-transparent' : 'bg-white/5'}
                >
                  <th className="w-40 md:w-52 px-5 py-4 text-left font-semibold text-white/80 align-top whitespace-nowrap border-b border-white/10">
                    {row.label}
                  </th>
                  <td className="px-5 py-4 text-white/70 leading-relaxed border-b border-white/10">
                    {row.link ? (
                      <a href={row.link} className="text-blue-400 hover:text-blue-300 hover:underline">
                        {row.value}
                      </a>
                    ) : (
                      <>
                        {row.value}
                        {row.href && (
                          <a href={row.href} className="ml-3 text-blue-400 hover:text-blue-300 hover:underline text-xs">
                            {row.hrefLabel} →
                          </a>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-8 text-xs text-white/40 leading-relaxed">
          ※ 本表記は特定商取引に関する法律第11条に基づき掲載しています。
          お問い合わせは <a href="mailto:bz@include.bz" className="text-blue-400 hover:text-blue-300 hover:underline">bz@include.bz</a> までご連絡ください。
        </p>
        </div>
      </section>
    </>
  )
}
