'use client'

// ペルソナセッションページレイアウト: AppAuthProvider + PersonaHeader
import { AppAuthProvider, useAppAuth } from '@/components/providers/AppAuthProvider'
import { PersonaHeader } from '../../components/PersonaHeader'
import Footer from '@/components/Footer'

export default function PersonaSessionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppAuthProvider redirectOnSignOutTo="/tools/persona">
      <PersonaSessionLayoutInner>{children}</PersonaSessionLayoutInner>
    </AppAuthProvider>
  )
}

function PersonaSessionLayoutInner({ children }: { children: React.ReactNode }) {
  const { signOut } = useAppAuth()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PersonaHeader showSignOut onSignOut={signOut} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
