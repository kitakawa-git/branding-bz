import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { Tool } from './tools'

/* 構築ツール（無料）共通カード。
   背景はツール固有のグラデーション。dark=true のときだけ文字色を黒系へ反転。
   ホバーで僅かに浮き上がる。 */
export default function ToolCard({ tool }: { tool: Tool }) {
  const isDark = !!tool.dark
  return (
    <Link href={tool.href} className="block h-full">
      <div
        className="group h-full rounded-3xl p-6 transition-transform hover:-translate-y-1"
        style={{ background: tool.color }}
      >
        <div
          className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border ${
            isDark ? 'border-black/15 bg-black/10' : 'border-white/25 bg-white/15'
          }`}
        >
          <tool.icon size={20} className={isDark ? 'text-black' : 'text-white'} />
        </div>
        <h3 className={`text-base font-bold ${isDark ? 'text-black' : 'text-white'}`}>{tool.label}</h3>
        <p className={`mt-2 text-sm leading-relaxed ${isDark ? 'text-black/70' : 'text-white/80'}`}>{tool.d}</p>
        <div
          className={`mt-4 inline-flex items-center gap-1 text-sm font-medium ${
            isDark ? 'text-black/70 group-hover:text-black' : 'text-white/80 group-hover:text-white'
          }`}
        >
          試してみる <ArrowRight size={15} />
        </div>
      </div>
    </Link>
  )
}
