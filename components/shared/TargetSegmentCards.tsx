// メイン/サブターゲット バッジカード（STP分析ツール Step5「確認・出力」のレイアウトを共有化）
// STP Step5・社員ポータル(/portal/strategy) から共通で利用する。
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'

export interface TargetSegmentCardItem {
  name: string
  description?: string
  // カード内、説明文の下に追加表示する要素（評価スターなど。STPツール文脈用）
  extra?: ReactNode
}

interface TargetSegmentCardsProps {
  main: TargetSegmentCardItem | null
  subs: TargetSegmentCardItem[]
  // メインターゲットカード内、説明文の下に追加表示する要素（評価スター・深掘り情報など。STPツール文脈用）
  mainExtra?: ReactNode
  // 指定時のみ、サブターゲット0件でもメッセージを表示する（STPツール文脈用）。未指定時は0件ならサブターゲット枠ごと省略。
  emptySubsMessage?: string
}

export function TargetSegmentCards({ main, subs, mainExtra, emptySubsMessage }: TargetSegmentCardsProps) {
  return (
    <>
      {main && (
        <div className="relative mb-3.5 rounded-lg border border-ds-app-accent-soft bg-blue-50/50 p-4">
          <Badge className="absolute -top-[9px] left-[6px] rounded-full px-1.5 py-0 !text-[10px] !leading-[16px] bg-ds-app-accent text-white hover:bg-ds-app-accent-hover">メインターゲット</Badge>
          <p className="text-lg font-bold text-gray-900">{main.name || '未選択'}</p>
          {main.description && (
            <p className="mt-1 text-sm text-gray-600 leading-relaxed">{main.description}</p>
          )}
          {mainExtra}
        </div>
      )}

      {subs.length > 0 ? (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {subs.map((sub, i) => (
            <div key={i} className="relative rounded-lg border border-blue-300 bg-blue-50/30 p-4">
              <Badge variant="outline" className="absolute -top-[9px] left-[6px] rounded-full px-1.5 py-0 !text-[10px] !leading-[16px] border-blue-300 bg-white text-blue-300">サブターゲット</Badge>
              <p className="text-lg font-bold text-gray-700">{sub.name}</p>
              {sub.description && (
                <p className="mt-1 text-sm text-gray-600 leading-relaxed">{sub.description}</p>
              )}
              {sub.extra}
            </div>
          ))}
        </div>
      ) : emptySubsMessage ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
          <p className="text-sm text-gray-400">{emptySubsMessage}</p>
        </div>
      ) : null}
    </>
  )
}
