'use client'

// パーソナリティ診断 セッションページレイアウト: AppAuthProvider + PersonalityHeader
import { AppAuthProvider, useAppAuth } from '@/components/providers/AppAuthProvider'
import { PersonalityHeader } from '../../components/PersonalityHeader'
import Footer from '@/components/Footer'

export default function PersonalitySessionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppAuthProvider redirectOnSignOutTo="/tools/personality">
      <PersonalitySessionLayoutInner>{children}</PersonalitySessionLayoutInner>
    </AppAuthProvider>
  )
}

function PersonalitySessionLayoutInner({ children }: { children: React.ReactNode }) {
  const { signOut } = useAppAuth()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PersonalityHeader showSignOut onSignOut={signOut} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
