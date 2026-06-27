'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'

/* FAQ用アコーディオン。
   ネイティブ <details> だと open 切替が瞬時で高さ transition が効かないため、
   useState + grid-rows[0fr→1fr] トリックで滑らかに展開する。 */
export default function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between gap-4 py-4 text-left text-sm font-medium text-white"
      >
        <span>{q}</span>
        <Plus
          size={18}
          className={`shrink-0 text-white/40 transition-transform duration-300 ${open ? 'rotate-45' : ''}`}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <p className="pb-5 text-sm leading-relaxed text-white/55">{a}</p>
        </div>
      </div>
    </div>
  )
}
