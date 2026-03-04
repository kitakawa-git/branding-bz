'use client'

// セッションページレイアウト: ToolsAuthProvider + ToolsHeader
import { ToolsAuthProvider, useToolsAuth } from '../../components/ToolsAuthProvider'
import { ToolsHeader } from '../../components/ToolsHeader'

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
    <div className="min-h-screen bg-gray-50">
      <ToolsHeader showSignOut onSignOut={signOut} />
      <main>{children}</main>
    </div>
  )
}
