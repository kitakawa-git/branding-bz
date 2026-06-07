import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
