'use client'

// 日程調整ツール — 新しく作る
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { EventEditor } from '../../components/EventEditor'
import { useRequireLogin } from '../useRequireLogin'

export default function SorouNewPage() {
  const { ready } = useRequireLogin()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!ready) return null

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <Link href="/tools/sorou/app" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground no-underline hover:text-foreground">
        <ArrowLeft size={14} />一覧へ戻る
      </Link>
      <h1 className="mb-2 text-2xl font-bold text-foreground">日程調整をつくる</h1>
      <p className="mb-5 text-[13px] text-muted-foreground">イベント名と候補日程を決めると、回答してもらう共有リンクができます。</p>
      <EventEditor
        initial={{ title: '', memo: '', sel: {} }}
        submitLabel="日程調整をつくる"
        submitting={submitting}
        error={error}
        onSubmit={async draft => {
          setSubmitting(true)
          setError('')
          try {
            const res = await fetch('/api/tools/sorou/events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(draft),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
              // 429 は「今月の残り回数」の話なので message を優先する
              setError(data.message || data.error || '作成できませんでした')
              setSubmitting(false)
              return
            }
            router.push(`/tools/sorou/e/${data.id}?created=1`)
          } catch {
            setError('作成できませんでした。通信環境を確認してもう一度お試しください。')
            setSubmitting(false)
          }
        }}
      />
    </div>
  )
}
