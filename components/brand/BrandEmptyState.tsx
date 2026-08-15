'use client'

// ポータルのブランド各画面が空のときに出す面。
//
// 「まだ登録されていません」だけだと、見た人は次に何をすればいいか分からない。
// 登録できるのは管理者だけなので、出し分ける:
//   管理者   … 何を登録する場所かを添えて、管理画面の該当ページへ送る
//   メンバー … 誰かが登録すれば埋まると分かる一文だけ。押せない導線は出さない
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Card className="border bg-[hsl(0_0%_97%)] shadow-none">
        <CardContent className="p-6 text-center">
          <p className="m-0 text-base font-bold text-foreground">
            {label}はまだ登録されていません
          </p>
          <p className="m-0 mt-2 text-base leading-relaxed text-muted-foreground sm:text-sm">
            {isAdmin ? description : '管理者が登録すると、ここに表示されます。'}
          </p>

          {isAdmin && (
            <Button asChild className="mt-5 h-11 rounded-xl px-5">
              <Link href={href} className="no-underline">
                {label}を登録する
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
