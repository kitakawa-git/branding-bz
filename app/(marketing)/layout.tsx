import Nav from '@/components/lp/Nav'
import Footer from '@/components/Footer'
import PageTransition from '@/components/lp/PageTransition'

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#08080a] text-white antialiased">
      <Nav />
      <PageTransition>
        <main>{children}</main>
      </PageTransition>
      <Footer />
    </div>
  )
}
