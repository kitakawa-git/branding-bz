// ポータルダッシュボードの「最新のお知らせ」カード（未読のみ・最新3件）
import Link from 'next/link'
import { getRelativeTime } from '@/lib/time-utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowRight } from 'lucide-react'

export type AnnouncementSummary = {
  id: string
  title: string
  category: string
  created_at: string
  content: string
}

const ANNOUNCEMENT_CATEGORY_COLORS: Record<string, string> = {
  '重要': 'bg-red-100 text-red-700',
  'イベント': 'bg-blue-100 text-ds-app-accent-hover',
  '更新': 'bg-green-100 text-green-700',
  'その他': 'bg-gray-100 text-gray-700',
}

export function DashboardAnnouncements({
  latestAnnouncements,
}: {
  latestAnnouncements: AnnouncementSummary[]
}) {
  return (
    <Card className="border shadow-none overflow-hidden mb-4">
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-3 py-3">
          <h2 className="text-sm font-bold text-foreground tracking-wide m-0">
            最新のお知らせ
          </h2>
          {/* 矢印だけ。文字が無くなるので、読み上げ用の名前を付ける。
              大きさと色はミッションカードの矢印に合わせる */}
          <Link
            href="/portal/announcements"
            aria-label="お知らせをすべて見る"
            className="no-underline"
          >
            <ArrowRight size={18} className="text-muted-foreground" />
          </Link>
        </div>
        {latestAnnouncements.map(a => (
          <Link
            key={a.id}
            href={`/portal/announcements/${a.id}`}
            className="no-underline block border-t border-border p-3 transition-colors hover:bg-muted/40"
          >
            {/* タイトル・カテゴリ・時刻を1行に畳む。時刻は右端に寄せて、
                複数件並んだときに縦のラインが揃うようにする */}
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="min-w-0 truncate text-sm font-semibold text-foreground m-0">
                {a.title}
              </h3>
              <Badge variant="secondary" className={`shrink-0 text-[10px] px-1.5 py-0 ${ANNOUNCEMENT_CATEGORY_COLORS[a.category] || ANNOUNCEMENT_CATEGORY_COLORS['その他']}`}>
                {a.category}
              </Badge>
              <span className="ml-auto shrink-0 text-[11px] text-muted-foreground" suppressHydrationWarning>
                {getRelativeTime(a.created_at)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 m-0 whitespace-pre-wrap">
              {a.content}
            </p>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
