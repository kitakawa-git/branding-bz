import type { MetadataRoute } from 'next'

// Webアプリマニフェスト（PWA）
// Next.js が /manifest.webmanifest として配信し、<link rel="manifest"> を自動挿入する
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'branding.bz',
    short_name: 'branding.bz',
    description: 'AIで、ブランディングを加速させる。構築・浸透・発信をひとつのプラットフォームで。',
    // インストール版（PWA）はポータルを起点にする。未ログイン時は /portal が
    // クライアント側で /portal/auth（ログイン）へリダイレクトする
    start_url: '/portal',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    lang: 'ja',
    dir: 'ltr',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
