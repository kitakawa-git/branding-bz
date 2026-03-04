import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'QRコード出力',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
