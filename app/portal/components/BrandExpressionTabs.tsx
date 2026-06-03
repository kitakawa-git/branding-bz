'use client'

// 「見え方・聞こえ方」(ブランド表現) のビジュアル / バーバル切替タブ。
// サイドメニューはサブメニューを持たず、ページ上部のこのタブで表示を切り替える。
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Eye, MessageSquare } from 'lucide-react'

const TABS = [
  { href: '/portal/visuals', label: '見え方', icon: Eye },
  { href: '/portal/verbal', label: '聞こえ方', icon: MessageSquare },
]

export function BrandExpressionTabs() {
  const pathname = usePathname()
  return (
    <div className="flex gap-1 border-b border-border">
      {TABS.map((t) => {
        const Icon = t.icon
        const active = pathname.startsWith(t.href)
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`no-underline flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${
              active
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon size={16} />
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
