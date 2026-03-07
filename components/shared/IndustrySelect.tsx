'use client'

// 業種セレクト（大分類・中分類）共通コンポーネント
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { INDUSTRY_CATEGORIES } from '@/lib/constants/industries'

interface IndustrySelectProps {
  category: string
  subcategory: string
  onCategoryChange: (value: string) => void
  onSubcategoryChange: (value: string) => void
  disabled?: boolean
}

export function IndustrySelect({
  category,
  subcategory,
  onCategoryChange,
  onSubcategoryChange,
  disabled = false,
}: IndustrySelectProps) {
  // 選択中の大分類に対応する中分類リスト
  const selectedIndustry = INDUSTRY_CATEGORIES.find(c => c.value === category)
  const subcategories = selectedIndustry?.subcategories ?? []

  // 「その他」カテゴリはテキスト入力
  const isOtherCategory = category === 'other'

  const handleCategoryChange = (value: string) => {
    onCategoryChange(value)
    // 大分類を変更したら中分類をリセット
    onSubcategoryChange('')
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* 大分類 */}
      <div>
        <label className="text-sm font-bold text-gray-700">業種（大分類）</label>
        <Select
          value={category}
          onValueChange={handleCategoryChange}
          disabled={disabled}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="選択してください" />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRY_CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 中分類 */}
      <div>
        <label className="text-sm font-bold text-gray-700">業種（中分類）</label>
        {isOtherCategory ? (
          <Input
            className="mt-1 h-10"
            placeholder="業種を入力してください"
            value={subcategory}
            onChange={(e) => onSubcategoryChange(e.target.value)}
            disabled={disabled}
          />
        ) : (
          <Select
            value={subcategory}
            onValueChange={onSubcategoryChange}
            disabled={disabled || !category}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder={category ? '選択してください' : '大分類を先に選択'} />
            </SelectTrigger>
            <SelectContent>
              {subcategories.map((sub) => (
                <SelectItem key={sub} value={sub}>
                  {sub}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  )
}
