// 構築ツール（STP/ペルソナ/パーソナリティ/カラー）共通のフォーム見出し・ラベル。
// 全ツールで見た目を統一するため、フィールドの主見出しと補助ラベルをコンポーネント化する。
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

/**
 * フィールドの主見出し（h2）。例: 「企業名」「業種」「事業内容」。
 * required で「*」、optional で「（任意）」を付与。
 * 【全構築ツール共通ルール】標準の下余白は 12px（className="mb-3"）に統一する。
 * 例外（余白ゼロ）= flex見出し行（横にボタン/スイッチ）・space-y 親・見出し直下にキャプションが続く場合は className="mb-0"。
 * 【上余白】デフォルトで mt-8（32px）を付与する。各ステップ/ページの最初に表示される見出しだけは
 * className に mt-0 を含めて上書きすること（cn は tailwind-merge のため後勝ちで上書きされる）。
 */
export function FieldHeading({
  children,
  required,
  optional,
  className,
}: {
  children: ReactNode
  required?: boolean
  optional?: boolean
  className?: string
}) {
  return (
    <h2 className={cn('text-xs font-bold mt-8', className)}>
      {children}
      {required && <span className="text-xs text-red-500 font-normal"> *</span>}
      {optional && <span className="text-xs text-gray-400 font-normal"> （任意）</span>}
    </h2>
  )
}

/**
 * 補助ラベル（フィールド内の小見出し）。例:「業種（大分類）」「自社の強み」「購買決定要因」。
 * 既定: text-[11px] text-gray-500 mb-1 block（className で上書き可）。
 */
export function FieldSubLabel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <label className={cn('text-[11px] text-gray-500 mb-1 block', className)}>{children}</label>
}
