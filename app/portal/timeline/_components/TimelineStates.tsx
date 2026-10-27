// 利用不可時の案内カードと読み込み中スケルトン
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

// 機能オフ・区分で非表示のときの案内のみ表示
export function TimelineNotice({ message }: { message: string }) {
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

export function TimelineSkeleton({ showCategoryPills }: { showCategoryPills: boolean }) {
  return (
    <div className="max-w-4xl mx-auto px-5 pt-4 pb-10 space-y-6">
      {/* カテゴリフィルタ＋検索（投稿はFAB＋モーダルのためフォームは出さない）
          カテゴリピルは実画面と同じく categories.length > 1 のときだけ出す
          （既定の単一カテゴリではピルが無いため、ロード時のちらつきを防ぐ） */}
      <div className="flex items-center gap-2 flex-wrap">
        {showCategoryPills &&
          [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-8 w-16 rounded-full" />)}
        <Skeleton className="h-9 w-48 ml-auto rounded-md" />
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start gap-3 mb-3">
                <Skeleton className="size-9 rounded-full shrink-0" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-28 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <Skeleton className="h-5 w-20 rounded-full mb-3" />
              <Skeleton className="h-16 w-full mb-3" />
              <div className="flex gap-4 pt-2 border-t border-border">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-10" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
