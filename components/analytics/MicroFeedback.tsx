'use client'

import { useState, useEffect } from 'react'
import { getVisitorId } from '@/lib/analytics/track'

const ALLOWED_TAGS = [
  '信頼感',
  '革新的',
  '親しみやすい',
  '専門的',
  '洗練された',
  '情熱的',
  '堅実',
  '遊び心がある',
] as const

interface MicroFeedbackProps {
  companyId: string
  sourceProfileId: string
  companyName: string
}

export function MicroFeedback({ companyId, sourceProfileId, companyName }: MicroFeedbackProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [hidden, setHidden] = useState(false)

  // localStorage で24時間以内の送信済みチェック
  useEffect(() => {
    try {
      const key = `micro_fb_${companyId}_sent`
      const stored = localStorage.getItem(key)
      if (stored) {
        const ts = parseInt(stored, 10)
        if (Date.now() - ts < 24 * 60 * 60 * 1000) {
          setHidden(true)
        } else {
          localStorage.removeItem(key)
        }
      }
    } catch {
      // localStorage使用不可
    }
  }, [companyId])

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag],
    )
  }

  const handleSubmit = async () => {
    if (selectedTags.length === 0 || sending) return
    setSending(true)

    try {
      const res = await fetch('/api/analytics/micro-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          sourceProfileId,
          tags: selectedTags,
          visitorId: getVisitorId(),
        }),
      })

      if (res.ok || res.status === 429) {
        // 429（重複）でも送信済みとして扱う
        setSent(true)
        try {
          localStorage.setItem(`micro_fb_${companyId}_sent`, String(Date.now()))
        } catch {
          // localStorage使用不可
        }
      }
    } catch (err) {
      console.warn('[MicroFeedback] 送信失敗:', err)
    } finally {
      setSending(false)
    }
  }

  // 送信済み or 24h以内に送信済み → 非表示
  if (hidden) return null

  // 送信完了メッセージ
  if (sent) {
    return (
      <div className="pt-2">
        <div className="border-t border-border mb-6" />
        <div className="text-center py-6">
          <p className="text-sm text-foreground/70">
            ご回答ありがとうございました
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-2">
      <div className="border-t border-border mb-6" />

      {/* ヘッダー */}
      <div className="text-center mb-4">
        <p className="text-sm font-semibold text-foreground">
          {companyName}の印象を教えてください
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          複数選択可・匿名
        </p>
      </div>

      {/* タグボタングリッド */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {ALLOWED_TAGS.map(tag => {
          const isSelected = selectedTags.includes(tag)
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`
                h-10 rounded-lg text-sm font-medium transition-all
                ${isSelected
                  ? 'bg-foreground text-background shadow-sm'
                  : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                }
              `}
            >
              {tag}
            </button>
          )
        })}
      </div>

      {/* 送信ボタン */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={selectedTags.length === 0 || sending}
        className={`
          w-full h-11 rounded-lg text-sm font-bold transition-all
          ${selectedTags.length > 0
            ? 'bg-foreground text-background hover:opacity-90'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }
        `}
      >
        {sending ? '送信中...' : '送信する'}
      </button>

      {/* フッター注記 */}
      <p className="text-xs text-muted-foreground text-center mt-3">
        ※回答は匿名で統計目的のみに使用されます
      </p>
    </div>
  )
}
