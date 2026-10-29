'use client'

// 日程調整ツール 作成者の画面（ログイン必須）: AppAuthProvider + SorouHeader
import { AppAuthProvider, useAppAuth } from '@/components/providers/AppAuthProvider'
import { SorouHeader } from '../components/SorouHeader'
import Footer from '@/components/Footer'

export default function SorouAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppAuthProvider redirectOnSignOutTo="/tools/sorou">
      <SorouAppLayoutInner>{children}</SorouAppLayoutInner>
    </AppAuthProvider>
  )
}

function SorouAppLayoutInner({ children }: { children: React.ReactNode }) {
  const { signOut } = useAppAuth()
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SorouHeader showSignOut onSignOut={signOut} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
