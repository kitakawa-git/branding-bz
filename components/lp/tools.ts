import { Target, UserCircle, Palette, Fingerprint, type LucideIcon } from 'lucide-react'

/* 構築ツール（無料）の共通データソース。
   トップページの「無料ツール」セクションと、/features の「構築」セクションで共有する。 */
export type Tool = {
  href: string
  label: string
  icon: LucideIcon
  /* 説明文。「|」は画面に出ない文節区切り（components/lp/Phrases.tsx）。
     metadata・JSON-LD などに転用するときは「|」を取り除くこと */
  d: string
  color: string
  /* true のとき文字色を黒系にする（明るい背景用） */
  dark?: boolean
}

export const tools: Tool[] = [
  {
    href: '/tools/stp',
    label: 'STP分析ツール',
    icon: Target,
    d: '市場の分け方と|狙う相手、|立ち位置を|AIと整理し、|「誰に何を届けるか」を|定めます。',
    color: 'linear-gradient(135deg,#1d4ed8 0%,#7c3aed 55%,#0ea5e9 100%)',
  },
  {
    href: '/tools/persona',
    label: 'ペルソナビルダーツール',
    icon: UserCircle,
    d: '届けたい相手像を|AIと具体化。|属性だけでなく、|価値観や|1日の過ごし方まで|描けます。',
    color: 'linear-gradient(160deg,#0f172a,#312e81 60%,#a855f7)',
  },
  {
    href: '/tools/colors',
    label: 'ブランドカラー定義ツール',
    icon: Palette,
    d: 'ブランドの|"らしさ"を|色で言語化。|AIが配色を提案し、|選んだ理由まで|定義します。',
    color: 'conic-gradient(from 200deg at 60% 40%,#f43f5e,#8b5cf6,#22d3ee,#f43f5e)',
  },
  {
    href: '/tools/personality',
    label: 'パーソナリティ診断ツール',
    icon: Fingerprint,
    d: 'ブランドの人格を|10問で診断。|Aaker 5次元と|12アーキタイプで|個性を捉えます。',
    color: 'radial-gradient(120% 120% at 25% 20%,#10b981 0%,#0f172a 65%)',
  },
]
