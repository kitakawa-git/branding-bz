'use client'

// タイトル＋説明のリスト入力 共通コンポーネント
// 管理画面（事業内容・ターゲットセグメント）とSTPツールStep1で共通利用
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import { Plus, Trash2 } from 'lucide-react'

interface TitleDescriptionItem {
  title: string
  description: string
}

interface TitleDescriptionListProps {
  /** セクションの見出し（例: "事業内容", "ターゲットセグメント"） */
  label: string
  /** 入力リスト */
  items: TitleDescriptionItem[]
  /** 値変更時コールバック */
  onChange: (items: TitleDescriptionItem[]) => void
  /** 追加ボタンのラベル（例: "＋ 事業内容を追加"） */
  addButtonLabel: string
  /** タイトル欄のプレースホルダ */
  titlePlaceholder?: string
  /** 説明欄のプレースホルダ */
  descriptionPlaceholder?: string
  /** 必須マーク表示 */
  required?: boolean
  /** 最大件数（デフォルト10） */
  maxItems?: number
  /** 無効化 */
  disabled?: boolean
  /** バリデーションエラーメッセージ */
  error?: string
}

export function TitleDescriptionList({
  label,
  items,
  onChange,
  addButtonLabel,
  titlePlaceholder = 'タイトル',
  descriptionPlaceholder = '説明',
  required = false,
  maxItems = 10,
  disabled = false,
  error,
}: TitleDescriptionListProps) {
  const addItem = () => {
    if (items.length >= maxItems) return
    onChange([...items, { title: '', description: '' }])
  }

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: 'title' | 'description', value: string) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  return (
    <div>
      {label && (
        <div className="mb-2 flex items-center gap-1.5">
          <label className="text-sm font-bold text-gray-700">{label}</label>
          {required ? (
            <span className="text-xs text-red-500">*</span>
          ) : (
            <span className="text-xs text-gray-400">（任意）</span>
          )}
        </div>
      )}

      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="border border-border rounded-lg p-3 bg-background">
            <div className="flex gap-2 mb-2 items-center">
              <Input
                value={item.title}
                onChange={(e) => updateItem(index, 'title', e.target.value)}
                placeholder={titlePlaceholder}
                className="h-10 flex-1"
                disabled={disabled}
              />
              {items.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => removeItem(index)}
                  className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                  disabled={disabled}
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
            <AutoResizeTextarea
              value={item.description}
              onChange={(e) => updateItem(index, 'description', e.target.value)}
              placeholder={descriptionPlaceholder}
              className="min-h-[60px]"
              disabled={disabled}
            />
          </div>
        ))}

        {items.length < maxItems && (
          <Button
            type="button"
            variant="outline"
            onClick={addItem}
            className="py-2 px-4 text-[13px]"
            disabled={disabled}
          >
            <Plus size={16} />
            {addButtonLabel}
          </Button>
        )}
      </div>

      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
    </div>
  )
}
