'use client'

// 名刺プレビュー フォールバックページ
// サイドバーからはDialogで開く。直接URLアクセス時は通常ダッシュボードへリダイレクトするが、
// スマート名刺がオフのときは案内のみ表示する（リダイレクトしない）。
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePortalAuth } from '../components/PortalDataProvider'
import { isFeatureEnabled } from '@/lib/constants/feature-toggles'
import { Card, CardContent } from '@/components/ui/card'

export default function CardPreviewPage() {
  const router = useRouter()
  const { company } = usePortalAuth()
  const cardEnabled = isFeatureEnabled(company, 'card_enabled')

  useEffect(() => {
    // 有効時のみ従来どおりダッシュボードへ
    if (cardEnabled) router.replace('/portal')
  }, [router, cardEnabled])

  // 機能トグルがオフ: 内容は表示せず、案内のみ（URL直打ち対応・リダイレクトしない）
  if (!cardEnabled) {
    return (
      <div className="max-w-4xl mx-auto px-5 pt-4 pb-10">
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground text-[15px] m-0">
              この機能は現在ご利用いただけません
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}
