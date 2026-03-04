import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'アクセス解析',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
