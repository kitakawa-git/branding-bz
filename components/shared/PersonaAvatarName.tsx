// ペルソナの「顔アイコン（絵文字）＋名称」ヘッダー。ポータル/各ツールで共用できる最小単位。
interface PersonaAvatarNameProps {
  emoji?: string | null
  name: string
  className?: string        // 外枠（flex行）へ追加
  avatarClassName?: string  // アバター円のサイズ等を上書き（既定: h-11 w-11 text-2xl）
  nameClassName?: string    // 名称テキストの上書き（既定: text-base font-bold）
}

export function PersonaAvatarName({
  emoji,
  name,
  className = '',
  avatarClassName = 'h-11 w-11 text-2xl',
  nameClassName = 'text-base font-bold text-foreground',
}: PersonaAvatarNameProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {emoji && (
        <span
          className={`flex shrink-0 items-center justify-center rounded-full bg-muted leading-none ${avatarClassName}`}
          role="img"
          aria-label="顔アイコン"
        >
          {emoji}
        </span>
      )}
      <p className={`m-0 min-w-0 ${nameClassName}`}>{name}</p>
    </div>
  )
}
