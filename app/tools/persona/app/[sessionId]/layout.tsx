'use client'

// ペルソナセッションページレイアウト: UnifiedAuthProvider + PersonaHeader
import { UnifiedAuthProvider, useUnifiedAuth } from '@/components/providers/UnifiedAuthProvider'
import { PersonaHeader } from '../../components/PersonaHeader'
import Footer from '@/components/Footer'

export default function PersonaSessionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <UnifiedAuthProvider redirectTo="/portal/auth?from=persona">
      <PersonaSessionLayoutInner>{children}</PersonaSessionLayoutInner>
    </UnifiedAuthProvider>
  )
}

function PersonaSessionLayoutInner({ children }: { children: React.ReactNode }) {
  const { signOut } = useUnifiedAuth()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PersonaHeader showSignOut onSignOut={signOut} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
