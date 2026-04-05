import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ページが見つかりません',
}

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{
      background: 'linear-gradient(135deg, rgba(245, 243, 255, 1) 0%, rgba(255, 251, 245, 1) 50%, rgba(243, 255, 251, 1) 100%)',
    }}>
      <div className="text-center max-w-md">
        <p className="text-7xl font-bold text-gray-900">404</p>
        <h1 className="mt-4 text-xl font-bold text-gray-900">
          ページが見つかりません
        </h1>
        <p className="mt-3 text-sm text-gray-600 leading-relaxed">
          お探しのページは移動または削除された可能性があります。
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="relative h-12 px-8 rounded-full text-base font-bold text-white overflow-hidden transition-all hover:scale-105 hover:shadow-2xl inline-flex items-center justify-center"
            style={{
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(12px) saturate(120%)',
              WebkitBackdropFilter: 'blur(12px) saturate(120%)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: '0px 8px 24px 0 rgba(0, 0, 0, 0.2), inset 0px 1px 0px 0px rgba(255, 255, 255, 0.15)',
            }}
          >
            トップページへ
          </Link>
          <Link
            href="/contact"
            className="relative h-12 px-8 rounded-full text-base font-bold text-gray-900 overflow-hidden transition-all hover:scale-105 hover:shadow-2xl inline-flex items-center justify-center"
            style={{
              background: 'rgba(255, 255, 255, 0.25)',
              backdropFilter: 'blur(12px) saturate(120%)',
              WebkitBackdropFilter: 'blur(12px) saturate(120%)',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              boxShadow: '0px 8px 24px 0 rgba(12, 74, 110, 0.1), inset 0px 1px 0px 0px rgba(255, 255, 255, 0.3)',
            }}
          >
            お問い合わせ
          </Link>
        </div>
      </div>
    </div>
  )
}
