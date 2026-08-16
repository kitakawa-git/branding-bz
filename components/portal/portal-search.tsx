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

/**
 * ヘッダーに置く検索。既定は虫眼鏡だけで、押すと横に伸びて入力欄になる。
 * 伸びたあとの虫眼鏡はフィールドの中（左端）に収まる。
 *
 * ⚠️ ボタンと入力欄を別要素にすると、開閉で要素が入れ替わってアニメーションが切れる。
 *    1つの器の幅を動かし、中の虫眼鏡はそのまま置いておく作りにしている。
 */
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
    <div
      className={`relative flex items-center overflow-hidden transition-all duration-200 ease-out ${
        open
          ? 'h-9 w-[200px] rounded-md border border-input bg-background pl-2 pr-1 sm:w-[240px]'
          : 'h-11 w-11 rounded-md border border-transparent'
      }`}
    >
      {/* 閉じているときは44px のタップ領域（CLAUDE.md の基準）。
          開いたらフィールド内の飾りになるので、押せる見た目をやめる */}
      <button
        type="button"
        onClick={() => !open && setOpen(true)}
        aria-label="検索"
        aria-expanded={open}
        tabIndex={open ? -1 : 0}
        className={`flex shrink-0 items-center justify-center border-0 bg-transparent p-0 transition-colors ${
          open
            ? 'size-5 cursor-default text-muted-foreground'
            : 'size-11 cursor-pointer rounded-md text-muted-foreground hover:bg-muted'
        }`}
      >
        <Search size={open ? 18 : 24} />
      </button>

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
        tabIndex={open ? 0 : -1}
        className={`min-w-0 bg-transparent text-sm outline-none transition-opacity duration-200 ${
          open ? 'ml-2 flex-1 opacity-100' : 'w-0 opacity-0'
        }`}
      />

      {open && ctx.query && (
        <button
          type="button"
          onClick={close}
          aria-label="検索を消す"
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded border-0 bg-transparent p-0 text-muted-foreground hover:text-foreground"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
