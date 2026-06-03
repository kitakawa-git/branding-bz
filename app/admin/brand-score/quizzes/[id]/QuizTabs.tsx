'use client'

// 理解度テスト 詳細配下のタブナビ（設問 / 結果 / 受験状況）
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function QuizTabs({ quizId }: { quizId: string }) {
  const pathname = usePathname()
  const base = `/admin/brand-score/quizzes/${quizId}`
  const tabs = [
    { href: base, label: '設問' },
    { href: `${base}/results`, label: '結果' },
    { href: `${base}/participants`, label: '受験状況' },
  ]

  return (
    <div className="flex gap-1 border-b mb-6">
      {tabs.map((t) => {
        const active = t.href === base ? pathname === base : pathname.startsWith(t.href)
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
