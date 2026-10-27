'use client'

// ポータル・管理画面の <main>。スケルトンから内容に切り替わるとき、現れた内容をふわっと出す
// （いきなり現れて「パタパタ」見えないように）。
//
// 仕組み: <main> の中を MutationObserver で見て、スケルトンが消えたのと同じ描画で入ってきた要素だけを
// Web Animations API で 0.35 秒かけて出す。
// - CSS の「新しく現れた要素を動かす」方式は使えない。スケルトンと内容の外枠が同じ <div> だと React は
//   要素を作り直さず中身だけ入れ替えるので、アニメーションが走らない画面が多い
// - スケルトンの判定は data-skeleton（components/ui/skeleton.tsx）と animate-pulse（直接書いた読み込み中の箱）
// - アニメーションは終わったら何も残さない（transform が残ると中の position: fixed の要素がずれる）
// - 動きを減らす設定（prefers-reduced-motion）では動かさない
import { useEffect, useRef } from 'react'

const SKELETON = '[data-skeleton], .animate-pulse'
const MAX_ANIMATED = 40

function containsSkeleton(node: Node) {
  return node instanceof Element && (node.matches(SKELETON) || node.querySelector(SKELETON) !== null)
}

export function FadeInMain({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root || typeof MutationObserver === 'undefined') return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')

    const observer = new MutationObserver((records) => {
      if (reduced.matches) return
      let skeletonRemoved = false
      const added: HTMLElement[] = []
      for (const r of records) {
        r.removedNodes.forEach((n) => {
          if (containsSkeleton(n)) skeletonRemoved = true
        })
        r.addedNodes.forEach((n) => {
          // 入ってきた内容の中に、まだ読み込み中の欄（スケルトン）があってもよい。それ自体がスケルトンの要素だけ除く
          if (n instanceof HTMLElement && n.isConnected && !n.matches(SKELETON)) added.push(n)
        })
      }
      if (!skeletonRemoved || added.length === 0) return
      // 入れ子は外側だけ動かす（内側まで動かすと二重にかかる）
      const tops = added.filter((el) => !added.some((o) => o !== el && o.contains(el)))
      for (const el of tops.slice(0, MAX_ANIMATED)) {
        el.animate(
          [
            { opacity: 0, transform: 'translateY(4px)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 350, easing: 'ease-out' }
        )
      }
    })
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return (
    <main ref={ref} className={className}>
      {children}
    </main>
  )
}
