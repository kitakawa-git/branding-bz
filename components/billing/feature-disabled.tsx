// 機能トグル（companies の *_enabled 列）でオフにされた機能の面。
//
// PlanUpsell とは別物。
//   PlanUpsell … プランが足りない（＝お金を払えば使える）→ 次の一歩を示す
//   ここ        … 会社が「この機能は使わない」と決めた → 案内は出さず静かに閉じる
// アップグレードを勧めると、自分でオフにした人に売り込むことになるので勧めない。
import { Card, CardContent } from '@/components/ui/card'

export function FeatureDisabledNotice() {
  return (
    <div className="max-w-4xl mx-auto px-5 pt-4 pb-10">
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="py-16 text-center">
          <p className="text-muted-foreground text-[15px] m-0">
            この機能は現在ご利用いただけません
          </p>
          <p className="text-muted-foreground text-[13px] mt-2 mb-0">
            設定の「機能の表示設定」からオンに戻せます
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
