// ブランド戦略 編集ページの読み込み中スケルトン
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function StrategySkeleton() {
  return (
    <div className="space-y-4">
      {/* Card 1: ターゲット概要＋主なターゲット＋ペルソナ */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5 space-y-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-20 w-full rounded-md" />
          <Skeleton className="h-4 w-24" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2].map(i => (
              <div key={i} className="border border-border rounded-xl p-4 space-y-3 bg-background">
                <Skeleton className="h-10 w-full rounded-md" />
                <Skeleton className="h-16 w-full rounded-md" />
              </div>
            ))}
          </div>
          <Skeleton className="h-4 w-20" />
          <div className="border border-border rounded-xl p-4 space-y-3 bg-background">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
        </CardContent>
      </Card>
      {/* Card 2: ポジショニングマップ */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5 space-y-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </CardContent>
      </Card>
    </div>
  )
}
