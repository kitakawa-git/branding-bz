// ポータルダッシュボードの私たちの「らしさ」4象限概観カード（サイドバーのスイッチで開閉）
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import {
  ArrowRight,
  Target,
  Compass,
  Smile,
  Eye,
} from 'lucide-react'

// 私たちの「らしさ」4象限概観カード（内部=紫 → 外部=緑 の順）
const BRAND_QUADRANTS = [
  {
    perspective: '考え方',
    noun: 'ブランド方針',
    items: 'MVV・行動指針・ストーリー',
    href: '/portal/guidelines',
    icon: Compass,
    tone: 'purple' as const,
  },
  {
    perspective: '感じられ方',
    noun: 'ブランドパーソナリティ',
    items: 'ブランドの人格・キャラクター',
    href: '/portal/personality',
    icon: Smile,
    tone: 'purple' as const,
  },
  {
    perspective: '見え方・聞こえ方',
    noun: 'ブランド表現',
    items: 'ロゴ・カラー・言葉づかい・用語のルール',
    href: '/portal/visuals',
    icon: Eye,
    tone: 'green' as const,
  },
  {
    perspective: '接し方',
    noun: 'ブランド戦略',
    items: '届けたいお客様像・立ち位置・提供する価値',
    href: '/portal/strategy',
    icon: Target,
    tone: 'green' as const,
  },
]

// 内部=紫系 / 外部=緑系（既存のポータル配色に馴染ませる）
const QUADRANT_TONES = {
  purple: { bar: 'bg-purple-500', tile: 'bg-purple-100 text-purple-700' },
  green: { bar: 'bg-green-500', tile: 'bg-green-100 text-green-700' },
}

export function DashboardRashisaCard({ visible }: { visible: boolean }) {
  return (
    <div
      className={`grid transition-all duration-300 ease-out ${
        visible ? 'mb-4 grid-rows-[1fr] opacity-100' : 'mb-0 grid-rows-[0fr] opacity-0'
      }`}
    >
      {/* 高さを 0fr↔1fr で動かすので、中身は overflow-hidden の箱に入れる。
          max-height だと閉じ切るまでの速さが中身の量で変わる */}
      <div className="min-h-0 overflow-hidden">
        <div className="rounded-xl border border-gray-200 bg-[hsl(0_0%_97%)] p-5">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-bold text-foreground tracking-wide m-0">
              私たちの「らしさ」
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 auto-rows-fr">
            {BRAND_QUADRANTS.map((q) => {
              const Icon = q.icon
              const tone = QUADRANT_TONES[q.tone]
              return (
                <Link key={q.href} href={q.href} className="no-underline block h-full">
                  <Card className="relative h-full bg-white border shadow-none hover:shadow-sm transition-shadow overflow-hidden">
                    <CardContent className="p-4 flex items-start gap-3">
                      <div className={`shrink-0 size-11 rounded-xl flex items-center justify-center ${tone.tile}`}>
                        <Icon size={24} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span className="text-lg font-bold text-foreground leading-tight">
                            {q.perspective}
                          </span>
                          <span className="text-sm font-normal text-muted-foreground">
                            ｜{q.noun}
                          </span>
                        </div>
                        <p className="text-base sm:text-sm text-muted-foreground leading-relaxed mt-1 m-0">
                          {q.items}
                        </p>
                      </div>
                      <ArrowRight size={18} className="text-muted-foreground shrink-0 mt-1" />
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
