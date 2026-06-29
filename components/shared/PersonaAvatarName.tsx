// ペルソナの「顔アイコン（絵文字）＋名称」ヘッダー。ポータル/各ツールで共用できる最小単位。
// 読み取り専用（既定）と編集可能（onEmojiClick でアバターをボタン化）の両対応。
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface PersonaAvatarNameProps {
  emoji?: string | null
  name: string
  className?: string        // 外枠（flex行）へ追加
  avatarClassName?: string  // アバター円のサイズ等を上書き（既定: h-12 w-12 text-3xl bg-gray-100）
  nameClassName?: string    // 名称テキストの上書き（既定: text-lg font-bold text-gray-900）
  onEmojiClick?: () => void // 指定時はアバターを「顔アイコンを変更」ボタンにする（編集用）
  fallback?: ReactNode      // emoji 未設定時に表示（例: <UserCircle />）
  children?: ReactNode      // アバター枠内に重ねる要素（例: 絵文字ピッカーのドロップダウン）
}

export function PersonaAvatarName({
  emoji,
  name,
  className = '',
  avatarClassName = 'h-12 w-12 text-3xl bg-gray-100',
  nameClassName = 'text-lg font-bold text-gray-900',
  onEmojiClick,
  fallback,
  children,
}: PersonaAvatarNameProps) {
  const avatarBase = 'flex items-center justify-center rounded-full bg-muted leading-none'
  const inner = emoji
    ? <span role="img" aria-label="顔アイコン">{emoji}</span>
    : fallback ?? null

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="relative shrink-0">
        {onEmojiClick ? (
          <button
            type="button"
            onClick={onEmojiClick}
            title="顔アイコンを変更"
            className={cn(avatarBase, 'transition hover:ring-2 hover:ring-ds-app-accent/40', avatarClassName)}
          >
            {inner}
          </button>
        ) : (
          (emoji || fallback) && (
            <span className={cn(avatarBase, avatarClassName)}>{inner}</span>
          )
        )}
        {children}
      </div>
      <p className={cn('m-0 min-w-0', nameClassName)}>{name}</p>
    </div>
  )
}
