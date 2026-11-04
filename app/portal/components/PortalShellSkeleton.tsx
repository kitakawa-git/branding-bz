// ポータル初回読み込み（ログイン確認＋会社情報の取得）の間に出す枠のスケルトン。
// 白地の「読み込み中...」だけだと止まって見えるので、実際の画面と同じ配置（サイドメニュー＋ヘッダー＋本文）で待たせる
import { Skeleton } from '@/components/ui/skeleton'

export function PortalShellSkeleton() {
  return (
    <div data-portal="" className="flex min-h-svh bg-background" role="status" aria-label="読み込み中">
      {/* サイドメニュー（スマホでは実物も隠れている） */}
      <div className="hidden md:flex w-[19rem] shrink-0 flex-col gap-3 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="size-8 rounded-lg shrink-0" />
          <Skeleton className="h-4 w-36" />
        </div>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex h-16 items-center gap-3 px-4">
          <Skeleton className="size-8 shrink-0" />
          <Skeleton className="h-5 w-32" />
        </div>
        {/* 本文 */}
        <div className="max-w-4xl mx-auto px-5 py-6 space-y-6">
          <Skeleton className="h-8 w-56 max-w-full" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
