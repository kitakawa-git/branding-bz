'use client'

// オフライン時の汎用フォールバックページ（Service Worker の fallbacks から参照）
// 認証情報・APIフェッチを一切含まない完全静的ページ。serwist の precache に自動で含まれる。
import { WifiOff } from 'lucide-react'

export default function OfflinePage() {
  return (
    <main className="min-h-dvh flex items-center justify-center bg-white px-6">
      <div className="text-center max-w-sm">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-gray-100">
          <WifiOff className="size-8 text-gray-400" strokeWidth={1.5} />
        </div>
        <h1 className="text-xl font-bold text-gray-900">オフラインです</h1>
        <p className="mt-3 text-sm text-gray-600 leading-relaxed">
          インターネット接続を確認して、もう一度お試しください。
        </p>
        <button
          onClick={() => location.reload()}
          className="mt-8 inline-flex h-11 items-center justify-center rounded-full bg-gray-900 px-8 text-sm font-bold text-white transition-all hover:scale-105 hover:shadow-lg"
        >
          再読み込み
        </button>
      </div>
    </main>
  )
}
