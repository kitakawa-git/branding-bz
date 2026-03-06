'use client'

// ランディングページ（未認証でもアクセス可）
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Palette, Sparkles, Download, ArrowRight, CheckCircle2, Plug } from 'lucide-react'
import Footer from '@/components/Footer'

const EXAMPLE_PALETTES = [
  {
    name: '信頼のディープブルー',
    concept: '堅実さと先進性を両立するIT企業向けパレット',
    colors: [
      { hex: '#1A56DB', label: 'Primary', flex: 3 },
      { hex: '#3B82F6', label: 'Secondary', flex: 2 },
      { hex: '#F59E0B', label: 'Accent', flex: 1.5 },
      { hex: '#F8FAFC', label: 'Light', flex: 1 },
      { hex: '#1E293B', label: 'Dark', flex: 1 },
    ],
  },
  {
    name: '自然のハーモニー',
    concept: 'オーガニックブランドの安心感と活力を表現',
    colors: [
      { hex: '#059669', label: 'Primary', flex: 3 },
      { hex: '#34D399', label: 'Secondary', flex: 2 },
      { hex: '#F97316', label: 'Accent', flex: 1.5 },
      { hex: '#FFFBEB', label: 'Light', flex: 1 },
      { hex: '#1F2937', label: 'Dark', flex: 1 },
    ],
  },
  {
    name: '洗練のモノトーン',
    concept: 'ファッション・クリエイティブ向けの都会的配色',
    colors: [
      { hex: '#18181B', label: 'Primary', flex: 3 },
      { hex: '#71717A', label: 'Secondary', flex: 2 },
      { hex: '#E11D48', label: 'Accent', flex: 1.5 },
      { hex: '#FAFAFA', label: 'Light', flex: 1 },
      { hex: '#27272A', label: 'Dark', flex: 1 },
    ],
  },
  {
    name: '情熱のレッド',
    concept: '飲食・エンタメ業界の活気とエネルギーを表現',
    colors: [
      { hex: '#DC2626', label: 'Primary', flex: 3 },
      { hex: '#F87171', label: 'Secondary', flex: 2 },
      { hex: '#FBBF24', label: 'Accent', flex: 1.5 },
      { hex: '#FFF7ED', label: 'Light', flex: 1 },
      { hex: '#1C1917', label: 'Dark', flex: 1 },
    ],
  },
  {
    name: '癒しのパステル',
    concept: '美容・ヘルスケア向けのやさしく上品な配色',
    colors: [
      { hex: '#F9A8D4', label: 'Primary', flex: 3 },
      { hex: '#C4B5FD', label: 'Secondary', flex: 2 },
      { hex: '#6EE7B7', label: 'Accent', flex: 1.5 },
      { hex: '#FFF1F2', label: 'Light', flex: 1 },
      { hex: '#374151', label: 'Dark', flex: 1 },
    ],
  },
  {
    name: 'テクノロジーパープル',
    concept: 'AI・テック企業の革新性と未来感を演出',
    colors: [
      { hex: '#7C3AED', label: 'Primary', flex: 3 },
      { hex: '#A78BFA', label: 'Secondary', flex: 2 },
      { hex: '#06B6D4', label: 'Accent', flex: 1.5 },
      { hex: '#F5F3FF', label: 'Light', flex: 1 },
      { hex: '#1E1B4B', label: 'Dark', flex: 1 },
    ],
  },
]

const STEPS = [
  { icon: '1', title: '基本情報', description: 'ブランド名や業種・ターゲットを入力' },
  { icon: '2', title: 'イメージ選択', description: 'キーワードやムードボードで方向性を設定' },
  { icon: '3', title: 'AI提案', description: 'AIが3パターンのカラーパレットを提案' },
  { icon: '4', title: '調整・磨き込み', description: 'AIチャットで色味やトーンを細かく調整' },
  { icon: '5', title: '確定・出力', description: 'PDFカード出力やbranding.bzへの連携' },
]

export default function ColorsLandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ロゴ（独立レイヤー: mix-blend-mode: difference で背景色に応じて自動反転） */}
      <div
        className="fixed top-0 left-0 right-0 z-50 pointer-events-none"
        style={{ mixBlendMode: 'difference' }}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center px-6">
          <Link href="/tools/colors" className="text-lg font-bold text-white no-underline hover:opacity-80 pointer-events-auto">
            branding.bz
          </Link>
        </div>
      </div>

      {/* ヘッダー */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-transparent">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div className="text-lg font-bold invisible" aria-hidden="true">branding.bz</div>
          <Link href="/tools/colors/auth">
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
          <span className="relative z-10">AIガイドで約5〜10分</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 md:text-5xl">
          ブランドカラー定義ツール
        </h1>
        <p className="mt-6 mx-auto max-w-2xl text-lg text-gray-600 leading-relaxed">
          ブランドのパーソナリティや業種に合わせて、
          AIがプロ品質のカラーパレットを提案します。
          経営者・ブランド担当者のための無料ツール。
        </p>
        <div className="mt-10">
          <Link href="/tools/colors/auth">
            <button
              className="relative h-12 w-48 rounded-full text-base font-bold text-white overflow-hidden transition-all hover:scale-105 hover:shadow-2xl"
              style={{
                background: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(12px) saturate(120%)',
                WebkitBackdropFilter: 'blur(12px) saturate(120%)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                boxShadow: '0px 8px 24px 0 rgba(0, 0, 0, 0.2), inset 0px 1px 0px 0px rgba(255, 255, 255, 0.15)',
              }}
            >
              <span className="relative z-10">無料でカラーを作る</span>
            </button>
          </Link>
        </div>
      </section>

      {/* カラーパレット例 */}
      <section className="bg-gray-50 px-6 py-16 md:py-24">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-8 text-center text-xl md:text-[1.625rem] font-bold text-gray-900">
            こんなカラーパレットが作れます
          </h2>
        </div>
        <style>{`
          @keyframes marquee-scroll {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
        `}</style>
        <div className="overflow-hidden">
          <div
            className="flex gap-6 hover:[animation-play-state:paused]"
            style={{
              animation: 'marquee-scroll 30s linear infinite',
              willChange: 'transform',
              width: 'max-content',
            }}
          >
            {[...EXAMPLE_PALETTES, ...EXAMPLE_PALETTES].map((palette, idx) => (
              <Card key={`${palette.name}-${idx}`} className="w-[350px] flex-shrink-0 overflow-hidden transition-shadow hover:shadow-lg">
                <div className="flex h-20">
                  {palette.colors.map((color, i) => (
                    <div
                      key={i}
                      style={{ backgroundColor: color.hex, flex: color.flex }}
                    />
                  ))}
                </div>
                <CardContent className="p-4">
                  <p className="text-base font-bold text-gray-900">{palette.name}</p>
                  <p className="mt-0.5 text-sm text-gray-500">{palette.concept}</p>
                  <div className="mt-3 flex gap-1.5">
                    {palette.colors.map((color, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <div
                          className="h-4 w-4 rounded border border-gray-200"
                          style={{ backgroundColor: color.hex }}
                        />
                        <span className="font-mono text-[10px] text-gray-400">{color.hex}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ステップ説明 */}
      <section className="bg-white px-6 py-16 md:py-24">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-12 text-center text-xl md:text-[1.625rem] font-bold text-gray-900">
            5ステップでカラーを確定
          </h2>
          <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:gap-24">
            {/* デスクトップ: ステップ間の接続線（1つ目〜5つ目の丸中心を結ぶ） */}
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
            {[
              {
                label: 'アクセシビリティ',
                icon: Palette,
                title: ['WCAG準拠の', '配色チェック'],
                description: 'アクセシビリティ基準を自動で検証し、誰にでも見やすい配色を提案します。',
              },
              {
                label: '対話型調整',
                icon: Sparkles,
                title: ['AIチャットで', '自由に調整'],
                description: '「もう少し温かみがほしい」など、自然な言葉でカラーを何度でも調整できます。',
              },
              {
                label: '出力',
                icon: Download,
                title: ['PDF・CSSを', 'ワンクリック出力'],
                description: 'パレットカードPDFやCSSカスタムプロパティをワンクリックでダウンロードできます。',
              },
              {
                label: '連携',
                icon: Plug,
                title: ['ワンクリックで', 'branding.bz に連携'],
                description: '確定したカラーをブランディングプラットフォームに登録。社内ガイドラインや名刺に即反映。',
              },
            ].map((item) => (
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
              クレジットカード不要
            </span>
            <span className="relative z-10 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              約5〜10分で完了
            </span>
          </div>
          <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-gray-900">
            今すぐカラーパレットを作成
          </h2>
          <p className="mt-6 text-lg md:text-xl text-gray-700 max-w-2xl mx-auto leading-relaxed">
            無料で3回まで利用可能<br />アカウント登録は30秒で完了
          </p>
          <div className="mt-10">
            <Link href="/tools/colors/auth">
              <button
                className="relative h-12 w-48 rounded-full text-base font-bold text-white overflow-hidden transition-all hover:scale-105 hover:shadow-2xl"
                style={{
                  background: 'rgba(0, 0, 0, 0.75)',
                  backdropFilter: 'blur(12px) saturate(120%)',
                  WebkitBackdropFilter: 'blur(12px) saturate(120%)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  boxShadow: '0px 8px 24px 0 rgba(0, 0, 0, 0.2), inset 0px 1px 0px 0px rgba(255, 255, 255, 0.15)',
                }}
              >
                <span className="relative z-10">無料でカラーを作る</span>
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* フッター（共通コンポーネント） */}
      <Footer />
    </div>
  )
}
