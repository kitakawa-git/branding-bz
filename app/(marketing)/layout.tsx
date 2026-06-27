'use client'

import Nav from '@/components/lp/Nav'
import Footer from '@/components/Footer'

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#08080a] text-white antialiased">
      <Nav />
      <main>{children}</main>
      <Footer />
    </div>
  )
}
