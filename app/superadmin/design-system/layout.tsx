import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'デザインシステム',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
