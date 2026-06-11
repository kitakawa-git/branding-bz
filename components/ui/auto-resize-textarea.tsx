'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/** テキスト量に合わせて自動で高さが伸びる textarea */
const AutoResizeTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<'textarea'>
>(({ className, value, onChange, ...props }, ref) => {
  const innerRef = React.useRef<HTMLTextAreaElement | null>(null)

  const resize = React.useCallback(() => {
    const el = innerRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  // value が外部から変わった場合もリサイズ
  React.useEffect(() => {
    resize()
  }, [value, resize])

  // 初回マウント時にもリサイズ
  React.useEffect(() => {
    resize()
  }, [resize])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    resize()
    onChange?.(e)
  }

  return (
    <textarea
      ref={(el) => {
        innerRef.current = el
        if (typeof ref === 'function') ref(el)
        else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el
      }}
      value={value}
      onChange={handleChange}
      className={cn(
        'w-full px-3 py-2.5 bg-white border border-border rounded-lg text-sm outline-none focus:border-ds-app-accent-soft focus:ring-1 focus:ring-ds-app-accent-soft overflow-hidden resize-none',
        className
      )}
      {...props}
    />
  )
})
AutoResizeTextarea.displayName = 'AutoResizeTextarea'

export { AutoResizeTextarea }
