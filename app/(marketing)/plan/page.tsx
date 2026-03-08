import Link from 'next/link'
import { Check, Minus, ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import { Card } from '@/components/ui/card'

export const metadata: Metadata = {
  title: '料金プラン',
  description: 'branding.bzの料金プラン。Starter・Growth・Enterpriseの3プランをご用意。',
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
      <section className="px-6 py-16 md:py-24 text-center">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-gray-900 mb-4">
            料金プラン
          </h1>
          <p className="text-lg md:text-xl text-gray-700 leading-relaxed max-w-2xl mx-auto">
            チーム規模に合わせて選べる3つのプラン。<br className="hidden sm:block" />
            すべてのプランで主要機能をお使いいただけます。
          </p>
        </div>
      </section>

      {/* プランカード */}
      <section className="bg-white px-6 pb-16 md:pb-24">
        <div className="mx-auto max-w-7xl grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className="relative rounded-2xl overflow-hidden text-center transition-all hover:scale-[1.02] hover:shadow-2xl"
              style={plan.highlight ? {
                background: 'rgba(15, 15, 15, 0.9)',
                backdropFilter: 'blur(12px) saturate(120%)',
                WebkitBackdropFilter: 'blur(12px) saturate(120%)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                boxShadow: '0px 8px 24px 0 rgba(0, 0, 0, 0.2), inset 0px 0px 4px 2px rgba(255, 255, 255, 0.08)',
              } : {
                background: 'rgba(255, 255, 255, 0.12)',
                backdropFilter: 'blur(12px) saturate(120%)',
                WebkitBackdropFilter: 'blur(12px) saturate(120%)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                boxShadow: '0px 8px 24px 0 rgba(12, 74, 110, 0.12), inset 0px 0px 4px 2px rgba(255, 255, 255, 0.15)',
              }}
            >
              {/* リフレクション */}
              <div className="absolute inset-0 pointer-events-none rounded-2xl"
                style={{ background: 'linear-gradient(to left top, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 50%)' }} />
              <div className="absolute inset-0 pointer-events-none rounded-2xl"
                style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 100%)' }} />

              <div className={`relative z-10 p-8 ${plan.highlight ? 'text-white' : ''}`}>
                <p className={`text-sm font-medium mb-1 ${plan.highlight ? 'text-blue-400' : 'text-gray-500'}`}>
                  {plan.subtitle}
                </p>
                <h3 className="text-2xl font-bold mb-4">{plan.name}</h3>

                {plan.price ? (
                  <div className="mb-2">
                    <span className="text-4xl font-bold tracking-tight" style={{ letterSpacing: '-2px' }}>
                      ¥{plan.price}
                    </span>
                    <span className={`text-sm ml-1 ${plan.highlight ? 'text-gray-300' : 'text-gray-500'}`}>/月</span>
                  </div>
                ) : (
                  <div className="mb-2">
                    <span className="text-3xl font-bold">ASK</span>
                  </div>
                )}

                <p className={`text-sm mb-6 ${plan.highlight ? 'text-gray-300' : 'text-gray-500'}`}>
                  {plan.userLimit}
                </p>

                {plan.perUser && (
                  <p className={`text-xs mb-6 ${plan.highlight ? 'text-gray-400' : 'text-gray-400'}`}>
                    1ユーザーあたり ¥{plan.perUser}
                  </p>
                )}

                <Link href="/contact">
                  {plan.highlight ? (
                    <button
                      className="relative w-full h-12 rounded-full text-base font-bold text-white overflow-hidden transition-all hover:scale-105 hover:shadow-2xl"
                      style={{
                        background: 'rgba(37, 99, 235, 0.9)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        boxShadow: '0px 8px 24px 0 rgba(37, 99, 235, 0.3), inset 0px 1px 0px 0px rgba(255, 255, 255, 0.2)',
                      }}
                    >
                      <span className="relative z-10">{plan.price ? 'お申し込み' : 'お問い合わせ'}</span>
                    </button>
                  ) : (
                    <button
                      className="relative w-full h-12 rounded-full text-base font-bold text-white overflow-hidden transition-all hover:scale-105 hover:shadow-2xl"
                      style={{
                        background: 'rgba(0, 0, 0, 0.75)',
                        backdropFilter: 'blur(12px) saturate(120%)',
                        WebkitBackdropFilter: 'blur(12px) saturate(120%)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        boxShadow: '0px 8px 24px 0 rgba(0, 0, 0, 0.2), inset 0px 1px 0px 0px rgba(255, 255, 255, 0.15)',
                      }}
                    >
                      <span className="relative z-10">{plan.price ? 'お申し込み' : 'お問い合わせ'}</span>
                    </button>
                  )}
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* オプション */}
        <div className="mx-auto max-w-7xl mt-8 text-center">
          <p className="text-sm text-gray-500">
            ※ 初期設定サービス：<span className="font-bold">¥30,000</span>（別途）
            <span className="ml-4">※ ブランディングサポート：別途有料オプション</span>
          </p>
        </div>
      </section>

      {/* 機能比較テーブル */}
      <section className="bg-gray-50 px-6 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-xl md:text-[1.625rem] font-bold text-gray-900 mb-10">
            機能比較
          </h2>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-4 px-6 font-medium text-gray-500">機能</th>
                  <th className="py-4 px-4 font-bold text-center">Starter</th>
                  <th className="py-4 px-4 font-bold text-center">Growth</th>
                </tr>
              </thead>
              <tbody>
                {featureRows.map((row, i) => (
                  <tr key={row.label} className={i < featureRows.length - 1 ? 'border-b border-gray-100' : ''}>
                    <td className="py-3 px-6 text-gray-700">{row.label}</td>
                    <td className="py-3 px-4 text-center">
                      {row.starter ? (
                        <Check size={18} className="inline text-green-500" />
                      ) : (
                        <Minus size={18} className="inline text-gray-300" />
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {row.growth ? (
                        <Check size={18} className="inline text-green-500" />
                      ) : (
                        <Minus size={18} className="inline text-gray-300" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="text-center text-xs text-gray-400 mt-4">
            Enterprise プランはすべての機能に加え、カスタマイズ対応が可能です。
          </p>
        </div>
      </section>

      {/* 導入ステップ */}
      <section className="bg-white px-6 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-xl md:text-[1.625rem] font-bold text-gray-900 mb-12">
            かんたん3ステップで導入
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step) => (
              <div key={step.num} className="text-center">
                <div className="w-10 h-10 rounded-full bg-gray-900 text-white font-bold text-sm flex items-center justify-center mx-auto mb-4">
                  {step.num}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-50 px-6 py-16 md:py-24 text-center">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-xl md:text-[1.625rem] font-bold text-gray-900 mb-4">
            無料トライアルのお申し込み
          </h2>
          <p className="text-sm text-gray-600 mb-10">
            利用規約 & プライバシーポリシーをよく読み、お問い合わせフォームよりお申し込みください。
          </p>
          <Link href="/contact">
            <button
              className="relative h-12 px-12 rounded-full text-base font-bold text-white overflow-hidden transition-all hover:scale-105 hover:shadow-2xl"
              style={{
                background: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(12px) saturate(120%)',
                WebkitBackdropFilter: 'blur(12px) saturate(120%)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                boxShadow: '0px 8px 24px 0 rgba(0, 0, 0, 0.2), inset 0px 1px 0px 0px rgba(255, 255, 255, 0.15)',
              }}
            >
              <span className="relative z-10 inline-flex items-center gap-2">
                お問い合わせ
                <ArrowRight className="h-4 w-4" />
              </span>
            </button>
          </Link>
          <p className="mt-6 text-xs text-gray-400">
            ※ 業種業態によっては、ご利用をお断りさせていただく場合がございます。
          </p>
        </div>
      </section>
    </>
  )
}
