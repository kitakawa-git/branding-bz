'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { PaletteProposal } from '@/lib/types/color-tool'
import { FREE_LIMITS } from '@/lib/types/color-tool'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatInterfaceProps {
  sessionId: string
  currentPalette: PaletteProposal
  adjustmentCount: number
  onPaletteUpdate: (palette: PaletteProposal) => void
  onAdjustmentCountChange: (count: number) => void
}

export function ChatInterface({
  sessionId,
  currentPalette,
  adjustmentCount,
  onPaletteUpdate,
  onAdjustmentCountChange,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const remainingTurns = FREE_LIMITS.chatTurnsPerSession - adjustmentCount

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    const trimmed = input.trim()
    if (!trimmed || streaming) return
    if (remainingTurns <= 0) return

    // ユーザーメッセージ追加
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setStreaming(true)

    // アシスタントメッセージ（空で追加、ストリーミングで埋める）
    const assistantId = `assistant-${Date.now()}`
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }])

    try {
      abortRef.current = new AbortController()

      // 会話履歴（現在の messages + 今回のユーザーメッセージ）
      const history = messages.map(m => ({ role: m.role, content: m.content }))

      const res = await fetch('/api/tools/colors/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: trimmed,
          currentPalette,
          history,
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const data = await res.json()
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? { ...m, content: `エラー: ${data.error || '通信エラー'}` }
              : m
          )
        )
        setStreaming(false)
        return
      }

      // SSEストリーミング読み取り
      const reader = res.body?.getReader()
      if (!reader) throw new Error('ストリームを取得できません')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // 未完了行をバッファに残す

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'text') {
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantId
                    ? { ...m, content: m.content + data.content }
                    : m
                )
              )
            } else if (data.type === 'palette') {
              onPaletteUpdate(data.content)
            } else if (data.type === 'error') {
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantId
                    ? { ...m, content: m.content + `\n\nエラー: ${data.content}` }
                    : m
                )
              )
            }
          } catch {
            // パースエラーは無視
          }
        }
      }

      onAdjustmentCountChange(adjustmentCount + 1)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // キャンセル
      } else {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? { ...m, content: '通信エラーが発生しました。' }
              : m
          )
        )
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // アシスタントメッセージ内の ```palette ブロックを除去して表示
  const formatContent = (content: string) => {
    return content.replace(/```palette[\s\S]*?```/g, '').trim()
  }

  return (
    <div className="flex h-full flex-col">
      {/* メッセージエリア */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-center text-sm text-gray-400">
            <div>
              <p className="mb-2">パレットについて相談できます</p>
              <div className="space-y-1 text-xs">
                <p>例：「もう少し落ち着いた雰囲気にしたい」</p>
                <p>例：「アクセントカラーをオレンジ系に変えて」</p>
                <p>例：「競合と差別化できる色にしたい」</p>
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <p className="whitespace-pre-wrap">{formatContent(msg.content)}</p>
              {msg.role === 'assistant' && streaming && msg.content === '' && (
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '300ms' }} />
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 入力エリア */}
      <div className="border-t border-gray-200 p-3">
        <div className="mb-2 flex items-center justify-between text-xs text-gray-400">
          <span>残り {remainingTurns} ターン</span>
          {streaming && (
            <button
              onClick={() => abortRef.current?.abort()}
              className="text-red-400 hover:text-red-500"
            >
              停止
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              remainingTurns <= 0
                ? 'チャット回数の上限に達しました'
                : 'パレットについて相談...'
            }
            disabled={streaming || remainingTurns <= 0}
            className="flex-1 text-sm"
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || streaming || remainingTurns <= 0}
            size="sm"
          >
            送信
          </Button>
        </div>
      </div>
    </div>
  )
}
