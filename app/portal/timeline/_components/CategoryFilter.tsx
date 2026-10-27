// 行動指針（カテゴリ）での絞り込みピル
type CategoryFilterProps = {
  categories: string[]
  filterCategory: string
  setFilterCategory: (category: string) => void
}

export function CategoryFilter({ categories, filterCategory, setFilterCategory }: CategoryFilterProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
      {categories.length > 1 && (
        // 折り返さず横1列。入りきらないぶんは横スクロールで辿る。
        // スクロールバーは隠す（チップ列の下に細い帯が出ると窮屈に見えるため）。
        // タッチとトラックパッドは素で流れ、マウスは Shift+ホイールで動く
        <div className="flex min-w-0 gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setFilterCategory('all')}
            className={`shrink-0 whitespace-nowrap px-3.5 py-2 rounded-full text-sm font-medium transition-colors ${
              filterCategory === 'all'
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            すべて
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`shrink-0 whitespace-nowrap px-3.5 py-2 rounded-full text-sm font-medium transition-colors ${
                filterCategory === cat
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
