import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'branding.bz — AIで、ブランディングを加速させる。'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #f5f3ff 0%, #fffbf5 50%, #f3fffb 100%)',
          position: 'relative',
        }}
      >
        {/* グラデーションオーバーレイ */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(ellipse 80% 60% at 20% 30%, rgba(196, 181, 253, 0.4) 0%, transparent 60%), radial-gradient(ellipse 70% 50% at 80% 20%, rgba(253, 186, 116, 0.3) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 50% 80%, rgba(167, 243, 208, 0.3) 0%, transparent 60%)',
          }}
        />
        {/* ロゴマーク */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '32px',
            position: 'relative',
          }}
        >
          <svg width="56" height="56" viewBox="0 0 112 120" fill="none">
            <path d="M69.2093 95L112 95L112 52.2093L69.2093 95Z" fill="black" />
            <path d="M69.2093 25.791L0 25.791L-1.21009e-05 95.0003L69.2093 25.791Z" fill="black" />
          </svg>
          <span
            style={{
              fontSize: '48px',
              fontWeight: 700,
              color: '#111827',
              letterSpacing: '-0.02em',
            }}
          >
            branding.bz
          </span>
        </div>
        {/* キャッチコピー */}
        <div
          style={{
            fontSize: '36px',
            fontWeight: 700,
            color: '#111827',
            textAlign: 'center',
            lineHeight: 1.4,
            position: 'relative',
          }}
        >
          AIで、ブランディングを加速させる。
        </div>
        <div
          style={{
            fontSize: '20px',
            color: '#4B5563',
            marginTop: '16px',
            textAlign: 'center',
            position: 'relative',
          }}
        >
          構築・浸透・発信をひとつのプラットフォームで。
        </div>
        {/* フッター */}
        <div
          style={{
            position: 'absolute',
            bottom: '32px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#9CA3AF',
            fontSize: '16px',
          }}
        >
          powered by ID INC.
        </div>
      </div>
    ),
    { ...size }
  )
}
