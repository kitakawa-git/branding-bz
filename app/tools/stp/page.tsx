'use client'

// STP分析ツール ランディングページ
import Link from 'next/link'
import { Sparkles, LayoutGrid, Target, MapPin, ArrowRight, CheckCircle2, Lightbulb, SlidersHorizontal, Download, Unplug } from 'lucide-react'
import Footer from '@/components/Footer'

const STP_CARDS = [
  {
    label: 'S（Segmentation）',
    icon: LayoutGrid,
    title: '市場を細分化する',
    description: '顧客の特性や行動パターンから、市場を意味のあるグループに分類します。',
  },
  {
    label: 'T（Targeting）',
    icon: Target,
    title: '狙う市場を決める',
    description: 'セグメントを評価し、自社が最も価値を提供できるターゲットを選定します。',
  },
  {
    label: 'P（Positioning）',
    icon: MapPin,
    title: '独自のポジションを築く',
    description: '競合との差別化ポイントを明確にし、ポジショニングマップで可視化します。',
  },
]

const STEPS = [
  { icon: '1', title: '基本情報', description: '業種や商品、競合など基本的な情報を入力' },
  { icon: '2', title: 'セグメンテーション', description: 'AIが業種に最適な市場の分け方を提案' },
  { icon: '3', title: 'ターゲティング', description: '各セグメントを評価して狙う市場を決定' },
  { icon: '4', title: 'ポジショニング', description: 'スライダーで自社と競合をマップ上に配置' },
  { icon: '5', title: '確認・出力', description: '分析シートとマップをPDF出力・本体連携' },
]

const HIGHLIGHTS = [
  {
    label: 'AI提案',
    icon: Lightbulb,
    title: ['AI自動', 'セグメント提案'],
    description: '業種や商品特性をもとに、最適なセグメント変数をAIが自動提案。市場分析を大幅に短縮します。',
  },
  {
    label: 'マップ',
    icon: SlidersHorizontal,
    title: ['インタラクティブ', 'ポジショニングマップ'],
    description: 'スライダーで直感的に自社・競合をマップ上に配置。ポジショニングの空白地帯が一目でわかります。',
  },
  {
    label: '出力',
    icon: Download,
    title: ['PDF・画像を', 'ワンクリック出力'],
    description: '分析結果をPDFでワンクリックダウンロード。ポジショニングマップも画像で保存できます。',
  },
  {
    label: '連携',
    icon: Unplug,
    title: ['ワンクリックで', 'branding.bz に連携'],
    description: '確定したSTP分析をブランディングプラットフォームに登録。ブランド戦略に即反映。',
  },
]

export default function STPLandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ロゴ（独立レイヤー: mix-blend-mode: difference で背景色に応じて自動反転） */}
      <div
        className="fixed top-0 left-0 right-0 z-50 pointer-events-none"
        style={{ mixBlendMode: 'difference' }}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center px-6">
          <Link href="/" className="text-lg font-bold text-white no-underline hover:opacity-80 pointer-events-auto">
            branding.bz
          </Link>
        </div>
      </div>

      {/* ヘッダー */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-transparent">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="text-lg font-bold opacity-0">branding.bz</Link>
          <Link href="/tools/stp/auth">
            <button
              className="relative h-8 px-4 rounded-full text-sm font-semibold text-gray-900 overflow-hidden transition-all hover:scale-105 hover:shadow-lg"
              style={{
                background: 'rgba(255, 255, 255, 0.25)',
                backdropFilter: 'blur(12px) saturate(120%)',
                WebkitBackdropFilter: 'blur(12px) saturate(120%)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                boxShadow: '0px 4px 12px 0 rgba(12, 74, 110, 0.08), inset 0px 1px 0px 0px rgba(255, 255, 255, 0.3)',
              }}
            >
              <span className="relative z-10">ログイン</span>
            </button>
          </Link>
        </div>
      </header>

      {/* ヒーロー */}
      <section className="mx-auto max-w-7xl px-6 py-16 text-center md:py-24">
        <div
          className="mb-8 inline-flex items-center gap-2 rounded-full px-6 py-1.5 text-sm text-blue-700 relative overflow-hidden"
          style={{
            background: 'rgba(0, 97, 255, 0.1)',
            backdropFilter: 'blur(12px) saturate(120%)',
            WebkitBackdropFilter: 'blur(12px) saturate(120%)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0px 8px 24px 0 rgba(12, 74, 110, 0.15), inset 0px 0px 4px 2px rgba(255, 255, 255, 0.2)',
          }}
        >
          <div className="absolute inset-0 pointer-events-none rounded-full"
            style={{ background: 'linear-gradient(to left top, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 50%)' }} />
          <Sparkles className="h-4 w-4 relative z-10" />
          <span className="relative z-10">AIガイドで約10〜15分</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 md:text-5xl">
          STP分析ツール
        </h1>
        <p className="mt-6 mx-auto max-w-2xl text-[20px] text-gray-600 leading-relaxed">
          市場をどう分け、誰を狙い、どう差別化するか。
          <br />
          AIがあなたのSTP戦略を、分析からマップ作成までサポートします。
        </p>
        <div className="mt-10">
          <Link href="/tools/stp/auth">
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
              <span className="relative z-10">無料でSTP分析を始める</span>
            </button>
          </Link>
        </div>
      </section>

      {/* STP分析とは？ */}
      <section className="bg-gray-50 px-6 py-12 md:py-16">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-xl md:text-[1.625rem] font-bold text-gray-900 mb-8">
            STP分析とは？
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {STP_CARDS.map((card) => (
              <div
                key={card.label}
                className="relative rounded-2xl overflow-hidden transition-all hover:scale-[1.02] hover:shadow-2xl"
                style={{
                  background: 'rgba(255, 255, 255, 0.7)',
                  backdropFilter: 'blur(12px) saturate(120%)',
                  WebkitBackdropFilter: 'blur(12px) saturate(120%)',
                  border: '1px solid rgba(255, 255, 255, 0.8)',
                  boxShadow: '0px 8px 24px 0 rgba(12, 74, 110, 0.12), inset 0px 0px 4px 2px rgba(255, 255, 255, 0.15)',
                }}
              >
                {/* リフレクションハイライト */}
                <div
                  className="absolute inset-0 pointer-events-none rounded-2xl"
                  style={{ background: 'linear-gradient(to left top, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 50%)' }}
                />
                <div
                  className="absolute inset-0 pointer-events-none rounded-2xl"
                  style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 100%)' }}
                />
                {/* カードコンテンツ */}
                <div className="relative z-10 p-8">
                  <div className="mb-5">
                    <span className="text-sm font-semibold tracking-wide text-gray-700">
                      {card.label}
                    </span>
                  </div>
                  <div className="mb-4">
                    <card.icon size={32} strokeWidth={1.5} className="text-foreground" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3">
                    {card.title}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{card.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ステップ説明 */}
      <section className="bg-white px-6 py-16 md:py-24">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-12 text-center text-xl md:text-[1.625rem] font-bold text-gray-900">
            5ステップでSTP分析を完了
          </h2>
          <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:gap-24">
            {/* デスクトップ: ステップ間の接続線 */}
            <div className="hidden md:block absolute top-5 h-px bg-gray-300" style={{ left: 'calc((100% - 24rem) / 10)', right: 'calc((100% - 24rem) / 10)' }} />
            {STEPS.map((step) => (
              <div key={step.title} className="flex items-center gap-3 md:flex-1 md:flex-col md:gap-0 md:text-center">
                <div className="relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-900 text-sm font-bold text-white md:mb-3">
                  {step.icon}
                </div>
                <div className="md:mt-0">
                  <h3 className="text-base font-bold text-gray-900">{step.title}</h3>
                  <p className="text-sm text-gray-500">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 機能ハイライト */}
      <section className="bg-gray-50 px-6 py-16 md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {HIGHLIGHTS.map((item) => (
              <div
                key={item.label}
                className="relative rounded-2xl overflow-hidden transition-all hover:scale-[1.02] hover:shadow-2xl"
                style={{
                  background: 'rgba(255, 255, 255, 0.7)',
                  backdropFilter: 'blur(12px) saturate(120%)',
                  WebkitBackdropFilter: 'blur(12px) saturate(120%)',
                  border: '1px solid rgba(255, 255, 255, 0.8)',
                  boxShadow: '0px 8px 24px 0 rgba(12, 74, 110, 0.08), inset 0px 0px 4px 2px rgba(255, 255, 255, 0.3)',
                }}
              >
                {/* リフレクションハイライト */}
                <div
                  className="absolute inset-0 pointer-events-none rounded-2xl"
                  style={{ background: 'linear-gradient(to left top, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 50%)' }}
                />
                <div
                  className="absolute inset-0 pointer-events-none rounded-2xl"
                  style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 100%)' }}
                />
                {/* カードコンテンツ */}
                <div className="relative z-10 p-8">
                  <div className="mb-5">
                    <span className="text-sm font-semibold tracking-wide text-gray-700">
                      {item.label}
                    </span>
                  </div>
                  <div className="mb-4">
                    <item.icon size={32} strokeWidth={1.5} className="text-foreground" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3">
                    {item.title[0]}<br />{item.title[1]}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden px-6 py-16 md:py-24 text-center">
        {/* グラデーション背景 */}
        <div className="absolute inset-0 z-0" style={{
          background: [
            'radial-gradient(ellipse 180% 160% at 5% 20%, rgba(196, 181, 253, 0.8) 0%, transparent 55%)',
            'radial-gradient(ellipse 160% 140% at 85% 10%, rgba(253, 186, 116, 0.7) 0%, transparent 55%)',
            'radial-gradient(ellipse 150% 130% at 50% 90%, rgba(167, 243, 208, 0.65) 0%, transparent 55%)',
            'radial-gradient(ellipse 130% 110% at 95% 65%, rgba(251, 207, 232, 0.6) 0%, transparent 55%)',
            'linear-gradient(135deg, rgba(245, 243, 255, 1) 0%, rgba(255, 251, 245, 1) 50%, rgba(243, 255, 251, 1) 100%)',
          ].join(', '),
        }} />
        <div className="relative z-10 w-full max-w-4xl mx-auto">
          <div
            className="mb-8 inline-flex items-center gap-2 rounded-full px-6 py-1.5 text-sm text-blue-700 relative overflow-hidden"
            style={{
              background: 'rgba(0, 97, 255, 0.1)',
              backdropFilter: 'blur(12px) saturate(120%)',
              WebkitBackdropFilter: 'blur(12px) saturate(120%)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0px 8px 24px 0 rgba(12, 74, 110, 0.15), inset 0px 0px 4px 2px rgba(255, 255, 255, 0.2)',
            }}
          >
            <div className="absolute inset-0 pointer-events-none rounded-full"
              style={{ background: 'linear-gradient(to left top, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 50%)' }} />
            <span className="relative z-10 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              無料で3回まで利用可能
            </span>
            <span className="relative z-10 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              クレジットカード不要
            </span>
          </div>
          <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-gray-900">
            今すぐSTP分析を始める
          </h2>
          <p className="mt-6 text-lg md:text-xl text-gray-700 max-w-2xl mx-auto leading-relaxed">
            ブランドは、作った瞬間から走り出す。<br />branding.bz で、その加速を始めませんか。
          </p>
          <div className="mt-10">
            <Link href="/tools/stp/auth">
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
                <span className="relative z-10">無料でSTP分析を始める</span>
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* フッター */}
      <Footer />
    </div>
  )
}
