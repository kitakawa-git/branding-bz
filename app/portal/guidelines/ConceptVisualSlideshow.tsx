'use client'

// コンセプトビジュアル スライドショー（ポータル ブランド方針）
// - 画像1枚: 静止画（従来の表示と同等）
// - 画像2枚以上: 自動送り＋前後ボタン＋ドットインジケータのスライドショー
import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type Props = {
  images: string[]
  intervalMs?: number  // 自動送り間隔（ミリ秒）
}

export function ConceptVisualSlideshow({ images, intervalMs = 5000 }: Props) {
  const count = images.length
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  const goTo = useCallback((next: number) => {
    if (count === 0) return
    setIndex((next + count) % count)
  }, [count])

  // インデックスが範囲外になった場合の補正（削除等）
  useEffect(() => {
    if (index > count - 1) setIndex(Math.max(0, count - 1))
  }, [count, index])

  // 自動送り（ホバー中は停止）
  useEffect(() => {
    if (count <= 1 || paused) return
    const timer = setInterval(() => setIndex(i => (i + 1) % count), intervalMs)
    return () => clearInterval(timer)
  }, [count, paused, intervalMs])

  if (count === 0) return null

  // 1枚のみ: 従来どおりの静止画
  if (count === 1) {
    return (
      <img
        src={images[0]}
        alt="コンセプトビジュアル"
        className="w-full h-auto object-contain rounded-lg"
      />
    )
  }

  return (
    <div
      className="group relative w-full overflow-hidden rounded-lg"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label="コンセプトビジュアル"
    >
      {/* 高さ固定用サイザー: 常に先頭画像で枠の高さを決める。スライドが変わっても枠の高さは不変（幅は枠いっぱい） */}
      <img
        src={images[0]}
        alt=""
        aria-hidden
        className="block w-full h-auto select-none invisible"
      />
      {/* スライド本体（クロスフェード）。固定枠に object-cover で敷き詰め、はみ出しは切り抜き */}
      {images.map((url, i) => (
        <img
          key={i}
          src={url}
          alt={`コンセプトビジュアル ${i + 1} / ${count}`}
          aria-hidden={i !== index}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${i === index ? 'opacity-100' : 'opacity-0'}`}
        />
      ))}

      {/* 前へ */}
      <button
        type="button"
        onClick={() => goTo(index - 1)}
        aria-label="前の画像"
        className="absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity hover:bg-black/60 group-hover:opacity-100 focus-visible:opacity-100"
      >
        <ChevronLeft size={20} />
      </button>

      {/* 次へ */}
      <button
        type="button"
        onClick={() => goTo(index + 1)}
        aria-label="次の画像"
        className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity hover:bg-black/60 group-hover:opacity-100 focus-visible:opacity-100"
      >
        <ChevronRight size={20} />
      </button>

      {/* ドットインジケータ */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
        {images.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`${i + 1}枚目を表示`}
            aria-current={i === index}
            className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/60 hover:bg-white/80'}`}
          />
        ))}
      </div>
    </div>
  )
}
