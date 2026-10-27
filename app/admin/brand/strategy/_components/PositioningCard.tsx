// 立ち位置・ポジショニングカード（自社の立ち位置ステートメント＋ポジショニングマップ編集）
import { type Dispatch, type SetStateAction } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { PositioningMap } from '@/components/PositioningMap'
import { Plus, Trash2 } from 'lucide-react'
import type { PositioningMapData, PositioningMapItem, PositioningMapSize } from '@/lib/types/positioning-map'
import { type BrandStanceStatements, type CompetitorAnalysisItem } from './types'

const emptyMapData = (): PositioningMapData => ({
  x_axis: { left: '', right: '' },
  y_axis: { bottom: '', top: '' },
  items: [],
})

const emptyMapItem = (): PositioningMapItem => ({
  name: '',
  color: '#3B82F6',
  x: 50,
  y: 50,
  size: 'md',
})

const DEFAULT_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
]

type Props = {
  brandStanceStatements: BrandStanceStatements | null
  setBrandStanceStatements: Dispatch<SetStateAction<BrandStanceStatements | null>>
  positioningMapData: PositioningMapData | null
  setPositioningMapData: Dispatch<SetStateAction<PositioningMapData | null>>
  companyName: string | null
  strengths: string
  setStrengths: (value: string) => void
  competitorsAnalysis: CompetitorAnalysisItem[]
  setCompetitorsAnalysis: Dispatch<SetStateAction<CompetitorAnalysisItem[]>>
}

export function PositioningCard({
  brandStanceStatements,
  setBrandStanceStatements,
  positioningMapData,
  setPositioningMapData,
  companyName,
  strengths,
  setStrengths,
  competitorsAnalysis,
  setCompetitorsAnalysis,
}: Props) {
  // ポジショニングマップ操作
  const initializeMap = () => {
    setPositioningMapData(emptyMapData())
  }

  const clearMap = () => {
    setPositioningMapData(null)
  }

  const updateXAxis = (side: 'left' | 'right', value: string) => {
    setPositioningMapData(prev => {
      if (!prev) return prev
      return { ...prev, x_axis: { ...prev.x_axis, [side]: value } }
    })
  }

  const updateYAxis = (side: 'top' | 'bottom', value: string) => {
    setPositioningMapData(prev => {
      if (!prev) return prev
      return { ...prev, y_axis: { ...prev.y_axis, [side]: value } }
    })
  }

  const addMapItem = () => {
    setPositioningMapData(prev => {
      if (!prev || prev.items.length >= 10) return prev
      const newItem = emptyMapItem()
      newItem.color = DEFAULT_COLORS[prev.items.length % DEFAULT_COLORS.length]
      return { ...prev, items: [...prev.items, newItem] }
    })
  }

  const updateMapItem = (index: number, field: keyof PositioningMapItem, value: string | number) => {
    setPositioningMapData(prev => {
      if (!prev) return prev
      const items = [...prev.items]
      items[index] = { ...items[index], [field]: value }
      return { ...prev, items }
    })
  }

  const removeMapItem = (index: number) => {
    setPositioningMapData(prev => {
      if (!prev) return prev
      return { ...prev, items: prev.items.filter((_, i) => i !== index) }
    })
  }

  // プロット項目が自社かどうか（名称が会社名と一致すれば自社）
  const isSelfItem = (itemName: string) =>
    !!companyName && itemName.trim().toLowerCase() === companyName.trim().toLowerCase()

  // プロット項目の説明（自社=自社の強み strengths、競合=競合の特徴 competitorsAnalysis[].traits）
  const getItemDescription = (itemName: string): string => {
    if (isSelfItem(itemName)) return strengths
    const match = competitorsAnalysis.find(c => c.name.trim().toLowerCase() === itemName.trim().toLowerCase())
    return match?.traits ?? ''
  }

  const updateItemDescription = (itemName: string, text: string) => {
    if (isSelfItem(itemName)) {
      setStrengths(text)
      return
    }
    // 競合: 名称一致でupsert（無ければ追加）
    setCompetitorsAnalysis(prev => {
      const idx = prev.findIndex(c => c.name.trim().toLowerCase() === itemName.trim().toLowerCase())
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], traits: text }
        return next
      }
      return [...prev, { name: itemName.trim(), traits: text }]
    })
  }

  // 自社の立ち位置（ステートメント）の編集
  const updateStanceStatement = (index: number, field: 'target_name' | 'statement' | 'rationale', value: string) => {
    setBrandStanceStatements(prev => {
      if (!prev) return prev
      const statements = [...prev.statements]
      statements[index] = { ...statements[index], [field]: value }
      return { ...prev, statements }
    })
  }

  return (
    <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
      <CardContent className="p-5 space-y-8">
        {/* 自社の立ち位置（STP連携・編集可能） */}
        {brandStanceStatements && brandStanceStatements.statements.length > 0 && (
          <div>
          <h2 className="text-xs font-bold mb-3">自社の立ち位置</h2>
          <p className="mb-4 text-[13px] text-muted-foreground">
            各ターゲットに対して、自社が何者として刺さるかをまとめたステートメントです。
          </p>
          <div className="space-y-3">
            {brandStanceStatements.statements.map((s, i) => {
              const isMain = s.target_role === 'main'
              return (
                <div
                  key={i}
                  className={`rounded-lg border-2 p-4 ${
                    isMain ? 'border-ds-app-accent bg-ds-app-accent/5' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      isMain ? 'bg-ds-app-accent text-white' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {isMain ? 'メインターゲット向け' : 'サブターゲット向け'}
                    </span>
                    <Input
                      type="text"
                      value={s.target_name}
                      onChange={(e) => updateStanceStatement(i, 'target_name', e.target.value)}
                      placeholder="ターゲット名"
                      className="h-8 flex-1"
                    />
                  </div>
                  <AutoResizeTextarea
                    value={s.statement}
                    onChange={(e) => updateStanceStatement(i, 'statement', e.target.value)}
                    placeholder="このターゲットに対する自社の立ち位置ステートメント"
                    className="min-h-[72px]"
                  />
                  <div className="mt-3">
                    <Label className="text-xs text-muted-foreground mb-1.5 block">なぜなら</Label>
                    <AutoResizeTextarea
                      value={s.rationale}
                      onChange={(e) => updateStanceStatement(i, 'rationale', e.target.value)}
                      placeholder="この立ち位置が成り立つ理由・根拠"
                      className="min-h-[60px]"
                    />
                  </div>
                </div>
              )
            })}
          </div>
          </div>
        )}

        {/* ポジショニングマップ */}
        <div>
        <h2 className="text-xs font-bold mb-3">ポジショニングマップ</h2>

        {positioningMapData ? (
          <div className="space-y-5">
            {/* 軸ラベル設定 */}
            <div className="space-y-3">
              <h3 className="text-[11px] text-gray-500">軸ラベル</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">X軸 左</Label>
                  <Input
                    type="text"
                    value={positioningMapData.x_axis.left}
                    onChange={(e) => updateXAxis('left', e.target.value)}
                    placeholder="例: 低価格"
                    className="h-10"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">X軸 右</Label>
                  <Input
                    type="text"
                    value={positioningMapData.x_axis.right}
                    onChange={(e) => updateXAxis('right', e.target.value)}
                    placeholder="例: 高価格"
                    className="h-10"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Y軸 下</Label>
                  <Input
                    type="text"
                    value={positioningMapData.y_axis.bottom}
                    onChange={(e) => updateYAxis('bottom', e.target.value)}
                    placeholder="例: 機能重視"
                    className="h-10"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Y軸 上</Label>
                  <Input
                    type="text"
                    value={positioningMapData.y_axis.top}
                    onChange={(e) => updateYAxis('top', e.target.value)}
                    placeholder="例: デザイン重視"
                    className="h-10"
                  />
                </div>
              </div>
            </div>

            {/* 軸選定の根拠（軸ラベルの下に表示） */}
            {positioningMapData?.axis_rationale && (
              <div className="text-xs text-gray-700 leading-relaxed">
                <span className="font-bold text-gray-900">軸選定の根拠: </span>
                {positioningMapData.axis_rationale}
              </div>
            )}

            {/* アイテム一覧 */}
            <div className="space-y-3">
              <h3 className="text-[11px] text-gray-500">
                プロット項目（{positioningMapData.items.length}/10）
              </h3>

              {positioningMapData.items.map((item, index) => (
                <div key={index} className="border border-border rounded-xl p-4 bg-background">
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="color"
                      value={item.color}
                      onChange={(e) => updateMapItem(index, 'color', e.target.value)}
                      className="w-10 h-10 border border-border rounded-lg cursor-pointer p-0.5"
                    />
                    <Input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateMapItem(index, 'name', e.target.value)}
                      placeholder="名称（例: 自社、競合A）"
                      className="h-10 flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeMapItem(index)}
                      className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">
                        X位置: {item.x}
                      </Label>
                      <Slider
                        value={[item.x]}
                        onValueChange={([val]) => updateMapItem(index, 'x', val)}
                        min={0}
                        max={100}
                        step={1}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">
                        Y位置: {item.y}
                      </Label>
                      <Slider
                        value={[item.y]}
                        onValueChange={([val]) => updateMapItem(index, 'y', val)}
                        min={0}
                        max={100}
                        step={1}
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-3">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">サイズ</Label>
                    <div className="flex gap-1.5">
                      {([
                        { value: 'sm' as PositioningMapSize, label: '小' },
                        { value: 'md' as PositioningMapSize, label: '中' },
                        { value: 'lg' as PositioningMapSize, label: '大' },
                        { value: 'custom' as PositioningMapSize, label: 'カスタム' },
                      ]).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => updateMapItem(index, 'size', opt.value)}
                          className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                            item.size === opt.value
                              ? 'bg-foreground text-background border-foreground'
                              : 'bg-background text-foreground border-border hover:bg-muted'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {item.size === 'custom' && (
                      <div className="flex items-center gap-2">
                        <Slider
                          value={[item.customSize || 6]}
                          onValueChange={([val]) => updateMapItem(index, 'customSize', val)}
                          min={2}
                          max={20}
                          step={1}
                          className="w-24"
                        />
                        <span className="text-xs text-muted-foreground w-6">{item.customSize || 6}</span>
                      </div>
                    )}
                  </div>

                  {/* 説明: 自社=自社の強み / 競合=競合の特徴。名称一致で自社判別 */}
                  <div className="mt-3">
                    <Label className="text-xs text-muted-foreground mb-1.5 block">
                      {isSelfItem(item.name) ? '自社の強み' : '競合の特徴'}
                    </Label>
                    <AutoResizeTextarea
                      value={getItemDescription(item.name)}
                      onChange={(e) => updateItemDescription(item.name, e.target.value)}
                      placeholder={isSelfItem(item.name)
                        ? '自社が提供できる強み・価値'
                        : 'この競合の特徴・強み'}
                      className="min-h-[72px]"
                    />
                  </div>
                </div>
              ))}

              {positioningMapData.items.length < 10 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={addMapItem}
                  className="py-2 px-4 text-[13px]"
                >
                  <Plus size={16} />項目を追加
                </Button>
              )}
            </div>

            {/* プレビュー */}
            <div>
              <h3 className="text-[11px] text-gray-500 mb-2">プレビュー</h3>
              <PositioningMap data={positioningMapData} />
            </div>

            {/* マップ削除 */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={clearMap}
              className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ) : (
          <div>
            <p className="text-[13px] text-muted-foreground mb-3">
              ポジショニングマップを作成してください
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={initializeMap}
              className="py-2 px-4 text-[13px]"
            >
              マップを作成
            </Button>
          </div>
        )}
        </div>
      </CardContent>
    </Card>
  )
}
