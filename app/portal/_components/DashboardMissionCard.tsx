// ポータルダッシュボードの「私たちのミッション」カード（コンセプトビジュアルを背景に敷く）
import Link from 'next/link'
import { splitBrandCopy } from '@/lib/brand-mvv'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowRight } from 'lucide-react'

export function DashboardMissionCard({
  mission,
  conceptVisualUrl,
}: {
  mission: string
  conceptVisualUrl: string | null
}) {
  return (
    <Card className="relative overflow-hidden bg-[hsl(0_0%_97%)] border shadow-none mb-4">
      {/* コンセプトビジュアルが設定されていれば背景に敷く（可読性のため白スクリムを重ねる） */}
      {conceptVisualUrl && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${conceptVisualUrl})` }}
            aria-hidden
          />
          <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px]" aria-hidden />
        </>
      )}
      <CardContent className="relative p-4 sm:p-5">
        <Link
          href="/portal/guidelines"
          className="no-underline flex items-center justify-between mb-3"
        >
          <h2 className="text-sm font-bold text-foreground tracking-wide m-0">
            私たちのミッション
          </h2>
          <ArrowRight size={18} className="text-muted-foreground" />
        </Link>
        {(() => {
          const { copy, body } = splitBrandCopy(mission)
          return (
            <>
              {copy && (
                <p className="text-2xl font-bold text-foreground m-0 leading-relaxed">
                  {copy}
                </p>
              )}
              {body && (
                <p className="text-base text-foreground/80 leading-relaxed whitespace-pre-line mt-4 m-0">
                  {body}
                </p>
              )}
            </>
          )
        })()}
      </CardContent>
    </Card>
  )
}
