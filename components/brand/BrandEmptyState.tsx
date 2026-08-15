'use client'

// ポータルのブランド各画面が空のときに出す面。
//
// 「まだ登録されていません」だけだと、見た人は次に何をすればいいか分からない。
// 登録できるのは管理者だけなので、出し分ける:
//   管理者   … 何を登録する場所かを添えて、管理画面の該当ページへ送る
//   メンバー … 誰かが登録すれば埋まると分かる一文だけ。押せない導線は出さない
//
// 体裁はプラン外のときに出る面（PlanUpsell）に合わせている。
// ポータルで「まだ見られない」を伝える面は、理由が違っても見た目は揃える。
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { usePortalAuth } from '@/app/portal/components/PortalDataProvider'

export function BrandEmptyState({
  /** 何を登録する場所か。「ブランド方針」「ビジュアル」など */
  label,
  /** 登録すると何が見えるようになるかの一文 */
  description,
  /** 管理画面の該当ページ */
  href,
}: {
  label: string
  description: string
  href: string
}) {
  const { isAdmin } = usePortalAuth()

  return (
    <div className="mx-auto max-w-4xl px-5 pt-4 pb-10">
      <Card className="border bg-[hsl(0_0%_97%)] shadow-none">
        <CardContent className="p-6 pb-8 text-center">
          <h2 className="mb-1 text-base font-bold text-foreground">
            {label}はまだ登録されていません
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            {isAdmin ? description : '管理者が登録すると、ここに表示されます。'}
          </p>

          {isAdmin && (
            <Link
              href={href}
              className="inline-flex h-11 items-center gap-1.5 rounded-full bg-foreground px-6 text-sm font-bold text-background no-underline transition-transform hover:scale-[1.03]"
            >
              {label}を登録する
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
