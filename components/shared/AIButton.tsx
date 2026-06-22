'use client'

import { Sparkles } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface AIButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  icon?: ReactNode           // 省略時は Sparkles
  size?: 'sm' | 'md' | 'lg'  // 既定: md
}

const sizeClasses: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-5 py-2.5 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2.5',
}

const iconSize: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
}

/**
 * AI機能のアクションボタン（グラデーション・グロー型）
 * 用途：AI再提案・AI生成など、AIを使う主要アクションに使う共通ボタン
 */
export function AIButton({
  children,
  icon,
  size = 'md',
  className = '',
  ...props
}: AIButtonProps) {
  return (
    <button
      {...props}
      className={[
        'ai-action-button relative inline-flex items-center justify-center',
        'rounded-full font-bold text-white',
        'bg-gradient-to-br from-violet-600 to-blue-600',
        'shadow-[0_4px_14px_rgba(124,58,237,0.35),0_1px_3px_rgba(0,0,0,0.1)]',
        'hover:shadow-[0_6px_20px_rgba(124,58,237,0.45),0_1px_3px_rgba(0,0,0,0.12)]',
        'hover:-translate-y-px',
        'transition-all duration-150',
        'overflow-hidden',
        'disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:transform-none disabled:hover:shadow-[0_4px_14px_rgba(124,58,237,0.35),0_1px_3px_rgba(0,0,0,0.1)]',
        sizeClasses[size],
        className,
      ].join(' ')}
    >
      {icon ?? <Sparkles className={iconSize[size]} />}
      <span>{children}</span>
    </button>
  )
}
