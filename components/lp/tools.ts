import { Target, UserCircle, Palette, Fingerprint, type LucideIcon } from 'lucide-react'

/* 構築ツール（無料）の共通データソース。
   トップページの「無料ツール」セクションと、/features の「構築」セクションで共有する。 */
export type Tool = {
  href: string
  label: string
  icon: LucideIcon
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
    d: 'セグメント・ターゲット・ポジションを整理。AIと対話して「誰に何を届けるか」が定まります。',
    color: 'linear-gradient(135deg,#1d4ed8 0%,#7c3aed 55%,#0ea5e9 100%)',
  },
  {
    href: '/tools/persona',
    label: 'ペルソナビルダーツール',
    icon: UserCircle,
    d: '届けたい相手像をAIと具体化。属性だけでなく、価値観や1日の過ごし方まで描けます。',
    color: 'linear-gradient(160deg,#0f172a,#312e81 60%,#a855f7)',
  },
  {
    href: '/tools/colors',
    label: 'ブランドカラー定義ツール',
    icon: Palette,
    d: '"らしさ"を色で言語化。AIが配色を提案し、その色を選んだ理由まで定義します。',
    color: 'conic-gradient(from 200deg at 60% 40%,#f43f5e,#8b5cf6,#22d3ee,#f43f5e)',
  },
  {
    href: '/tools/personality',
    label: 'パーソナリティ診断ツール',
    icon: Fingerprint,
    d: 'ブランドの人格を10問で診断。BAVと脳タイプの両軸で、ブランドの個性を立体的に。',
    color: 'radial-gradient(120% 120% at 25% 20%,#10b981 0%,#0f172a 65%)',
  },
]
