'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Check, Search, Keyboard, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FontSource } from '@/lib/brand-fonts'

// --- Types ---

type FontEntry = {
  family: string
  category: 'japanese' | 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace'
}

// --- ハードコードされたフォントリスト（人気順） ---

const RECOMMENDED_JP_FONTS: FontEntry[] = [
  { family: 'Noto Sans JP', category: 'japanese' },
  { family: 'Zen Kaku Gothic New', category: 'japanese' },
  { family: 'M PLUS 1p', category: 'japanese' },
  { family: 'BIZ UDPGothic', category: 'japanese' },
  { family: 'Zen Old Mincho', category: 'japanese' },
  { family: 'Noto Serif JP', category: 'japanese' },
  { family: 'Shippori Mincho', category: 'japanese' },
]

const RECOMMENDED_LATIN_FONTS: FontEntry[] = [
  { family: 'Roboto', category: 'sans-serif' },
  { family: 'Open Sans', category: 'sans-serif' },
  { family: 'Lato', category: 'sans-serif' },
  { family: 'Montserrat', category: 'sans-serif' },
  { family: 'Inter', category: 'sans-serif' },
  { family: 'Playfair Display', category: 'serif' },
  { family: 'Poppins', category: 'sans-serif' },
  { family: 'Raleway', category: 'sans-serif' },
  { family: 'Oswald', category: 'sans-serif' },
  { family: 'Merriweather', category: 'serif' },
]

const ALL_FONTS: FontEntry[] = [
  // 日本語フォント
  ...RECOMMENDED_JP_FONTS,
  { family: 'Kosugi Maru', category: 'japanese' },
  { family: 'Sawarabi Gothic', category: 'japanese' },
  { family: 'Sawarabi Mincho', category: 'japanese' },
  { family: 'M PLUS Rounded 1c', category: 'japanese' },
  { family: 'Kiwi Maru', category: 'japanese' },
  { family: 'Zen Maru Gothic', category: 'japanese' },
  { family: 'Murecho', category: 'japanese' },
  { family: 'Hina Mincho', category: 'japanese' },
  { family: 'Kaisei Decol', category: 'japanese' },
  { family: 'Kaisei Opti', category: 'japanese' },
  { family: 'Kaisei Tokumin', category: 'japanese' },
  { family: 'Reggae One', category: 'japanese' },
  { family: 'RocknRoll One', category: 'japanese' },
  { family: 'Stick', category: 'japanese' },
  { family: 'Train One', category: 'japanese' },
  { family: 'DotGothic16', category: 'japanese' },
  { family: 'Dela Gothic One', category: 'japanese' },
  { family: 'Rampart One', category: 'japanese' },
  { family: 'Yuji Syuku', category: 'japanese' },
  { family: 'Yuji Mai', category: 'japanese' },
  { family: 'Yuji Boku', category: 'japanese' },
  { family: 'Zen Antique', category: 'japanese' },
  { family: 'Zen Antique Soft', category: 'japanese' },
  { family: 'Shippori Antique', category: 'japanese' },
  { family: 'Shippori Antique B1', category: 'japanese' },
  { family: 'Zen Kurenaido', category: 'japanese' },
  { family: 'BIZ UDMincho', category: 'japanese' },
  { family: 'BIZ UDPMincho', category: 'japanese' },
  { family: 'BIZ UDGothic', category: 'japanese' },
  { family: 'IBM Plex Sans JP', category: 'japanese' },
  // Sans-Serif
  { family: 'Roboto', category: 'sans-serif' },
  { family: 'Open Sans', category: 'sans-serif' },
  { family: 'Montserrat', category: 'sans-serif' },
  { family: 'Poppins', category: 'sans-serif' },
  { family: 'Inter', category: 'sans-serif' },
  { family: 'Lato', category: 'sans-serif' },
  { family: 'Oswald', category: 'sans-serif' },
  { family: 'Raleway', category: 'sans-serif' },
  { family: 'Nunito', category: 'sans-serif' },
  { family: 'Nunito Sans', category: 'sans-serif' },
  { family: 'Ubuntu', category: 'sans-serif' },
  { family: 'Rubik', category: 'sans-serif' },
  { family: 'Work Sans', category: 'sans-serif' },
  { family: 'Quicksand', category: 'sans-serif' },
  { family: 'Mulish', category: 'sans-serif' },
  { family: 'Barlow', category: 'sans-serif' },
  { family: 'DM Sans', category: 'sans-serif' },
  { family: 'Manrope', category: 'sans-serif' },
  { family: 'Outfit', category: 'sans-serif' },
  { family: 'Figtree', category: 'sans-serif' },
  { family: 'Plus Jakarta Sans', category: 'sans-serif' },
  { family: 'Space Grotesk', category: 'sans-serif' },
  { family: 'Lexend', category: 'sans-serif' },
  { family: 'Cabin', category: 'sans-serif' },
  { family: 'Karla', category: 'sans-serif' },
  { family: 'Josefin Sans', category: 'sans-serif' },
  { family: 'Source Sans 3', category: 'sans-serif' },
  { family: 'Libre Franklin', category: 'sans-serif' },
  { family: 'Archivo', category: 'sans-serif' },
  { family: 'Overpass', category: 'sans-serif' },
  // Serif
  { family: 'Playfair Display', category: 'serif' },
  { family: 'Merriweather', category: 'serif' },
  { family: 'Lora', category: 'serif' },
  { family: 'PT Serif', category: 'serif' },
  { family: 'Libre Baskerville', category: 'serif' },
  { family: 'EB Garamond', category: 'serif' },
  { family: 'Cormorant Garamond', category: 'serif' },
  { family: 'Crimson Text', category: 'serif' },
  { family: 'Source Serif 4', category: 'serif' },
  { family: 'DM Serif Display', category: 'serif' },
  { family: 'Bitter', category: 'serif' },
  { family: 'Vollkorn', category: 'serif' },
  { family: 'Spectral', category: 'serif' },
  { family: 'Cardo', category: 'serif' },
  { family: 'Fraunces', category: 'serif' },
  // Display
  { family: 'Bebas Neue', category: 'display' },
  { family: 'Abril Fatface', category: 'display' },
  { family: 'Righteous', category: 'display' },
  { family: 'Russo One', category: 'display' },
  { family: 'Lobster', category: 'display' },
  { family: 'Comfortaa', category: 'display' },
  { family: 'Permanent Marker', category: 'display' },
  { family: 'Fredoka', category: 'display' },
  { family: 'Bungee', category: 'display' },
  { family: 'Anton', category: 'display' },
  // Handwriting
  { family: 'Caveat', category: 'handwriting' },
  { family: 'Dancing Script', category: 'handwriting' },
  { family: 'Pacifico', category: 'handwriting' },
  { family: 'Satisfy', category: 'handwriting' },
  { family: 'Great Vibes', category: 'handwriting' },
  { family: 'Indie Flower', category: 'handwriting' },
  { family: 'Sacramento', category: 'handwriting' },
  { family: 'Kalam', category: 'handwriting' },
  // Monospace
  { family: 'Roboto Mono', category: 'monospace' },
  { family: 'Source Code Pro', category: 'monospace' },
  { family: 'JetBrains Mono', category: 'monospace' },
  { family: 'Fira Code', category: 'monospace' },
  { family: 'IBM Plex Mono', category: 'monospace' },
  { family: 'Space Mono', category: 'monospace' },
]

// --- Constants ---

const ITEM_HEIGHT = 72
const OVERSCAN = 5
const BATCH_SIZE = 50

// --- Lazy Font Loader ---

const loadedFonts = new Set<string>()

function loadFontCSS(family: string) {
  if (loadedFonts.has(family)) return
  loadedFonts.add(family)
  const encoded = family.replace(/ /g, '+')
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encoded}&display=swap`
  document.head.appendChild(link)
}

// --- FontCard Component ---

function FontCard({
  family,
  isSelected,
  onClick,
  previewText,
}: {
  family: string
  isSelected: boolean
  onClick: () => void
  previewText: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadFontCSS(family)
          observer.disconnect()
        }
      },
      { rootMargin: '100px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [family])

  return (
    <div
      ref={ref}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-4 cursor-pointer hover:bg-accent/50 transition-colors',
        isSelected && 'bg-accent'
      )}
      style={{ height: ITEM_HEIGHT }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground m-0 mb-1 truncate">{family}</p>
        <p
          className="text-lg m-0 truncate"
          style={{ fontFamily: `"${family}", sans-serif` }}
        >
          {previewText}
        </p>
      </div>
      {isSelected && (
        <Check size={18} className="shrink-0 text-primary" />
      )}
    </div>
  )
}

// --- VirtualList Component ---

function VirtualList({
  items,
  selected,
  onSelect,
  containerHeight,
  previewText,
}: {
  items: FontEntry[]
  selected: string | null
  onSelect: (family: string) => void
  containerHeight: number
  previewText: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE)

  const displayItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount])
  const totalHeight = displayItems.length * ITEM_HEIGHT

  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN)
  const endIndex = Math.min(
    displayItems.length,
    Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + OVERSCAN
  )
  const visibleItems = displayItems.slice(startIndex, endIndex)

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setScrollTop(el.scrollTop)
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
      setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, items.length))
    }
  }, [items.length])

  useEffect(() => {
    setVisibleCount(BATCH_SIZE)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [items])

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="overflow-y-auto"
      style={{ height: containerHeight }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: startIndex * ITEM_HEIGHT,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map((font) => (
            <FontCard
              key={font.family}
              family={font.family}
              isSelected={selected === font.family}
              onClick={() => onSelect(font.family)}
              previewText={previewText}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// --- Main Component ---

type GoogleFontPickerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: string | null
  onSelect: (family: string, source: FontSource) => void
  mode: 'latin' | 'japanese'
}

export function GoogleFontPicker({
  open,
  onOpenChange,
  value,
  onSelect,
  mode,
}: GoogleFontPickerProps) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(value)
  const [tab, setTab] = useState<'google' | 'manual'>('google')
  const [manualInput, setManualInput] = useState('')

  useEffect(() => {
    if (!open) return
    setSelected(value)
    setSearch('')
    setTab('google')
    setManualInput(value || '')
  }, [open, value])

  const previewText = mode === 'latin'
    ? 'ABCabc 123 The quick brown fox'
    : 'あいうえお アイウエオ 漢字'

  const recommendedFonts = mode === 'latin' ? RECOMMENDED_LATIN_FONTS : RECOMMENDED_JP_FONTS
  const recommendedLabel = mode === 'latin' ? 'おすすめ欧文フォント' : 'おすすめ日本語フォント'

  const filteredFonts = useMemo(() => {
    if (!search.trim()) return ALL_FONTS
    const q = search.toLowerCase()
    return ALL_FONTS.filter((f) => f.family.toLowerCase().includes(q))
  }, [search])

  const handleGoogleSelect = (family: string) => {
    setSelected(family)
    onSelect(family, 'google')
    onOpenChange(false)
  }

  const handleManualSubmit = () => {
    const val = manualInput.trim()
    if (!val) return
    onSelect(val, 'manual')
    onOpenChange(false)
  }

  const showRecommended = !search.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 max-h-[80vh] flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle>フォントを選択</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="px-5 pt-3 flex gap-1">
          <button
            type="button"
            onClick={() => setTab('google')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors',
              tab === 'google'
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            <Globe size={13} />
            Google Fonts
          </button>
          <button
            type="button"
            onClick={() => setTab('manual')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors',
              tab === 'manual'
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            <Keyboard size={13} />
            手動入力
          </button>
        </div>

        {tab === 'google' ? (
          <>
            {/* Search */}
            <div className="px-5 py-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="フォント名で検索..."
                  className="pl-9 h-9"
                />
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {/* Recommended Fonts */}
              {showRecommended && (
                <div>
                  <p className="text-xs font-bold text-muted-foreground px-5 py-2 m-0 bg-muted/50 sticky top-0 z-10">
                    {recommendedLabel}
                  </p>
                  {recommendedFonts.map((font) => (
                    <FontCard
                      key={`rec-${font.family}`}
                      family={font.family}
                      isSelected={selected === font.family}
                      onClick={() => handleGoogleSelect(font.family)}
                      previewText={previewText}
                    />
                  ))}
                </div>
              )}

              {/* All Fonts */}
              <div>
                {showRecommended && (
                  <p className="text-xs font-bold text-muted-foreground px-5 py-2 m-0 bg-muted/50 sticky top-0 z-10">
                    すべてのフォント
                  </p>
                )}
                <VirtualList
                  items={filteredFonts}
                  selected={selected}
                  onSelect={handleGoogleSelect}
                  containerHeight={400}
                  previewText={previewText}
                />
              </div>
            </div>
          </>
        ) : (
          /* Manual Input Tab */
          <div className="px-5 py-4 space-y-4">
            <p className="text-xs text-muted-foreground m-0">
              Google Fontsにないフォントや、自社独自のフォント名を入力してください。
              ユーザーの環境にインストールされているフォントが使用されます。
            </p>
            <Input
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="フォント名を入力..."
              className="h-10"
              onKeyDown={(e) => { if (e.key === 'Enter') handleManualSubmit() }}
            />
            <Button
              onClick={handleManualSubmit}
              disabled={!manualInput.trim()}
              className="w-full"
            >
              決定
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
