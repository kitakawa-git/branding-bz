import * as React from 'react'
import { cn } from '@/lib/utils'

// ============================================
// FAB（画面右下固定アクションボタン）共通コンポーネント
// ポータル / 管理画面 / スーパー管理画面で共通利用する。
//   <Fab>
//     <FabButton icon={<Plus size={16} />} onClick={...}>新規作成</FabButton>
//   </Fab>
// 保存／キャンセルのように複数並べる場合は FabButton を複数渡す。
// ============================================

// 右下固定コンテナ
export function Fab({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('fixed bottom-8 right-8 z-50 flex items-center gap-3', className)}>
      {children}
    </div>
  )
}

const fabButtonBase =
  'flex items-center justify-center gap-1 h-12 px-5 rounded-full text-sm font-bold cursor-pointer shadow-lg transition-transform hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100'

const fabButtonVariants = {
  // 主要アクション（黒）
  primary: 'bg-foreground text-background',
  // 副次アクション（白／枠線：キャンセル等）
  secondary: 'bg-white text-foreground border border-gray-300',
} as const

type FabButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof fabButtonVariants
  /** ラベル左に表示するアイコン（lucide 等）。ローディング切替は呼び出し側で行う */
  icon?: React.ReactNode
}

export const FabButton = React.forwardRef<HTMLButtonElement, FabButtonProps>(
  ({ className, variant = 'primary', icon, children, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(fabButtonBase, fabButtonVariants[variant], className)}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
)
FabButton.displayName = 'FabButton'
