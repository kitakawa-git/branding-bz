'use client'

// スーパー管理画面 企業詳細: 「関係性」カード（リスト＝CRUD＋AIスキャン ／ マップ＝可視化 のタブ統合）。
// 機能の実体は既存コンポーネントのまま（複製なし）。タブ切替で表示を切り替えるだけ。
import { useState } from 'react'
import ElementRelationsSection from './ElementRelationsSection'
import BrandMapSection from './BrandMapSection'

export default function RelationsTabs({
  companyId,
  onDataChanged,
}: {
  companyId: string
  // リスト側（CRUD）のデータ変化通知をそのまま転送（ウィザード判定・ハブの島チップ更新用）
  onDataChanged?: () => void
}) {
  const [tab, setTab] = useState<'list' | 'map'>('list')
  return (
    <div>
      <div className="inline-flex rounded-md border border-border overflow-hidden mb-3">
        <button
          type="button"
          onClick={() => setTab('list')}
          className={`px-3 py-1.5 text-[13px] font-semibold border-0 cursor-pointer ${tab === 'list' ? 'bg-blue-600 text-white' : 'bg-background text-muted-foreground hover:text-foreground'}`}
        >
          リスト
        </button>
        <button
          type="button"
          onClick={() => setTab('map')}
          className={`px-3 py-1.5 text-[13px] font-semibold border-0 cursor-pointer ${tab === 'map' ? 'bg-blue-600 text-white' : 'bg-background text-muted-foreground hover:text-foreground'}`}
        >
          マップ
        </button>
      </div>
      {tab === 'list' ? (
        <ElementRelationsSection companyId={companyId} onDataChanged={onDataChanged} />
      ) : (
        <BrandMapSection companyId={companyId} />
      )}
    </div>
  )
}
