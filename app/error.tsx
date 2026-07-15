'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { GateShell } from '@/components/admin/GateShell'

/* 全アプリのエラー境界。Next.js が client component として要求する。 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <GateShell
      icon={<AlertTriangle size={48} />}
      title="エラーが発生しました"
      body="申し訳ありません。予期せぬエラーが発生しました。もう一度お試しください。"
      secondary={{ label: 'トップへ', onClick: () => { window.location.href = '/' } }}
      primary={{ label: 'もう一度試す', onClick: () => reset() }}
    />
  )
}
