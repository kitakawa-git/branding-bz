'use client'

// セッションページレイアウト: ToolsAuthProvider + ToolsHeader
import { ToolsAuthProvider, useToolsAuth } from '../../components/ToolsAuthProvider'
import { ToolsHeader } from '../../components/ToolsHeader'
import Footer from '@/components/Footer'

export default function SessionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ToolsAuthProvider>
      <SessionLayoutInner>{children}</SessionLayoutInner>
    </ToolsAuthProvider>
  )
}

function SessionLayoutInner({ children }: { children: React.ReactNode }) {
  const { signOut } = useToolsAuth()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <ToolsHeader showSignOut onSignOut={signOut} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
