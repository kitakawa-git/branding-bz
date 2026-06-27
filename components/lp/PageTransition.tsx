'use client'

import { usePathname } from 'next/navigation'

/* LP全ページ共通の画面遷移エフェクト。
   pathname をキーにすることで、クライアント遷移ごとに中身が再マウントされ、
   ふわっとフェードイン（globals.css の .lp-fade-in）が毎回再生される。 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div key={pathname} className="lp-fade-in">
      {children}
    </div>
  )
}
