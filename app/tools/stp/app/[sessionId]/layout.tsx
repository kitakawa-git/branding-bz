'use client'

// STPセッションページレイアウト: AppAuthProvider + STPHeader
import { AppAuthProvider, useAppAuth } from '@/components/providers/AppAuthProvider'
import { STPHeader } from '../../components/STPHeader'
import Footer from '@/components/Footer'

export default function STPSessionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppAuthProvider redirectOnSignOutTo="/tools/stp">
      <STPSessionLayoutInner>{children}</STPSessionLayoutInner>
    </AppAuthProvider>
  )
}

function STPSessionLayoutInner({ children }: { children: React.ReactNode }) {
  const { signOut } = useAppAuth()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <STPHeader showSignOut onSignOut={signOut} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
