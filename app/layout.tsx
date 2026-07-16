import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Toaster } from "@/components/ui/sonner";
import { PWAUpdatePrompt } from "@/components/pwa/PWAUpdatePrompt";
import { getDesignTokensCss } from "@/lib/design-tokens";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: '%s | branding.bz',
    default: 'branding.bz',
  },
  description: 'AIで、ブランディングを加速させる。構築・浸透・発信をひとつのプラットフォームで。',
  metadataBase: new URL('https://branding.bz'),
  applicationName: 'branding.bz',
  // iOSでホーム画面に追加した際にスタンドアロン（アプリ風）起動させる
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'branding.bz',
  },
  formatDetection: { telephone: false },
  // 旧iOS(<16.4)のスタンドアロン起動互換（Next.jsは現行標準 mobile-web-app-capable を出力するため、レガシーも併記）
  other: { 'apple-mobile-web-app-capable': 'yes' },
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    siteName: 'branding.bz',
  },
  twitter: {
    card: 'summary_large_image',
  },
  alternates: {
    canonical: '/',
  },
  verification: {
    google: 'NEqXR7GF6lYCsSorWgxXoVdN3f8rZc1RU-31ex7BnyI',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // DB管理のデザイントークン（--ds-*）を :root として注入。
  // 取得失敗時は空文字 → globals.css の静的フォールバックが効く。
  const designTokensCss = await getDesignTokensCss();

  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        {designTokensCss && (
          <style
            id="design-tokens"
            dangerouslySetInnerHTML={{ __html: designTokensCss }}
          />
        )}
        {/*
          3ドメインシナジー用 JSON-LD (@graph)。全ページ共通。
          - Organization: 運営 ID株式会社 の子ノード。parentOrganization/publisher で include.bz を親参照。
          - SoftwareApplication: サービス本体。有料プラン混在のため offers は省略（有料SaaSを0円と偽らない）。
          - WebSite: このドメイン。inLanguage=ja。
          - sameAs: include.bz / branding.bz / designnow.design + 公式SNS。3サイトで同一配列にして名寄せ。
        */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'Organization',
                  '@id': 'https://branding.bz/#organization',
                  name: 'branding.bz',
                  url: 'https://branding.bz',
                  logo: 'https://branding.bz/logo.svg',
                  description:
                    'AIがブランディングを加速。中小企業・スタートアップ向けのブランド構築・浸透・発信を一気通貫で支援するSaaS。',
                  parentOrganization: { '@id': 'https://include.bz/#organization' },
                  publisher: { '@id': 'https://include.bz/#organization' },
                  sameAs: [
                    'https://include.bz',
                    'https://branding.bz',
                    'https://designnow.design',
                    'https://www.facebook.com/include.bz',
                    'https://www.instagram.com/include.bz/',
                    'https://twitter.com/include_bz',
                  ],
                },
                {
                  '@type': 'SoftwareApplication',
                  '@id': 'https://branding.bz/#software',
                  name: 'branding.bz',
                  url: 'https://branding.bz',
                  applicationCategory: 'BusinessApplication',
                  operatingSystem: 'Web',
                  description:
                    'STP分析・ペルソナ作成・ブランドカラー定義などをAIで支援するブランド構築SaaS。無料ツールも公開。',
                  publisher: { '@id': 'https://include.bz/#organization' },
                },
                {
                  '@type': 'WebSite',
                  '@id': 'https://branding.bz/#website',
                  url: 'https://branding.bz',
                  name: 'branding.bz',
                  publisher: { '@id': 'https://branding.bz/#organization' },
                  inLanguage: 'ja',
                },
              ],
            }),
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster />
        <PWAUpdatePrompt />
        <GoogleAnalytics gaId="G-CQBED1RNV2" />
      </body>
    </html>
  );
}
