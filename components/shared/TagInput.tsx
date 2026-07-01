'use client'

// タグ入力フィールド（チップ＋Enter/カンマで追加・Backspaceで末尾削除）。
// STP Step3 の購買決定要因など、複数の短い語を入力する箇所で共用する。
import { useState } from 'react'
import { X } from 'lucide-react'

interface TagInputProps {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string      // タグが0件のときのプレースホルダ
  addPlaceholder?: string   // タグが1件以上あるときのプレースホルダ
  className?: string        // 外枠コンテナへ追加
  inputClassName?: string   // 内側 input へ追加
  chipClassName?: string    // チップの配色（bg/border/text）。既定は青。カテゴリ別色分け用に上書き可
}

export function TagInput({
  value,
  onChange,
  placeholder = '',
  addPlaceholder = 'Enterで追加',
  className = '',
  inputClassName = '',
  chipClassName = 'bg-blue-100 text-ds-app-accent-hover',
}: TagInputProps) {
  const [draft, setDraft] = useState('')

  const addTag = (raw: string) => {
    const tag = raw.trim().replace(/,/g, '')
    if (tag && !value.includes(tag)) onChange([...value, tag])
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // IME変換確定のEnterは無視（確定Enterでタグ追加→直後にIMEが文字をコミットして残るのを防ぐ）
    if (e.nativeEvent.isComposing || e.key === 'Process') return
    if ((e.key === 'Enter' || e.key === ',') && draft.trim()) {
      e.preventDefault()
      addTag(draft)
      setDraft('')
    } else if (e.key === 'Backspace' && !draft && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  const removeAt = (index: number) => onChange(value.filter((_, i) => i !== index))

  return (
    <div className={`flex flex-wrap gap-1.5 rounded-md border border-gray-200 bg-white p-2 min-h-[36px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 ${className}`}>
      {value.map((tag, i) => (
        <span
          key={i}
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-medium ${chipClassName}`}
        >
          {tag}
          <button type="button" onClick={() => removeAt(i)} aria-label={`${tag} を削除`} className="hover:text-blue-900">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={value.length === 0 ? placeholder : addPlaceholder}
        className={`flex-1 min-w-[120px] border-none outline-none text-[13px] bg-transparent ${inputClassName}`}
      />
    </div>
  )
}
