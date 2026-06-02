'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../components/AdminDataProvider'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { WandSparkles, Loader2, Check, Settings } from 'lucide-react'

const ALL_TAGS = [
  '信頼感',
  '革新的',
  '親しみやすい',
  '専門的',
  '洗練された',
  '情熱的',
  '堅実',
  '遊び心がある',
] as const

interface TagMapping {
  tag: string
  is_expected: boolean
  updated_at: string | null
}

export default function BrandScoreSettingsPage() {
  const { companyId } = useAuth()

  const [mappings, setMappings] = useState<TagMapping[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false)
  const [pendingSuggestion, setPendingSuggestion] = useState<string[] | null>(null)

  // タグマッピング取得
  const fetchMappings = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/brand-score/tag-mappings?company_id=${companyId}`)
      if (!res.ok) throw new Error('取得失敗')
      const data = await res.json()
      setMappings(data.mappings || [])
    } catch (err) {
      console.error('[settings] タグマッピング取得エラー:', err)
      toast.error('タグマッピングの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    fetchMappings()
  }, [fetchMappings])

  // タグのトグル
  const toggleTag = (tag: string) => {
    setMappings(prev =>
      prev.map(m => (m.tag === tag ? { ...m, is_expected: !m.is_expected } : m)),
    )
  }

  // 選択中タグ数
  const selectedCount = mappings.filter(m => m.is_expected).length

  // 保存
  const handleSave = async () => {
    if (!companyId) return
    setSaving(true)
    try {
      const res = await fetch('/api/brand-score/tag-mappings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          mappings: mappings.map(m => ({ tag: m.tag, is_expected: m.is_expected })),
        }),
      })
      if (!res.ok) throw new Error('保存失敗')
      toast.success('保存しました')
    } catch (err) {
      console.error('[settings] 保存エラー:', err)
      toast.error('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  // AI提案の適用
  const applySuggestion = (tags: string[]) => {
    setMappings(prev =>
      prev.map(m => ({ ...m, is_expected: tags.includes(m.tag) })),
    )
  }

  // AI提案
  const handleSuggest = async () => {
    if (!companyId) return
    setSuggesting(true)
    try {
      const res = await fetch('/api/brand-score/tag-mappings/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'AI提案に失敗しました')
      }
      const data = await res.json()
      const suggestedTags: string[] = data.expected_tags || []

      // 既に選択がある場合は確認ダイアログ
      if (selectedCount > 0) {
        setPendingSuggestion(suggestedTags)
        setShowOverwriteDialog(true)
      } else {
        applySuggestion(suggestedTags)
        toast.success('AIの提案を反映しました')
      }
    } catch (err) {
      console.error('[settings] AI提案エラー:', err)
      toast.error(err instanceof Error ? err.message : 'AI提案に失敗しました')
    } finally {
      setSuggesting(false)
    }
  }

  // 上書き確認ダイアログの承認
  const handleConfirmOverwrite = () => {
    if (pendingSuggestion) {
      applySuggestion(pendingSuggestion)
      toast.success('AIの提案を反映しました')
    }
    setPendingSuggestion(null)
    setShowOverwriteDialog(false)
  }

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Settings size={20} />
            ブランドスコア設定
          </h1>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            名刺を閲覧した方から集めた印象と、期待するブランドイメージとの一致度を測定します。
            <br className="hidden sm:block" />
            あなたの企業で選ばれてほしいタグを3〜4個選んでください。
          </p>
        </div>
      </div>

      {/* AI提案ボタン */}
      <div className="mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSuggest}
          disabled={suggesting}
        >
          {suggesting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <WandSparkles size={14} />
          )}
          {suggesting ? 'AI提案中...' : 'AIに提案してもらう'}
        </Button>
      </div>

      {/* タグ選択エリア */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {mappings.map(m => (
            <Card
              key={m.tag}
              className={`cursor-pointer transition-all hover:shadow-md ${
                m.is_expected
                  ? 'border-blue-500 bg-blue-50 shadow-sm'
                  : 'border-gray-200 bg-white'
              }`}
              onClick={() => toggleTag(m.tag)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <span
                  className={`text-sm font-medium ${
                    m.is_expected ? 'text-blue-700' : 'text-gray-700'
                  }`}
                >
                  {m.tag}
                </span>
                {m.is_expected && (
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                    <Check size={12} className="text-white" />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 選択数とヒント */}
      {!loading && (
        <p className="text-xs text-muted-foreground mb-6">
          {selectedCount}個選択中
          {selectedCount > 0 && selectedCount < 3 && '（3〜4個の選択を推奨します）'}
          {selectedCount > 4 && '（3〜4個の選択を推奨します）'}
        </p>
      )}

      {/* 保存 FAB（右下固定・include-bz node の FabButton と同装飾） */}
      {!loading && (
        <div className="fixed bottom-8 right-8 z-50 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-1 h-12 px-5 rounded-full hover:scale-105 transition-transform cursor-pointer text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 bg-foreground text-background shadow-lg"
          >
            <Check size={16} />
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      )}

      {/* 上書き確認ダイアログ */}
      <AlertDialog open={showOverwriteDialog} onOpenChange={setShowOverwriteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>現在の設定を上書きしますか？</AlertDialogTitle>
            <AlertDialogDescription>
              AIが提案したタグで現在の選択を置き換えます。この操作は保存するまで確定しません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingSuggestion(null)}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmOverwrite}>
              上書きする
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
