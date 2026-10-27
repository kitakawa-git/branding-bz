// 提供価値カード（value_propositions の一覧編集）
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import { Plus, Trash2 } from 'lucide-react'
import { type ProvidedValueItem } from './types'

type Props = {
  providedValues: ProvidedValueItem[]
  setProvidedValues: (values: ProvidedValueItem[]) => void
}

export function ProvidedValuesCard({ providedValues, setProvidedValues }: Props) {
  // 提供価値（value_propositions）操作
  const addProvidedValue = () => {
    setProvidedValues([...providedValues, { title: '', description: '' }])
  }

  const updateProvidedValue = (index: number, field: 'title' | 'description', value: string) => {
    const updated = [...providedValues]
    updated[index] = { ...updated[index], [field]: value }
    setProvidedValues(updated)
  }

  const removeProvidedValue = (index: number) => {
    setProvidedValues(providedValues.filter((_, i) => i !== index))
  }

  return (
    <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
      <CardContent className="p-5">
        <h2 className="text-xs font-bold mb-3">提供価値</h2>
        <p className="text-xs text-muted-foreground mb-4">
          顧客に提供する価値を設定します（ポータルの「接し方」に表示されます）
        </p>

        {providedValues.map((value, index) => (
          <div key={index} className="border border-border rounded-xl p-4 mb-3 bg-background">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[13px] font-bold text-muted-foreground">
                提供価値 {index + 1}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => removeProvidedValue(index)}
                className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 size={14} />
              </Button>
            </div>

            <div className="mb-5">
              <h2 className="text-xs font-bold mb-3">タイトル</h2>
              <Input
                type="text"
                value={value.title}
                onChange={(e) => updateProvidedValue(index, 'title', e.target.value)}
                placeholder="提供価値のタイトル"
                className="h-10"
              />
            </div>

            <div>
              <h2 className="text-xs font-bold mb-3">説明</h2>
              <AutoResizeTextarea
                value={value.description}
                onChange={(e) => updateProvidedValue(index, 'description', e.target.value)}
                placeholder="この提供価値の詳細説明"
                className="min-h-[80px]"
              />
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          onClick={addProvidedValue}
          className="py-2 px-4 text-[13px]"
        >
          <Plus size={16} />提供価値を追加
        </Button>
      </CardContent>
    </Card>
  )
}
