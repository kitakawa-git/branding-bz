'use client'

// ロゴ規定ツール 本体の画面（ログイン必須）: AppAuthProvider + LogoCheckerHeader
import { AppAuthProvider, useAppAuth } from '@/components/providers/AppAuthProvider'
import { LogoCheckerHeader } from '../components/LogoCheckerHeader'
import Footer from '@/components/Footer'

export default function LogoCheckerAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppAuthProvider redirectOnSignOutTo="/tools/logo-checker">
      <LogoCheckerAppLayoutInner>{children}</LogoCheckerAppLayoutInner>
    </AppAuthProvider>
  )
}

function LogoCheckerAppLayoutInner({ children }: { children: React.ReactNode }) {
  const { signOut } = useAppAuth()
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <LogoCheckerHeader showSignOut onSignOut={signOut} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
