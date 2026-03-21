import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'スマート名刺',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
