'use client'

// ブランドオントロジーのAIレビュー表示パネル（BrandMapSection から抽出・サマリーハブに配置）。
// 挙動は移設前と不変:
// - 保存済み（brand_map_reviews）があれば固定表示（AI呼び出しなし・生成日時付き）
// - 無ければ初回表示時に1回だけ自動生成して保存（関係0件の会社は案内のみ・生成も保存もしない）
// - 「再生成」はボタン押下時のみ上書き。鮮度（保存時とデータが変わった）はヒント表示のみ
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { RotateCcw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

export default function MapReviewPanel({ companyId }: { companyId: string }) {
  const [review, setReview] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [reason, setReason] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchReview = async (regenerate: boolean) => {
    setLoading(true)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token || ''
      const res = await fetch('/api/superadmin/map-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ companyId, regenerate }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      if (!json.review) {
        setReason((json.reason as string) || 'レビューを生成できませんでした')
        if (regenerate) toast.error((json.reason as string) || 'レビューを生成できませんでした')
        return
      }
      setReview(json.review as string)
      setStale(json.stale === true)
      setReason(null)
    } catch (err) {
      console.error('[MapReview] 取得/生成エラー:', err)
      setReason('レビューを取得できませんでした')
      if (regenerate) {
        toast.error('AIレビューの生成に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
      }
    } finally {
      setLoading(false)
    }
  }

  // 表示時に保存済みを取得（保存が無い会社はこの初回だけ自動生成・保存される。
  // 関係0件の会社はAPI側で生成もAI呼び出しもしない）
  useEffect(() => {
    fetchReview(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  if (loading && !review) {
    return (
      <p className="text-[13px] text-muted-foreground border border-border bg-muted/40 rounded-lg p-3 m-0">
        AIレビューを取得中...（初回のみ自動生成されます）
      </p>
    )
  }

  if (!review) {
    return (
      <p className="text-[13px] text-muted-foreground border border-border bg-muted/40 rounded-lg p-3 m-0">
        {reason ?? 'AIレビューはまだありません'}
      </p>
    )
  }

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/30 p-4">
      <div className="flex flex-wrap items-center gap-1.5 mb-2 text-xs font-bold text-ds-app-accent">
        <Sparkles className="h-3.5 w-3.5" />
        レビュー（AI生成）
        <span className="grow" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fetchReview(true)}
          disabled={loading}
          className="h-7 px-2.5 text-[12px]"
        >
          <RotateCcw size={13} />
          {loading ? '再生成中...' : '再生成'}
        </Button>
      </div>
      {stale && (
        <p className="text-[12px] text-amber-700 border border-amber-200 bg-amber-50/60 rounded-md px-2.5 py-1.5 mb-2">
          データが更新されています。再生成をおすすめします
        </p>
      )}
      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words m-0">{review}</p>
    </div>
  )
}
