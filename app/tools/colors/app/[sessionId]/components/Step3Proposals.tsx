'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PaletteCard } from '../../components/PaletteCard'
import type { BrandColorProject, PaletteProposal } from '@/lib/types/color-tool'

interface Step3ProposalsProps {
  project: BrandColorProject
  sessionId: string
  onNext: (data: Record<string, unknown>) => Promise<boolean>
  onBack: () => Promise<boolean>
  onUpdateProject: (data: Partial<BrandColorProject>) => void
}

export function Step3Proposals({
  project,
  sessionId,
  onNext,
  onBack,
  onUpdateProject,
}: Step3ProposalsProps) {
  const [proposals, setProposals] = useState<PaletteProposal[]>(project.proposals || [])
  const [selectedId, setSelectedId] = useState<string | null>(project.selected_proposal_id || null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  // 初回: まだ提案がなければ自動生成
  useEffect(() => {
    if (proposals.length === 0) {
      generateProposals()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const generateProposals = useCallback(async () => {
    setGenerating(true)
    setError('')

    try {
      const res = await fetch('/api/tools/colors/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'パレット生成に失敗しました')
        return
      }

      const { proposals: newProposals } = await res.json()
      setProposals(newProposals)
      setSelectedId(null)
      onUpdateProject({ proposals: newProposals, selected_proposal_id: null })
    } catch (err) {
      setError(err instanceof Error ? err.message : '通信エラーが発生しました')
    } finally {
      setGenerating(false)
    }
  }, [sessionId, onUpdateProject])

  const handleSelect = (id: string) => {
    setSelectedId(id)
  }

  const handleNext = async () => {
    if (!selectedId) {
      toast.error('パレットを1つ選んでください')
      return
    }

    const selected = proposals.find(p => p.id === selectedId)
    if (!selected) return

    const ok = await onNext({
      selected_proposal_id: selectedId,
      current_palette: selected,
    })
    if (!ok) {
      toast.error('保存に失敗しました')
    }
  }

  // ローディング状態
  if (generating) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-6">Step 3: AI提案</h1>
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
            <svg className="h-8 w-8 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-25" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p className="text-base font-bold text-gray-900">
              AIがカラーパレットを生成しています
            </p>
            <p className="mt-1 text-sm text-gray-500">
              ブランドの特徴を分析し、最適な3パターンを提案中...
            </p>
          </div>
          <div className="space-y-4 pt-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border border-gray-100 overflow-hidden">
                <Skeleton className="h-20 w-full rounded-none" />
                <div className="space-y-3 p-5">
                  <Skeleton className="h-6 w-1/3" />
                  <Skeleton className="h-4 w-2/3" />
                  <div className="flex gap-3">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <Skeleton className="h-5 w-5 rounded-full" />
                  </div>
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            ))}
          </div>
          </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // エラー状態
  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-6">Step 3: AI提案</h1>
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5">
            <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-500" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path d="M12 8v4m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-sm font-medium text-red-700">{error}</p>
          <div className="mt-4 flex justify-center gap-3">
            <Button variant="outline" onClick={onBack}>
              戻る
            </Button>
            <Button onClick={generateProposals}>
              再生成する
            </Button>
            </div>
          </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 提案表示
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Step 3: AI提案</h1>

      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">
          <div className="mb-5 flex items-center justify-between">
            <p className="text-[13px] text-muted-foreground">
              3パターンの提案からお好みのパレットを選んでください
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={generateProposals}
              disabled={generating}
            >
              再生成
            </Button>
          </div>

          {/* パレットカード（1カラム縦積み） */}
          <div className="space-y-4">
            {proposals.map((proposal) => (
              <PaletteCard
                key={proposal.id}
                proposal={proposal}
                selected={selectedId === proposal.id}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ナビゲーション */}
      <div className="mt-6 flex gap-3">
        <Button variant="outline" onClick={onBack}>
          戻る
        </Button>
        <Button
          onClick={handleNext}
          disabled={!selectedId}
          className="flex-1"
        >
          {selectedId ? 'この案で調整に進む' : 'パレットを選択してください'}
        </Button>
      </div>
    </div>
  )
}
