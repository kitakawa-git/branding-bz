/* 新デザイン（/lp 系）の共通UIプリミティブ。
   各ページ・各セクションから再利用する。 */

/* 下層ページ共通のヒーロー（固定ナビ分の余白＋アイブロウ＋見出し＋リード） */
export function PageHero({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string
  title: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <section className="relative px-6 pt-28 pb-16 text-center md:pt-36 md:pb-20">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(55% 45% at 50% 0%, rgba(37,99,235,0.28) 0%, rgba(37,99,235,0) 70%)',
        }}
      />
      <div className="mx-auto max-w-3xl">
        {eyebrow && (
          <p className="mb-4 text-xs font-semibold tracking-[0.25em] text-blue-400">
            {eyebrow}
          </p>
        )}
        <h1 className="text-4xl font-bold tracking-tight md:text-6xl">{title}</h1>
        {children && (
          <div className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/60">
            {children}
          </div>
        )}
      </div>
    </section>
  )
}

/* グラデーション縁取りのダークカード */
export function GlowCard({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`relative rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden ${className}`}
      style={{
        boxShadow:
          'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 24px 60px -20px rgba(0,0,0,0.8)',
      }}
    >
      {children}
    </div>
  )
}
