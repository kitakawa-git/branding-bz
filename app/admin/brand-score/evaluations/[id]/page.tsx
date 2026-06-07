'use client'

// バリュー評価シート 詳細＝評価軸エディタ
// （バリュー読み込み・AIで5段階基準生成・レビュー・手動編集・保存）
// 理解度テストの設問エディタ（quizzes/[id]/page.tsx）の構成・流儀をミラーしつつ、
// 評価項目モデル（5段階の行動記述）に合わせて実装。
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAuth } from '../../../components/AdminDataProvider'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import {
  ArrowLeft,
  WandSparkles,
  Loader2,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  RefreshCw,
  ListChecks,
} from 'lucide-react'
import { Fab, FabButton } from '@/components/ui/fab'
import { setPageCache } from '@/lib/page-cache'
import type {
  CriterionLevel,
  EvaluationCriterion,
  EvaluationSheet,
} from '@/lib/types/brand-evaluation'
import { emptyLevels, hasLevelContent } from '@/lib/brand-score/evaluation'

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: '下書き', className: 'bg-gray-100 text-gray-700' },
  active: { label: '運用中', className: 'bg-green-100 text-green-700' },
  archived: { label: 'アーカイブ', className: 'bg-gray-100 text-gray-500' },
}

const SOURCE_CONFIG: Record<string, { label: string; className: string }> = {
  value: { label: 'バリュー', className: 'bg-purple-100 text-purple-700' },
  action_guideline: { label: '行動指針', className: 'bg-amber-100 text-amber-700' },
  custom: { label: 'カスタム', className: 'bg-blue-100 text-blue-700' },
}

// 5段階のラベルとレベル設計のヒント（プレースホルダ）
const LEVEL_META: { level: number; label: string; hint: string }[] = [
  { level: 1, label: 'Lv1', hint: '期待を満たさない最低限' },
  { level: 2, label: 'Lv2', hint: '一部できている' },
  { level: 3, label: 'Lv3', hint: '期待どおり（標準）' },
  { level: 4, label: 'Lv4', hint: '期待を上回る' },
  { level: 5, label: 'Lv5', hint: '模範・卓越し周囲を巻き込む' },
]

// 生成結果（mode all / single 共通）
type GeneratedCriterion = { id: string; title: string; levels: CriterionLevel[] }

export default function EvaluationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { companyId } = useAuth()
  const sheetId = params.id as string

  const [sheet, setSheet] = useState<EvaluationSheet | null>(null)
  const [criteria, setCriteria] = useState<EvaluationCriterion[]>([])
  const [loading, setLoading] = useState(true)

  // シートメタ（ローカル編集）
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState('draft')

  // アクション状態
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // 上書き確認（生成結果を適用する前に既存記述がある場合）
  const [pendingGen, setPendingGen] = useState<GeneratedCriterion[] | null>(null)

  const fetchData = useCallback(async () => {
    if (!sheetId) return
    try {
      const res = await fetch(`/api/brand-score/evaluation-sheets/${sheetId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const s: EvaluationSheet = data.sheet
      // levels は常に5要素に正規化された状態で保持する（欠落データの保険）
      const list: EvaluationCriterion[] = (data.criteria || []).map(
        (c: EvaluationCriterion) => ({
          ...c,
          levels:
            Array.isArray(c.levels) && c.levels.length === 5 ? c.levels : emptyLevels(),
        })
      )
      setSheet(s)
      setCriteria(list)
      setTitle(s.title ?? '')
      setStatus(s.status ?? 'draft')
    } catch (err) {
      console.error('[EvaluationEditor] データ取得エラー:', err)
      toast.error('評価シートの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [sheetId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── ローカル編集ハンドラ ──
  const updateCriterion = (id: string, patch: Partial<EvaluationCriterion>) => {
    setCriteria((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  const updateLevel = (id: string, level: number, description: string) => {
    setCriteria((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              levels: c.levels.map((l) => (l.level === level ? { ...l, description } : l)),
            }
          : c
      )
    )
  }

  // ── 評価項目を手動追加（即時 POST して id を確定。他カードの編集は保持） ──
  const handleAddItem = async () => {
    if (adding) return
    setAdding(true)
    try {
      const res = await fetch(`/api/brand-score/evaluation-sheets/${sheetId}/criteria`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '新しい評価項目' }),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      const created: EvaluationCriterion = {
        ...data.criterion,
        levels:
          Array.isArray(data.criterion.levels) && data.criterion.levels.length === 5
            ? data.criterion.levels
            : emptyLevels(),
      }
      setCriteria((prev) => [...prev, created])
      toast.success('評価項目を追加しました')
    } catch (err) {
      console.error('[EvaluationEditor] 項目追加エラー:', err)
      toast.error(err instanceof Error ? err.message : '評価項目の追加に失敗しました')
    } finally {
      setAdding(false)
    }
  }

  // ── 評価項目削除 ──
  const handleDeleteCriterion = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(
        `/api/brand-score/evaluation-sheets/${sheetId}/criteria/${deleteId}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      setCriteria((prev) => prev.filter((c) => c.id !== deleteId))
      setDeleteId(null)
      toast.success('評価項目を削除しました')
    } catch (err) {
      console.error('[EvaluationEditor] 項目削除エラー:', err)
      toast.error(err instanceof Error ? err.message : '評価項目の削除に失敗しました')
    }
  }

  // ── 生成結果をローカル state に反映（レビュー＝テキストエリアに表示） ──
  const applyGenerated = (generated: GeneratedCriterion[]) => {
    setCriteria((prev) =>
      prev.map((c) => {
        const g = generated.find((x) => x.id === c.id)
        return g ? { ...c, levels: g.levels } : c
      })
    )
    toast.success('AIが5段階基準を生成しました。内容を確認して保存してください')
  }

  // 生成結果を適用する前に上書き判定（既存記述があれば確認ダイアログ）
  const reviewGenerated = (generated: GeneratedCriterion[]) => {
    const willOverwrite = generated.some((g) => {
      const local = criteria.find((c) => c.id === g.id)
      return local && hasLevelContent(local.levels)
    })
    if (willOverwrite) {
      setPendingGen(generated)
    } else {
      applyGenerated(generated)
    }
  }

  // ── AIで5段階基準を生成（シート全体） ──
  const handleGenerateAll = async () => {
    if (generating) return
    setGenerating(true)
    try {
      const res = await fetch(
        `/api/brand-score/evaluation-sheets/${sheetId}/generate-criteria`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'all' }),
        }
      )
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      const generated: GeneratedCriterion[] = data.criteria || []
      if (generated.length === 0) {
        toast.error('生成結果が空でした。ブランドデータをご確認ください')
        return
      }
      reviewGenerated(generated)
    } catch (err) {
      console.error('[EvaluationEditor] AI生成エラー:', err)
      toast.error(err instanceof Error ? err.message : 'AI生成に失敗しました')
    } finally {
      setGenerating(false)
    }
  }

  // ── この項目だけ再生成（mode single） ──
  const handleRegenerateOne = async (criterionId: string) => {
    if (regeneratingId) return
    setRegeneratingId(criterionId)
    try {
      const res = await fetch(
        `/api/brand-score/evaluation-sheets/${sheetId}/generate-criteria`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'single', criterion_id: criterionId }),
        }
      )
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      const generated: GeneratedCriterion[] = data.criteria || []
      if (generated.length === 0) {
        toast.error('生成結果が空でした。ブランドデータをご確認ください')
        return
      }
      reviewGenerated(generated)
    } catch (err) {
      console.error('[EvaluationEditor] 単項目再生成エラー:', err)
      toast.error(err instanceof Error ? err.message : 'AI生成に失敗しました')
    } finally {
      setRegeneratingId(null)
    }
  }

  // ── 保存（シートメタ＋全評価項目を一括 PATCH） ──
  const handleSaveAll = async () => {
    if (saving) return
    if (!title.trim()) {
      toast.error('シートタイトルを入力してください')
      return
    }
    if (criteria.some((c) => !c.title.trim())) {
      toast.error('評価項目名が未入力の項目があります')
      return
    }
    setSaving(true)
    try {
      // シートメタ
      const sheetRes = await fetch(`/api/brand-score/evaluation-sheets/${sheetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), status }),
      })
      if (!sheetRes.ok) {
        const errData = await sheetRes.json()
        throw new Error(errData.error || `HTTP ${sheetRes.status}`)
      }

      // 各評価項目（並列）
      const results = await Promise.all(
        criteria.map((c, i) =>
          fetch(
            `/api/brand-score/evaluation-sheets/${sheetId}/criteria/${c.id}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: c.title.trim(),
                description: c.description,
                levels: c.levels,
                weight: c.weight,
                is_active: c.is_active,
                sort_order: i,
              }),
            }
          )
        )
      )
      const failed = results.filter((r) => !r.ok)
      if (failed.length > 0) {
        throw new Error(`${failed.length}件の評価項目の保存に失敗しました`)
      }

      // 一覧キャッシュを破棄して最新化（戻ったとき件数・更新日が古くならないように）
      if (companyId) setPageCache(`admin-evaluations-${companyId}`, null)
      toast.success('保存しました')
      await fetchData() // サーバーを正として再取得＝往復しても巻き戻らない
    } catch (err) {
      console.error('[EvaluationEditor] 保存エラー:', err)
      toast.error(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-24 w-full mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!sheet) return null

  const statusConfig = STATUS_CONFIG[sheet.status] || STATUS_CONFIG.draft
  const noCriteria = criteria.length === 0

  return (
    <div className="pb-24">
      {/* ヘッダー: 戻る + タイトル + ステータス */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={() => router.push('/admin/brand-score/evaluations')}
        >
          <ArrowLeft size={18} />
        </Button>
        <h1 className="text-lg font-bold text-foreground flex-1 truncate">{sheet.title}</h1>
        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${statusConfig.className}`}>
          {statusConfig.label}
        </Badge>
      </div>

      {/* シートメタ編集カード */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-4">
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1.5 block">シートタイトル</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="w-44">
              <label className="text-sm font-medium mb-1.5 block">ステータス</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">下書き</SelectItem>
                  <SelectItem value="active">運用中</SelectItem>
                  <SelectItem value="archived">アーカイブ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* アクションバー */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button onClick={handleGenerateAll} disabled={generating || noCriteria}>
          {generating ? (
            <Loader2 size={16} className="animate-spin mr-1" />
          ) : (
            <WandSparkles size={16} className="mr-1" />
          )}
          AIで5段階基準を生成
        </Button>
        <Button variant="outline" onClick={handleAddItem} disabled={adding}>
          {adding ? (
            <Loader2 size={16} className="animate-spin mr-1" />
          ) : (
            <Plus size={16} className="mr-1" />
          )}
          項目を追加
        </Button>
      </div>

      {/* バリュー0件（評価項目0件）時の導線 */}
      {noCriteria && (
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-8 text-center">
            <ListChecks size={36} className="mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm mb-1">評価項目がまだありません</p>
            <p className="text-muted-foreground/70 text-xs mb-4 leading-relaxed">
              評価項目は自社のバリュー（行動規範）から生成されます。まず
              <Link href="/admin/brand/guidelines" className="text-blue-600 underline mx-1">
                ブランド方針
              </Link>
              でバリューを登録してください。登録済みのバリューはシート作成時に取り込まれます。
              <br />
              （単発の項目を手動で足す場合は「項目を追加」から作成できます）
            </p>
            <Link href="/admin/brand/guidelines">
              <Button variant="outline" size="sm">
                ブランド方針へ
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* レビューの注意 */}
      {!noCriteria && (
        <div className="flex items-start gap-2 mb-4 text-xs text-muted-foreground bg-muted/40 rounded-md p-3">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>
            AIが生成した5段階基準は下書きです。観察可能な行動になっているか確認・編集してから「保存」してください。
          </span>
        </div>
      )}

      {/* 評価項目カード群 */}
      {!noCriteria && (
        <div className="space-y-3">
          {criteria.map((c, idx) => {
            const sourceConfig = SOURCE_CONFIG[c.source_type] || SOURCE_CONFIG.custom
            const regenerating = regeneratingId === c.id
            return (
              <Card key={c.id} className="bg-[hsl(0_0%_97%)] border shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xs text-muted-foreground font-mono mt-2.5 w-5 shrink-0 text-right">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0 space-y-3">
                      {/* バッジ行 */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] px-1.5 py-0 ${sourceConfig.className}`}
                        >
                          {sourceConfig.label}
                        </Badge>
                        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                          <Switch
                            checked={c.is_active}
                            onCheckedChange={(v) => updateCriterion(c.id, { is_active: v })}
                          />
                          {c.is_active ? '有効' : '無効'}
                        </label>
                      </div>

                      {/* 評価項目名 */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                          評価項目名
                        </label>
                        <input
                          type="text"
                          value={c.title}
                          onChange={(e) => updateCriterion(c.id, { title: e.target.value })}
                          placeholder="例: 挑戦"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>

                      {/* 説明 */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                          項目の説明（任意）
                        </label>
                        <AutoResizeTextarea
                          value={c.description ?? ''}
                          onChange={(e) =>
                            updateCriterion(c.id, { description: e.target.value })
                          }
                          placeholder="この評価項目が何を測るかの補足"
                          rows={1}
                        />
                      </div>

                      {/* 5段階の行動記述 */}
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground block">
                          5段階の行動記述（観察可能な行動で記述）
                        </label>
                        {LEVEL_META.map((lm) => {
                          const lv = c.levels.find((l) => l.level === lm.level)
                          return (
                            <div key={lm.level} className="flex items-start gap-2">
                              <span className="mt-2 w-9 shrink-0 text-xs font-bold text-foreground">
                                {lm.label}
                              </span>
                              <AutoResizeTextarea
                                value={lv?.description ?? ''}
                                onChange={(e) => updateLevel(c.id, lm.level, e.target.value)}
                                placeholder={lm.hint}
                                rows={1}
                              />
                            </div>
                          )
                        })}
                      </div>

                      {/* フッター: 重み + 再生成 */}
                      <div className="flex items-center gap-3 flex-wrap pt-1">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-muted-foreground">重み</label>
                          <input
                            type="number"
                            step="0.1"
                            min={0}
                            value={c.weight}
                            onChange={(e) =>
                              updateCriterion(c.id, { weight: Number(e.target.value) })
                            }
                            className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="ml-auto"
                          onClick={() => handleRegenerateOne(c.id)}
                          disabled={!!regeneratingId}
                        >
                          {regenerating ? (
                            <Loader2 size={14} className="animate-spin mr-1" />
                          ) : (
                            <RefreshCw size={14} className="mr-1" />
                          )}
                          この項目だけ再生成
                        </Button>
                      </div>
                    </div>

                    {/* 削除 */}
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeleteId(c.id)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* 保存 FAB */}
      <Fab>
        <FabButton
          onClick={handleSaveAll}
          disabled={saving}
          icon={saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        >
          {saving ? '保存中...' : '保存'}
        </FabButton>
      </Fab>

      {/* 上書き確認 */}
      <AlertDialog
        open={!!pendingGen}
        onOpenChange={(open) => {
          if (!open) setPendingGen(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>既存の5段階基準を上書きしますか？</AlertDialogTitle>
            <AlertDialogDescription>
              すでに記述がある項目の5段階基準が、AIの生成結果で置き換わります（保存するまで確定はされません）。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingGen) applyGenerated(pendingGen)
                setPendingGen(null)
              }}
            >
              上書きする
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 評価項目 削除確認 */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>この評価項目を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>この操作は取り消せません。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCriterion}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
