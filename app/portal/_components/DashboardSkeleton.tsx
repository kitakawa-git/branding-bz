// ポータルダッシュボードの読み込み中スケルトン（実体のレイアウトに合わせた仮表示）
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function DashboardSkeleton({
  kpiVisible,
  timelineEnabled,
}: {
  kpiVisible: boolean
  timelineEnabled: boolean
}) {
  return (
    <div className="max-w-4xl mx-auto px-5 py-10 space-y-8">
      {/* スローガン＋ようこそ（中央） */}
      <div className="text-center space-y-2">
        <Skeleton className="h-10 w-72 max-w-full mx-auto" />
        <Skeleton className="h-4 w-40 mx-auto" />
      </div>
      {/* ミッションカード */}
      <Skeleton className="h-44 w-full rounded-xl" />
      {/* 私たちの「らしさ」4象限カード（実体と同じ 2列グリッド） */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-[hsl(0_0%_97%)] border shadow-none">
              <CardContent className="p-4 pl-5 flex items-start gap-3">
                <Skeleton className="size-10 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      {/* KPIバナー（ピル型）— KPI機能が有効な企業のみ実描画されるためトグルで出し分け */}
      {kpiVisible && <Skeleton className="h-14 w-full rounded-full" />}
      {/* あなたのタイムライン分析（見出し＋統計カード3枚）— タイムライン機能が有効な企業のみ */}
      {timelineEnabled && (
        <div className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-[hsl(0_0%_97%)] border shadow-none">
                <CardContent className="p-4 flex flex-col gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-12" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
