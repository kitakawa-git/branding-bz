import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#111827',
          borderRadius: '36px',
        }}
      >
        <svg width="120" height="120" viewBox="0 0 112 120" fill="none">
          <path d="M69.2093 95L112 95L112 52.2093L69.2093 95Z" fill="white" />
          <path d="M69.2093 25.791L0 25.791L-1.21009e-05 95.0003L69.2093 25.791Z" fill="white" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
