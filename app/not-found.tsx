import Link from 'next/link'

/* 404 ページ。/admin/login と統一したリキッドグラス。
   GateShell を使うと onClick が必要でクライアント境界が入るため、
   Server Component のまま同スタイルをインライン再現している。 */
export default function NotFound() {
  const cardStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, rgba(18,20,29,0.88) 0%, rgba(5,6,10,0.93) 100%)',
    backdropFilter: 'blur(22px) saturate(180%)',
    WebkitBackdropFilter: 'blur(22px) saturate(180%)',
    boxShadow:
      'inset 0 1px 0 0 rgba(255,255,255,0.38), inset 0 -8px 24px -8px rgba(255,255,255,0.05), 0 24px 60px -20px rgba(0,0,0,0.5)',
  }
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-white font-sans text-white">
      <div
        className="relative z-10 mx-5 w-full max-w-[400px] overflow-hidden rounded-3xl border border-white/15"
        style={cardStyle}
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-3xl"
          style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 42%)' }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)' }}
        />

        <div className="relative z-10 p-10 text-center">
          <div className="mb-4 text-5xl">🔍</div>
          <h1 className="mb-3 text-2xl font-bold">ページが見つかりません</h1>
          <p className="mb-6 text-sm leading-relaxed text-white/55">
            お探しのページは削除されたか、URLが変更されている可能性があります。
          </p>
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-full bg-white px-8 text-base font-semibold text-black transition-transform hover:scale-[1.02]"
          >
            トップへ戻る
          </Link>

          <div className="mt-8 flex justify-center border-t border-white/10 pt-6">
            <Link href="/" className="inline-block transition-opacity hover:opacity-80">
              <img
                src="/logo.svg"
                alt="branding.bz"
                style={{ height: '24px', width: 'auto', filter: 'brightness(0) invert(1)' }}
              />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
