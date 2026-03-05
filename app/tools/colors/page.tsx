'use client'

// ランディングページ（未認証でもアクセス可）
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Palette, Sparkles, Download, ArrowRight, CheckCircle2 } from 'lucide-react'

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
      {/* ヘッダー */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-transparent">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <Link
            href="/tools/colors"
            className="text-lg font-bold text-gray-900 no-underline"
          >
            branding.bz
          </Link>
          <Link href="/tools/colors/auth">
            <Button variant="outline" size="sm" className="font-semibold">ログイン</Button>
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
            <Button size="lg" className="h-12 px-8 text-base font-bold">
              無料でカラーを作る
            </Button>
          </Link>
        </div>
      </section>

      {/* カラーパレット例 */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="mb-8 text-center text-2xl font-bold text-gray-900">
            こんなパレットが作れます
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {EXAMPLE_PALETTES.map((palette) => (
              <Card key={palette.name} className="overflow-hidden transition-shadow hover:shadow-lg">
                <div className="flex h-20">
                  {palette.colors.map((color, i) => (
                    <div
                      key={i}
                      style={{ backgroundColor: color.hex, flex: color.flex }}
                    />
                  ))}
                </div>
                <CardContent className="p-4">
                  <p className="text-sm font-bold text-gray-900">{palette.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{palette.concept}</p>
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
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="mb-12 text-center text-2xl font-bold text-gray-900">
            5ステップでカラーを確定
          </h2>
          <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:gap-16">
            {/* デスクトップ: ステップ間の接続線（丸の中心を横断） */}
            <div className="hidden md:block absolute top-5 left-[10%] right-[10%] h-px bg-gray-300" />
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
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="flex items-start gap-3">
              <Palette className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
              <div>
                <h3 className="mb-1 text-sm font-bold text-gray-900">WCAG準拠チェック</h3>
                <p className="text-sm text-gray-500">アクセシビリティ基準を自動で検証し、誰にでも見やすい配色を提案</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
              <div>
                <h3 className="mb-1 text-sm font-bold text-gray-900">AIチャットで磨き込み</h3>
                <p className="text-sm text-gray-500">「もう少し温かみがほしい」など、自然な言葉でカラーを調整</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Download className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
              <div>
                <h3 className="mb-1 text-sm font-bold text-gray-900">PDF・CSS出力</h3>
                <p className="text-sm text-gray-500">パレットカードPDFやCSSカスタムプロパティをワンクリックで出力</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <h2 className="mb-4 text-2xl font-bold text-gray-900">
            今すぐカラーパレットを作成
          </h2>
          <p className="mb-6 text-gray-500">
            無料で3回まで利用可能。アカウント登録は30秒で完了。
          </p>
          <Link href="/tools/colors/auth">
            <Button size="lg" className="h-12 px-8 text-base font-bold">
              無料でカラーを作る
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <div className="mt-4 flex items-center justify-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              クレジットカード不要
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              約5〜10分で完了
            </span>
          </div>
        </div>
      </section>

      {/* フッター */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-7xl px-6 text-center text-sm text-gray-400">
          &copy; {new Date().getFullYear()} branding.bz — ID INC.
        </div>
      </footer>
    </div>
  )
}
