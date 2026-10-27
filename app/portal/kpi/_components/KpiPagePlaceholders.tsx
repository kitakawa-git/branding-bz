// 利用不可の案内・読み込み中スケルトン・目標未設定時の案内カード
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Milestone, CalendarDays } from 'lucide-react'
import { PERIOD_TYPE_LABELS, formatDateShort, type GoalPeriod } from './kpi-utils'

// ============================================
// 利用不可の案内（機能トグルオフ／区分で非表示）
// ============================================
export function KpiUnavailableNotice({ message }: { message: string }) {
  return (
    <div className="max-w-4xl mx-auto px-5 pt-4 pb-10">
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="py-16 text-center">
          <p className="text-muted-foreground text-[15px] m-0">
            {message}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// Loading skeleton
// ============================================
export function KpiPageSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-5 pt-4 pb-10 space-y-6">
      {/* 期間情報 */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none"><CardContent className="p-4 flex items-center gap-2"><Skeleton className="size-4 rounded" /><Skeleton className="h-4 w-56" /></CardContent></Card>
      {/* 目標＋総合進捗 */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none"><CardContent className="p-4 sm:p-5 space-y-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="flex gap-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-5 w-16 rounded-full" />)}</div>
      </CardContent></Card>
      {/* KPI個別カード */}
      {[1, 2, 3].map(i => (
        <Card key={i} className="bg-[hsl(0_0%_97%)] border shadow-none"><CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between"><Skeleton className="h-5 w-40" /><Skeleton className="h-5 w-12" /></div>
          <Skeleton className="h-2 w-full rounded-full" />
        </CardContent></Card>
      ))}
    </div>
  )
}

// ============================================
// 目標未設定: 期間情報カード
// ============================================
export function GoalPeriodNoticeCard({ goalPeriod }: { goalPeriod: GoalPeriod }) {
  return (
    <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-muted-foreground" />
          <span className="text-sm text-foreground">
            目標期間: {formatDateShort(goalPeriod.start_date)} 〜 {formatDateShort(goalPeriod.end_date)}（{PERIOD_TYPE_LABELS[goalPeriod.type]}）
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// 目標未設定: 案内カード
// ============================================
export function GoalEmptyCard({ goalPeriod }: { goalPeriod: GoalPeriod | null }) {
  return (
    <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
      <CardContent className="py-16 text-center">
        <Milestone size={48} className="mx-auto text-muted-foreground mb-4" />
        <h2 className="text-lg font-bold text-foreground mb-2">目標がまだ設定されていません</h2>
        {(goalPeriod?.show_goal_banner !== false) ? (
          <p className="text-sm text-muted-foreground">
            ブランドにどう貢献するかを宣言し、具体的なKPIを設定しましょう。
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            目標設定期間外です。管理者にお問い合わせください。
          </p>
        )}
      </CardContent>
    </Card>
  )
}
