import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ロゴ規定ツール | ロゴの最小サイズとクリアスペースを決める',
  description: 'ロゴの最小使用サイズを版ごと・出力条件ごとに実寸で測り、クリアスペースと使用シーンでの見え方まで検証。ガイドラインに書ける使用規定にまとめる、branding.bz のロゴ規定ツール。',
  openGraph: {
    title: 'ロゴ規定ツール | branding.bz',
    description: 'ロゴの最小使用サイズ・クリアスペース・使用シーンでの見え方を検証し、使用規定にまとめます。',
    url: 'https://branding.bz/tools/logo-checker',
    // 専用の OG 画像（og_tools_logo-checker.png）を用意するまでは共通の画像を使う
    images: [{ url: '/og/og_default.png', width: 1200, height: 630 }],
  },
  twitter: {
    images: ['/og/og_default.png'],
  },
  alternates: {
    canonical: '/tools/logo-checker',
  },
}

export default function LogoCheckerToolLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
