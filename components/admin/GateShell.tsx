/* /admin/login と統一したリキッドグラス・ゲート画面。
   AdminDataProvider / PortalDataProvider / SuperAdminShell の
   「承認待ち」「権限なし」など単一メッセージ画面で共通利用する。
   1ヶ所直せば全ゲートに反映されるように集約した。 */
type CtaButton = { label: string; onClick: () => void | Promise<void> }

export function GateShell({
  icon,
  title,
  body,
  primary,
  secondary,
}: {
  /* 見出し上のアイコン。絵文字なら <span className="text-5xl">🚫</span>、
     lucide なら <ShieldAlert size={48} className="text-white/70" /> をそのまま渡す。 */
  icon: React.ReactNode
  title: string
  body: React.ReactNode
  primary: CtaButton
  secondary?: CtaButton
}) {
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
        {/* Specular ハイライト（/admin/login と同一） */}
        <div
          className="pointer-events-none absolute inset-0 rounded-3xl"
          style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 42%)' }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)' }}
        />

        <div className="relative z-10 p-10 text-center">
          <div className="mb-4 flex justify-center text-white/70">{icon}</div>
          <h1 className="mb-3 text-2xl font-bold">{title}</h1>
          <p className="mb-6 text-sm leading-relaxed text-white/55">{body}</p>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            {secondary && (
              <button
                onClick={secondary.onClick}
                className="inline-flex h-12 w-full items-center justify-center rounded-full border border-white/15 bg-white/5 px-8 text-base font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
              >
                {secondary.label}
              </button>
            )}
            <button
              onClick={primary.onClick}
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-white px-8 text-base font-semibold text-black transition-transform hover:scale-[1.02] sm:w-auto"
            >
              {primary.label}
            </button>
          </div>

          {/* BottomLogo（/admin/login と同一） */}
          <div className="mt-8 flex justify-center border-t border-white/10 pt-6">
            <a href="/" className="inline-block transition-opacity hover:opacity-80">
              <img
                src="/logo.svg"
                alt="branding.bz"
                style={{ height: '24px', width: 'auto', filter: 'brightness(0) invert(1)' }}
              />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
