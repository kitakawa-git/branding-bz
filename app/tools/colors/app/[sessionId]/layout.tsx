'use client'

// セッションページレイアウト: AppAuthProvider + ToolsHeader
import { AppAuthProvider, useAppAuth } from '@/components/providers/AppAuthProvider'
import { ToolsHeader } from '../../components/ToolsHeader'
import Footer from '@/components/Footer'

export default function SessionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppAuthProvider redirectOnSignOutTo="/tools/colors">
      <SessionLayoutInner>{children}</SessionLayoutInner>
    </AppAuthProvider>
  )
}

function SessionLayoutInner({ children }: { children: React.ReactNode }) {
  const { signOut } = useAppAuth()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <ToolsHeader showSignOut onSignOut={signOut} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
