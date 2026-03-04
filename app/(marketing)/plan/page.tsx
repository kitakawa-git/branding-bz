import Link from 'next/link'
import { Check, Minus } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '料金プラン',
  description: 'brandconnectの料金プラン。Starter・Growth・Enterpriseの3プランをご用意。',
}

/* ─── プラン定義 ─── */
const plans = [
  {
    name: 'Starter',
    subtitle: 'スタートアップ向き',
    price: '7,800',
    perUser: '390',
    userLimit: '20ユーザーまで',
    highlight: false,
  },
  {
    name: 'Growth',
    subtitle: '中小企業向き',
    price: '64,800',
    perUser: '324',
    userLimit: '200ユーザーまで',
    highlight: true,
  },
  {
    name: 'Enterprise',
    subtitle: 'カスタマイズプラン',
    price: null,
    perUser: null,
    userLimit: '御社向けにカスタマイズ',
    highlight: false,
  },
]

const featureRows = [
  { label: 'ブランド方針掲示', starter: true, growth: true },
  { label: 'ビジュアル/バーバルID管理', starter: true, growth: true },
  { label: 'Good Job タイムライン', starter: true, growth: true },
  { label: 'いいね・コメント機能', starter: true, growth: true },
  { label: '匿名投稿機能', starter: true, growth: true },
  { label: '画像添付機能', starter: true, growth: true },
  { label: '個人目標 & KPI', starter: true, growth: true },
  { label: 'ダッシュボード', starter: true, growth: true },
  { label: '効果計測（利用率・投稿分類）', starter: true, growth: true },
  { label: 'お知らせ配信', starter: true, growth: true },
  { label: 'スマート名刺', starter: true, growth: true },
  { label: 'QRコード一括ダウンロード', starter: true, growth: true },
  { label: '初回入力代行', starter: false, growth: true },
  { label: 'ブランディングサポート', starter: false, growth: true },
  { label: 'ロゴやデザイン相談', starter: false, growth: true },
  { label: 'ブランド構築セミナー', starter: false, growth: true },
]

/* ─── 導入ステップ ─── */
const steps = [
  {
    num: '1',
    title: 'お申し込み',
    description: 'フォームからお申し込み。管理者アカウントを発行します。',
  },
  {
    num: '2',
    title: '初期情報を入力',
    description: '管理画面にログインし、企業情報やブランド方針を入力します。',
  },
  {
    num: '3',
    title: 'メンバー招待',
    description: 'メンバーに招待メールを自動送信。チームでの運用が始まります。',
  },
]

export default function PlanPage() {
  return (
    <>
      {/* ヒーロー */}
      <section className="bg-white px-6 pt-20 pb-12 text-center">
        <h1 className="font-comfortaa text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          料金プラン
        </h1>
        <p className="text-lp-gray max-w-[480px] mx-auto">
          チーム規模に合わせて選べる3つのプラン。<br />
          すべてのプランで主要機能をお使いいただけます。
        </p>
      </section>

      {/* プランカード */}
      <section className="bg-white px-6 pb-20">
        <div className="max-w-[1000px] mx-auto grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-8 text-center ${
                plan.highlight
                  ? 'bg-gray-900 text-white ring-2 ring-teal shadow-xl'
                  : 'bg-lp-gray-bg border border-gray-200'
              }`}
            >
              <p className={`text-sm font-medium mb-1 ${plan.highlight ? 'text-teal' : 'text-lp-gray'}`}>
                {plan.subtitle}
              </p>
              <h3 className="font-comfortaa text-2xl font-bold mb-4">{plan.name}</h3>

              {plan.price ? (
                <div className="mb-2">
                  <span className="text-4xl font-bold tracking-tight" style={{ letterSpacing: '-2px' }}>
                    ¥{plan.price}
                  </span>
                  <span className={`text-sm ml-1 ${plan.highlight ? 'text-gray-300' : 'text-lp-gray'}`}>/月</span>
                </div>
              ) : (
                <div className="mb-2">
                  <span className="text-3xl font-bold">ASK</span>
                </div>
              )}

              <p className={`text-sm mb-6 ${plan.highlight ? 'text-gray-300' : 'text-lp-gray'}`}>
                {plan.userLimit}
              </p>

              {plan.perUser && (
                <p className={`text-xs mb-6 ${plan.highlight ? 'text-gray-400' : 'text-lp-gray-light'}`}>
                  1ユーザーあたり ¥{plan.perUser}
                </p>
              )}

              <Link
                href="/contact"
                className={`inline-flex items-center justify-center w-full h-12 rounded-full font-bold text-sm transition-opacity hover:opacity-80 ${
                  plan.highlight ? 'bg-teal text-white' : 'bg-gray-900 text-white'
                }`}
              >
                {plan.price ? 'お申し込み' : 'お問い合わせ'}
              </Link>
            </div>
          ))}
        </div>

        {/* オプション */}
        <div className="max-w-[1000px] mx-auto mt-10 text-center">
          <p className="text-sm text-lp-gray">
            ※ 初期設定サービス：<span className="font-bold">¥30,000</span>（別途）
            <span className="ml-4">※ ブランディングサポート：別途有料オプション</span>
          </p>
        </div>
      </section>

      {/* 機能比較テーブル */}
      <section className="bg-lp-gray-bg px-6 py-20">
        <div className="max-w-[800px] mx-auto">
          <h2 className="font-comfortaa text-center text-2xl font-bold text-gray-900 mb-10">
            機能比較
          </h2>
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-4 px-6 font-medium text-lp-gray">機能</th>
                  <th className="py-4 px-4 font-bold text-center">Starter</th>
                  <th className="py-4 px-4 font-bold text-center">Growth</th>
                </tr>
              </thead>
              <tbody>
                {featureRows.map((row, i) => (
                  <tr key={row.label} className={i < featureRows.length - 1 ? 'border-b border-gray-100' : ''}>
                    <td className="py-3 px-6 text-lp-gray-dark">{row.label}</td>
                    <td className="py-3 px-4 text-center">
                      {row.starter ? (
                        <Check size={18} className="inline text-teal" />
                      ) : (
                        <Minus size={18} className="inline text-gray-300" />
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {row.growth ? (
                        <Check size={18} className="inline text-teal" />
                      ) : (
                        <Minus size={18} className="inline text-gray-300" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-center text-xs text-lp-gray-light mt-4">
            Enterprise プランはすべての機能に加え、カスタマイズ対応が可能です。
          </p>
        </div>
      </section>

      {/* 導入ステップ */}
      <section className="bg-white px-6 py-20">
        <div className="max-w-[800px] mx-auto">
          <h2 className="font-comfortaa text-center text-2xl font-bold text-gray-900 mb-12">
            かんたん3ステップで導入
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step) => (
              <div key={step.num} className="text-center">
                <div className="w-12 h-12 rounded-full bg-teal/10 text-teal font-comfortaa font-bold text-lg flex items-center justify-center mx-auto mb-4">
                  {step.num}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-lp-gray leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-lp-gray-bg px-6 py-20 text-center">
        <div className="max-w-[600px] mx-auto">
          <h2 className="font-comfortaa text-2xl font-bold text-gray-900 mb-4">
            無料トライアルのお申し込み
          </h2>
          <p className="text-sm text-lp-gray mb-8">
            利用規約 & プライバシーポリシーをよく読み、お問い合わせフォームよりお申し込みください。
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center h-14 px-10 text-base font-bold text-white bg-gray-900 rounded-full hover:opacity-80 transition-opacity"
          >
            お問い合わせ
          </Link>
          <p className="mt-6 text-xs text-lp-gray-light">
            ※ 業種業態によっては、ご利用をお断りさせていただく場合がございます。
          </p>
        </div>
      </section>
    </>
  )
}
