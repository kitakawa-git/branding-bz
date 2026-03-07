'use client'

// STPセッションページレイアウト: STPAuthProvider + STPHeader
import { STPAuthProvider, useSTPAuth } from '../../components/STPAuthProvider'
import { STPHeader } from '../../components/STPHeader'
import Footer from '@/components/Footer'

export default function STPSessionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <STPAuthProvider>
      <STPSessionLayoutInner>{children}</STPSessionLayoutInner>
    </STPAuthProvider>
  )
}

function STPSessionLayoutInner({ children }: { children: React.ReactNode }) {
  const { signOut } = useSTPAuth()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <STPHeader showSignOut onSignOut={signOut} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
