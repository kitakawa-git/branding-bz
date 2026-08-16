'use client'

// ポータルヘッダーの検索。
//
// 検索フィールドはページ側（タイムライン等）の絞り込みに使うが、置き場所は
// 共通ヘッダーなので、状態だけをここで共有する。
// URL クエリにしないのは、1文字ごとに履歴とレンダリングが走るため。
//
// ヘッダーに出すかはページが決める（useRegisterPortalSearch を呼んだページだけ）。
// レイアウト側にページ名を書くと、検索を足すたびにレイアウトを直すことになる。
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Search, X } from 'lucide-react'

type PortalSearchValue = {
  query: string
  setQuery: (q: string) => void
  /** ヘッダーに検索アイコンを出すか。ページ側が登録する */
  searchable: boolean
  setSearchable: (v: boolean) => void
  placeholder: string
  setPlaceholder: (v: string) => void
}

const PortalSearchContext = createContext<PortalSearchValue | null>(null)

export function PortalSearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState('')
  const [searchable, setSearchable] = useState(false)
  const [placeholder, setPlaceholder] = useState('検索...')
  const value = useMemo(
    () => ({ query, setQuery, searchable, setSearchable, placeholder, setPlaceholder }),
    [query, searchable, placeholder],
  )
  return <PortalSearchContext.Provider value={value}>{children}</PortalSearchContext.Provider>
}

function usePortalSearchContext(): PortalSearchValue | null {
  return useContext(PortalSearchContext)
}

/**
 * 検索を使うページから呼ぶ。ヘッダーにアイコンが出るようになり、
 * 入力された文字列が返る。ページを離れたらアイコンごと消える。
 */
export function useRegisterPortalSearch(placeholder: string): string {
  const ctx = usePortalSearchContext()
  const setSearchable = ctx?.setSearchable
  const setPlaceholder = ctx?.setPlaceholder
  const setQuery = ctx?.setQuery

  useEffect(() => {
    if (!setSearchable || !setPlaceholder || !setQuery) return
    setSearchable(true)
    setPlaceholder(placeholder)
    return () => {
      setSearchable(false)
      // 別のページに持ち越さない
      setQuery('')
    }
  }, [setSearchable, setPlaceholder, setQuery, placeholder])

  return ctx?.query ?? ''
}

/** ヘッダーに置く検索。既定は虫眼鏡だけで、押すと横に伸びて入力欄になる */
export function PortalHeaderSearch() {
  const ctx = usePortalSearchContext()
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const close = useCallback(() => {
    setOpen(false)
    ctx?.setQuery('')
  }, [ctx])

  // 開いた直後に入力へフォーカスを移す（アイコンを押した流れで打ち始められる）
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  if (!ctx?.searchable) return null

  return (
    <div className="flex items-center">
      {/* 幅だけを動かす。表示/非表示の入れ替えだとアニメーションが効かない */}
      <div
        className={`relative overflow-hidden transition-[width] duration-200 ease-out ${
          open ? 'w-[200px] sm:w-[240px]' : 'w-0'
        }`}
      >
        <input
          ref={inputRef}
          type="text"
          value={ctx.query}
          onChange={(e) => ctx.setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close()
          }}
          // 空のまま離れたら畳む。入力が残っているときは開いたままにする
          onBlur={() => {
            if (!ctx.query) setOpen(false)
          }}
          placeholder={ctx.placeholder}
          className="h-9 w-full rounded-md border border-input bg-background pl-3 pr-8 text-sm outline-none focus:border-ds-app-accent"
        />
        {ctx.query && (
          <button
            type="button"
            onClick={close}
            aria-label="検索を消す"
            className="absolute right-1 top-1/2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded border-0 bg-transparent p-0 text-muted-foreground hover:text-foreground"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={open ? '検索を閉じる' : '検索'}
        aria-expanded={open}
        className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent transition-colors hover:bg-muted"
      >
        <Search size={24} className={open ? 'text-foreground' : 'text-muted-foreground'} />
      </button>
    </div>
  )
}
