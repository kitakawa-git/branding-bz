// 構築ツール（STP/ペルソナ/パーソナリティ/カラー）共通のフォーム見出し・ラベル。
// 全ツールで見た目を統一するため、フィールドの主見出しと補助ラベルをコンポーネント化する。
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

/**
 * フィールドの主見出し（h2）。例: 「企業名」「業種」「事業内容」。
 * required で「*」、optional で「（任意）」を付与。余白は既定 mb-3（className で上書き可）。
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
    <h2 className={cn('text-xs font-bold', className)}>
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
