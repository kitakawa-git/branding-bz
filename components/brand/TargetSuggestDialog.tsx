'use client'

// AIターゲット提案の候補選択モーダル（管理画面・STPで共通利用）
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Check } from 'lucide-react'

export type TargetSuggestion = { name: string; description: string }

export function TargetSuggestDialog({
  open,
  onOpenChange,
  suggestions,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  suggestions: TargetSuggestion[]
  /** 選択された候補を渡す。追加・重複除外・トーストは呼び出し側が行う */
  onConfirm: (selected: TargetSuggestion[]) => void
}) {
  const [selectedIdx, setSelectedIdx] = useState<Set<number>>(new Set())

  // 開いた / 候補が変わったら全選択にリセット
  useEffect(() => {
    if (open) setSelectedIdx(new Set(suggestions.map((_, i) => i)))
  }, [open, suggestions])

  const toggle = (i: number) => {
    setSelectedIdx(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const toggleAll = () => {
    setSelectedIdx(prev =>
      prev.size === suggestions.length ? new Set() : new Set(suggestions.map((_, i) => i)),
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>AIによるターゲット候補</DialogTitle>
          <DialogDescription>
            入力済みのブランド情報をもとに生成した候補です。追加するものを選択してください。
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {selectedIdx.size} / {suggestions.length} 件を選択中
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={toggleAll} className="h-7 text-xs">
            {selectedIdx.size === suggestions.length ? '全解除' : '全選択'}
          </Button>
        </div>

        <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
          {suggestions.map((s, i) => {
            const selected = selectedIdx.has(i)
            return (
              <div
                key={i}
                role="button"
                tabIndex={0}
                onClick={() => toggle(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggle(i)
                  }
                }}
                className={`flex w-full cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                  selected ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    selected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-gray-300 bg-white'
                  }`}
                >
                  {selected && <Check size={12} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-900">{s.name}</div>
                  {s.description && <p className="mt-1 text-xs text-gray-600">{s.description}</p>}
                </div>
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            type="button"
            onClick={() => onConfirm(suggestions.filter((_, i) => selectedIdx.has(i)))}
            disabled={selectedIdx.size === 0}
          >
            選択したターゲットを追加（{selectedIdx.size}）
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
