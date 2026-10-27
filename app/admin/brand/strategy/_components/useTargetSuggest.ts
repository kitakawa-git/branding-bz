// AIターゲット提案（残り回数の取得・提案の実行・選択候補の主なターゲットへの追加）をまとめたフック
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { type TargetSuggestion } from '@/components/brand/TargetSuggestDialog'
import { type TargetSegment } from './types'

export function useTargetSuggest(
  companyId: string | null,
  targetSegments: TargetSegment[],
  setTargetSegments: (segments: TargetSegment[]) => void,
) {
  // AIターゲット提案
  const [targetSuggesting, setTargetSuggesting] = useState(false)
  const [targetRemaining, setTargetRemaining] = useState<number | null>(null)
  const [targetResetsAt, setTargetResetsAt] = useState<string | null>(null)
  const [targetSuggestOpen, setTargetSuggestOpen] = useState(false)
  const [targetSuggestions, setTargetSuggestions] = useState<TargetSuggestion[]>([])

  // AIターゲット提案の今月残り回数を取得（初期表示用）
  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    fetch('/api/admin/targets/suggest')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data) return
        if (typeof data.remaining === 'number') setTargetRemaining(data.remaining)
        if (data.resetsAt) setTargetResetsAt(data.resetsAt)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [companyId])

  // AIでターゲットを提案
  const handleSuggestTargets = async () => {
    if (targetSuggesting) return
    if (targetRemaining !== null && targetRemaining <= 0) {
      toast.error('今月の利用上限に達しました')
      return
    }
    setTargetSuggesting(true)
    try {
      const res = await fetch('/api/admin/targets/suggest', { method: 'POST' })
      const data = await res.json().catch(() => ({}))

      if (res.status === 429) {
        setTargetRemaining(0)
        if (data.resetsAt) setTargetResetsAt(data.resetsAt)
        toast.error('今月の利用上限に達しました')
        return
      }
      if (!res.ok) {
        toast.error('ターゲットの提案に失敗しました。時間をおいて再度お試しください')
        return
      }

      if (typeof data.remaining === 'number') setTargetRemaining(data.remaining)
      if (data.resetsAt) setTargetResetsAt(data.resetsAt)

      const list: TargetSuggestion[] = Array.isArray(data.suggestions) ? data.suggestions : []
      if (list.length === 0) {
        toast.info('新たなターゲット候補は見つかりませんでした')
        return
      }
      setTargetSuggestions(list)
      setTargetSuggestOpen(true)
    } catch (err) {
      console.error('[BrandStrategy] AIターゲット提案エラー:', err)
      toast.error('ターゲットの提案に失敗しました。時間をおいて再度お試しください')
    } finally {
      setTargetSuggesting(false)
    }
  }

  // 選択した候補を target_segments に APPEND（名前重複はスキップ）
  const addSelectedTargets = (selected: TargetSuggestion[]) => {
    const existingNames = new Set(targetSegments.map(t => t.name.trim().toLowerCase()).filter(Boolean))
    const toAdd: TargetSegment[] = []
    let skipped = 0
    selected.forEach(s => {
      const n = s.name.trim().toLowerCase()
      if (!s.name.trim() || existingNames.has(n)) {
        skipped++
        return
      }
      existingNames.add(n)
      toAdd.push({ name: s.name.trim(), description: s.description?.trim() || '' })
    })
    if (toAdd.length > 0) setTargetSegments([...targetSegments, ...toAdd])
    setTargetSuggestOpen(false)
    const parts: string[] = []
    if (toAdd.length > 0) parts.push(`${toAdd.length}件を追加しました`)
    if (skipped > 0) parts.push(`重複${skipped}件をスキップ`)
    const msg = parts.length > 0 ? parts.join('・') : '追加対象がありませんでした'
    if (toAdd.length > 0) toast.success(`${msg}（「保存」で確定します）`)
    else toast.info(msg)
  }

  return {
    targetSuggesting,
    targetRemaining,
    targetResetsAt,
    targetSuggestOpen,
    setTargetSuggestOpen,
    targetSuggestions,
    handleSuggestTargets,
    addSelectedTargets,
  }
}
