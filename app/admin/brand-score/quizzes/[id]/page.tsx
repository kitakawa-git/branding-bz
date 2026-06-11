'use client'

// 理解度テスト 詳細＝設問エディタ（作成・AI生成・レビュー・配信）
// サーベイ詳細ページの構成・流儀をミラーしつつ、クイズの設問モデル
// （4択 / ◯×・正解・解説）に合わせて実装。
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  WandSparkles,
  Loader2,
  Plus,
  Trash2,
  Check,
  Pencil,
  Send,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { QuizTabs } from './QuizTabs'

type QuizOption = { id: string; text: string }

type Quiz = {
  id: string
  company_id: string
  title: string
  description: string | null
  status: string
  starts_at: string | null
  ends_at: string | null
  total_members: number | null
  pass_threshold: number
  randomize_questions: boolean
  created_at: string
  updated_at: string
}

type Question = {
  id: string
  quiz_id: string
  category: string
  question_text: string
  question_type: string
  options: QuizOption[]
  correct_option_id: string
  explanation: string | null
  source: string
  sort_order: number
  is_active: boolean
  reference_data: Record<string, unknown> | null
  created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: '下書き', className: 'bg-gray-100 text-gray-700' },
  active: { label: '実施中', className: 'bg-green-100 text-green-700' },
  closed: { label: '終了', className: 'bg-blue-100 text-ds-app-accent-hover' },
  archived: { label: 'アーカイブ', className: 'bg-gray-100 text-gray-500' },
}

const SOURCE_CONFIG: Record<string, { label: string; className: string }> = {
  template: { label: 'テンプレート', className: 'bg-gray-100 text-gray-600' },
  ai_generated: { label: 'AI生成', className: 'bg-purple-100 text-purple-700' },
  custom: { label: 'カスタム', className: 'bg-blue-100 text-ds-app-accent-hover' },
}

const CATEGORY_LABELS: Record<string, string> = {
  why: 'WHY（理念）',
  how: 'HOW（戦略・ルール）',
  what: 'WHAT（行動）',
}

const TYPE_LABELS: Record<string, string> = {
  single_choice: '4択',
  true_false: '◯×',
}

const SINGLE_IDS = ['a', 'b', 'c', 'd']
const TF_OPTIONS: QuizOption[] = [
  { id: 'true', text: '正しい' },
  { id: 'false', text: '誤り' },
]

// timestamptz <-> datetime-local 変換
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fromLocalInput(local: string): string | null {
  if (!local) return null
  return new Date(local).toISOString()
}
// 生成数の入力を 0〜20 にクランプ（サーバー側 normalizeCount と一致させ、
// 「合計N問」表示と実際の生成数が食い違わないようにする）
function clampCount(raw: string): number {
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(n, 20)
}

// ── 設問の追加・編集ダイアログ ──
type FormState = {
  category: string
  question_type: string
  question_text: string
  options: QuizOption[]
  correct_option_id: string
  explanation: string
}

function emptyForm(): FormState {
  return {
    category: 'why',
    question_type: 'single_choice',
    question_text: '',
    options: SINGLE_IDS.map((id) => ({ id, text: '' })),
    correct_option_id: 'a',
    explanation: '',
  }
}

function QuestionFormDialog({
  open,
  onOpenChange,
  quizId,
  editing,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  quizId: string
  editing: Question | null
  onSaved: () => void
}) {
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setForm({
        category: editing.category,
        question_type: editing.question_type,
        question_text: editing.question_text,
        options:
          editing.question_type === 'true_false'
            ? TF_OPTIONS
            : SINGLE_IDS.map(
                (id) => editing.options.find((o) => o.id === id) ?? { id, text: '' }
              ),
        correct_option_id: editing.correct_option_id,
        explanation: editing.explanation ?? '',
      })
    } else {
      setForm(emptyForm())
    }
  }, [open, editing])

  // タイプ変更で選択肢の形を切り替える
  const handleTypeChange = (type: string) => {
    if (type === 'true_false') {
      setForm((f) => ({
        ...f,
        question_type: type,
        options: TF_OPTIONS,
        correct_option_id: 'true',
      }))
    } else {
      setForm((f) => ({
        ...f,
        question_type: type,
        options: SINGLE_IDS.map((id) => ({ id, text: '' })),
        correct_option_id: 'a',
      }))
    }
  }

  const handleSave = async () => {
    if (!form.question_text.trim()) {
      toast.error('設問文を入力してください')
      return
    }
    if (form.question_type === 'single_choice' && form.options.some((o) => !o.text.trim())) {
      toast.error('すべての選択肢を入力してください')
      return
    }
    if (!form.options.some((o) => o.id === form.correct_option_id)) {
      toast.error('正解を選択してください')
      return
    }
    setSaving(true)
    try {
      const payload = {
        category: form.category,
        question_type: form.question_type,
        question_text: form.question_text.trim(),
        options: form.options.map((o) => ({ id: o.id, text: o.text.trim() })),
        correct_option_id: form.correct_option_id,
        explanation: form.explanation.trim() || null,
      }
      const url = editing
        ? `/api/brand-score/quizzes/${quizId}/questions/${editing.id}`
        : `/api/brand-score/quizzes/${quizId}/questions`
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      toast.success(editing ? '設問を更新しました' : '設問を追加しました')
      onOpenChange(false)
      onSaved()
    } catch (err) {
      console.error('[QuizEditor] 設問保存エラー:', err)
      toast.error(err instanceof Error ? err.message : '設問の保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? '設問を編集' : '設問を追加'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1.5 block">カテゴリ</label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="why">WHY（理念）</SelectItem>
                  <SelectItem value="how">HOW（戦略・ルール）</SelectItem>
                  <SelectItem value="what">WHAT（行動）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-1.5 block">形式</label>
              <Select value={form.question_type} onValueChange={handleTypeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_choice">4択</SelectItem>
                  <SelectItem value="true_false">◯×</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">設問文</label>
            <textarea
              value={form.question_text}
              onChange={(e) => setForm((f) => ({ ...f, question_text: e.target.value }))}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">
              選択肢（ラジオで正解を指定）
            </label>
            <div className="space-y-2">
              {form.options.map((o, i) => (
                <div key={o.id} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct"
                    checked={form.correct_option_id === o.id}
                    onChange={() => setForm((f) => ({ ...f, correct_option_id: o.id }))}
                    className="size-4 shrink-0"
                  />
                  {form.question_type === 'single_choice' ? (
                    <input
                      type="text"
                      value={o.text}
                      onChange={(e) =>
                        setForm((f) => {
                          const opts = [...f.options]
                          opts[i] = { ...opts[i], text: e.target.value }
                          return { ...f, options: opts }
                        })
                      }
                      placeholder={`選択肢 ${o.id.toUpperCase()}`}
                      className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  ) : (
                    <span className="flex-1 text-sm py-1.5">{o.text}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">解説（正解の根拠）</label>
            <textarea
              value={form.explanation}
              onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))}
              rows={2}
              placeholder="本人の結果画面で「正解＋理由」として表示されます"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin mr-1" /> : null}
            {editing ? '更新' : '追加'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function QuizDetailPage() {
  const params = useParams()
  const router = useRouter()
  const quizId = params.id as string

  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)

  // メタ編集フォーム
  const [meta, setMeta] = useState({
    title: '',
    description: '',
    pass_threshold: 80,
    randomize_questions: true,
    starts_at: '',
    ends_at: '',
  })
  const [savingMeta, setSavingMeta] = useState(false)

  // アクション状態
  const [generating, setGenerating] = useState(false)
  const [genOpen, setGenOpen] = useState(false)
  const [genCounts, setGenCounts] = useState({ why: 4, how: 4 })
  const [updatingStatus, setUpdatingStatus] = useState(false)

  // 設問ダイアログ
  const [formOpen, setFormOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!quizId) return
    try {
      const res = await fetch(`/api/brand-score/quizzes/${quizId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setQuiz(data.quiz)
      setQuestions(data.questions || [])
      setMeta({
        title: data.quiz.title ?? '',
        description: data.quiz.description ?? '',
        pass_threshold: data.quiz.pass_threshold ?? 80,
        randomize_questions: data.quiz.randomize_questions ?? true,
        starts_at: toLocalInput(data.quiz.starts_at),
        ends_at: toLocalInput(data.quiz.ends_at),
      })
    } catch (err) {
      console.error('[QuizEditor] データ取得エラー:', err)
      toast.error('テスト情報の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [quizId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const isDraft = quiz?.status === 'draft'
  const activeQuestions = useMemo(() => questions.filter((q) => q.is_active), [questions])

  // メタ保存（PATCH）
  const handleSaveMeta = async () => {
    if (savingMeta) return
    if (!meta.title.trim()) {
      toast.error('タイトルを入力してください')
      return
    }
    setSavingMeta(true)
    try {
      const res = await fetch(`/api/brand-score/quizzes/${quizId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: meta.title.trim(),
          description: meta.description.trim() || null,
          pass_threshold: meta.pass_threshold,
          randomize_questions: meta.randomize_questions,
          starts_at: fromLocalInput(meta.starts_at),
          ends_at: fromLocalInput(meta.ends_at),
        }),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      toast.success('保存しました')
      await fetchData()
    } catch (err) {
      console.error('[QuizEditor] メタ保存エラー:', err)
      toast.error(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSavingMeta(false)
    }
  }

  // AI設問生成（生成後も draft のまま＝自動公開しない）
  const handleGenerate = async () => {
    setGenerating(true)
    setGenOpen(false)
    try {
      const res = await fetch(`/api/brand-score/quizzes/${quizId}/generate-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counts: { why: genCounts.why, how: genCounts.how } }),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      const created = data.created?.length ?? 0
      const skipped = data.skipped?.length ?? 0
      toast.success(
        `AI設問を${created}問生成しました${skipped > 0 ? `（${skipped}件はデータ不足等でスキップ）` : ''}`
      )
      await fetchData()
    } catch (err) {
      console.error('[QuizEditor] AI生成エラー:', err)
      toast.error(err instanceof Error ? err.message : 'AI設問の生成に失敗しました')
    } finally {
      setGenerating(false)
    }
  }

  // ステータス変更
  const handleStatusChange = async (newStatus: string) => {
    setUpdatingStatus(true)
    try {
      const res = await fetch(`/api/brand-score/quizzes/${quizId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      if (newStatus === 'active') toast.success('テストを配信しました')
      else if (newStatus === 'closed') toast.success('テストを終了しました')
      else if (newStatus === 'archived') toast.success('アーカイブしました')
      await fetchData()
    } catch (err) {
      console.error('[QuizEditor] ステータス変更エラー:', err)
      toast.error(err instanceof Error ? err.message : 'ステータスの変更に失敗しました')
    } finally {
      setUpdatingStatus(false)
    }
  }

  // 設問削除
  const handleDeleteQuestion = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/brand-score/quizzes/${quizId}/questions/${deleteId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      setQuestions((prev) => prev.filter((q) => q.id !== deleteId))
      setDeleteId(null)
      toast.success('設問を削除しました')
    } catch (err) {
      console.error('[QuizEditor] 設問削除エラー:', err)
      toast.error(err instanceof Error ? err.message : '設問の削除に失敗しました')
    }
  }

  if (loading) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-32 w-full mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!quiz) return null

  const statusConfig = STATUS_CONFIG[quiz.status] || STATUS_CONFIG.draft

  return (
    <div>
      {/* ヘッダー: 戻る + タイトル + ステータス */}
      <div className="flex items-center gap-3 mb-2">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={() => router.push('/admin/brand-score/quizzes')}
        >
          <ArrowLeft size={18} />
        </Button>
        <h1 className="text-lg font-bold text-foreground flex-1 truncate">{quiz.title}</h1>
        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${statusConfig.className}`}>
          {statusConfig.label}
        </Badge>
      </div>

      <QuizTabs quizId={quizId} />

      {/* メタ編集カード */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-4">
        <CardContent className="p-5 space-y-4">
          {isDraft ? (
            <>
              <div>
                <label className="text-sm font-medium mb-1.5 block">タイトル</label>
                <input
                  type="text"
                  value={meta.title}
                  onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">説明（任意）</label>
                <textarea
                  value={meta.description}
                  onChange={(e) => setMeta((m) => ({ ...m, description: e.target.value }))}
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <div className="w-40">
                  <label className="text-sm font-medium mb-1.5 block">合格ライン(%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={meta.pass_threshold}
                    onChange={(e) =>
                      setMeta((m) => ({ ...m, pass_threshold: Number(e.target.value) }))
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm pb-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={meta.randomize_questions}
                    onChange={(e) =>
                      setMeta((m) => ({ ...m, randomize_questions: e.target.checked }))
                    }
                    className="size-4 rounded border-input"
                  />
                  出題順をランダム
                </label>
              </div>
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">配信開始（任意）</label>
                  <input
                    type="datetime-local"
                    value={meta.starts_at}
                    onChange={(e) => setMeta((m) => ({ ...m, starts_at: e.target.value }))}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">配信終了（任意）</label>
                  <input
                    type="datetime-local"
                    value={meta.ends_at}
                    onChange={(e) => setMeta((m) => ({ ...m, ends_at: e.target.value }))}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={handleSaveMeta} disabled={savingMeta}>
                  {savingMeta ? <Loader2 size={16} className="animate-spin mr-1" /> : null}
                  保存
                </Button>
              </div>
            </>
          ) : (
            // draft 以外は読み取り専用サマリ
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">合格ライン: </span>
                <span className="font-medium">{quiz.pass_threshold}%</span>
              </div>
              <div>
                <span className="text-muted-foreground">出題順: </span>
                <span className="font-medium">
                  {quiz.randomize_questions ? 'ランダム' : '固定'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">対象人数: </span>
                <span className="font-medium">{quiz.total_members ?? '—'}人</span>
              </div>
              {quiz.description && (
                <div className="w-full text-muted-foreground">{quiz.description}</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 設問アクションバー（draft時のみ編集系を出す） */}
      {isDraft && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Button onClick={() => setGenOpen(true)} disabled={generating}>
            {generating ? (
              <Loader2 size={16} className="animate-spin mr-1" />
            ) : (
              <WandSparkles size={16} className="mr-1" />
            )}
            AIで設問生成
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setEditingQuestion(null)
              setFormOpen(true)
            }}
          >
            <Plus size={16} className="mr-1" />
            設問を手動追加
          </Button>
        </div>
      )}

      {/* 配信前レビューの注意 */}
      {isDraft && activeQuestions.length > 0 && (
        <div className="flex items-start gap-2 mb-4 text-xs text-muted-foreground bg-muted/40 rounded-md p-3">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>
            生成・追加した設問は下書きのままです。内容を確認・編集してから「配信する」で公開してください（公開後は設問の編集・削除はできません）。
          </span>
        </div>
      )}

      {/* 設問リスト */}
      {questions.length === 0 ? (
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-10 text-center">
            <WandSparkles size={36} className="mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm mb-1">まだ設問がありません</p>
            <p className="text-muted-foreground/60 text-xs">
              「AIで設問生成」でブランドデータから自動作成、または手動で追加できます
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {questions.map((q, idx) => {
            const sourceConfig = SOURCE_CONFIG[q.source] || SOURCE_CONFIG.custom
            return (
              <Card key={q.id} className="bg-[hsl(0_0%_97%)] border shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xs text-muted-foreground font-mono mt-0.5 w-5 shrink-0 text-right">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      {/* バッジ行 */}
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-gray-100 text-gray-700">
                          {CATEGORY_LABELS[q.category] || q.category}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700">
                          {TYPE_LABELS[q.question_type] || q.question_type}
                        </Badge>
                        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${sourceConfig.className}`}>
                          {sourceConfig.label}
                        </Badge>
                      </div>
                      {/* 設問文 */}
                      <p className="text-sm text-foreground leading-relaxed mb-2">
                        {q.question_text}
                      </p>
                      {/* 選択肢（正解マーク） */}
                      <div className="space-y-1 mb-2">
                        {q.options.map((o) => {
                          const correct = o.id === q.correct_option_id
                          return (
                            <div
                              key={o.id}
                              className={`flex items-center gap-2 text-xs rounded px-2 py-1 ${
                                correct ? 'bg-green-50 text-green-700 font-medium' : 'text-muted-foreground'
                              }`}
                            >
                              {correct ? (
                                <Check size={13} className="shrink-0 text-green-600" />
                              ) : (
                                <span className="size-[13px] shrink-0" />
                              )}
                              <span className="uppercase font-mono text-[10px] w-3 shrink-0">{o.id}</span>
                              <span>{o.text}</span>
                            </div>
                          )
                        })}
                      </div>
                      {/* 解説 */}
                      {q.explanation && (
                        <p className="text-xs text-muted-foreground leading-relaxed bg-muted/40 rounded p-2">
                          解説: {q.explanation}
                        </p>
                      )}
                    </div>
                    {/* 操作（draft時のみ） */}
                    {isDraft && (
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8"
                          onClick={() => {
                            setEditingQuestion(q)
                            setFormOpen(true)
                          }}
                        >
                          <Pencil size={13} />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeleteId(q.id)}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ステータス操作（下部固定の操作カード） */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none mt-6">
        <CardContent className="p-5">
          {isDraft && (
            <div>
              {activeQuestions.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-amber-700">
                  <AlertCircle size={16} className="shrink-0" />
                  有効な設問が0件のため配信できません。設問を追加してください。
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <span className="text-sm text-muted-foreground">
                    設問 {activeQuestions.length}問。内容を確認したら配信してください。
                  </span>
                  <Button
                    onClick={() => handleStatusChange('active')}
                    disabled={updatingStatus}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {updatingStatus ? (
                      <Loader2 size={16} className="animate-spin mr-1" />
                    ) : (
                      <Send size={16} className="mr-1" />
                    )}
                    配信する
                  </Button>
                </div>
              )}
            </div>
          )}
          {quiz.status === 'active' && (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <span className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle2 size={16} className="shrink-0" />
                配信中です。集計は「結果」、受験状況は「受験状況」タブで確認できます。
              </span>
              <Button variant="outline" onClick={() => handleStatusChange('closed')} disabled={updatingStatus}>
                テストを終了
              </Button>
            </div>
          )}
          {quiz.status === 'closed' && (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <span className="text-sm text-muted-foreground">終了済みのテストです。</span>
              <Button variant="outline" onClick={() => handleStatusChange('archived')} disabled={updatingStatus}>
                アーカイブ
              </Button>
            </div>
          )}
          {quiz.status === 'archived' && (
            <span className="text-sm text-muted-foreground">アーカイブ済みのテストです。</span>
          )}
        </CardContent>
      </Card>

      {/* AI生成: 件数指定ダイアログ */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>AIで設問生成</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-1">
            ブランドデータ（理念・戦略・用語・カラー等）を正解の根拠に、WHY / HOW の設問を生成します。WHAT（行動）は知識テストに不向きなため生成しません。
          </p>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium flex-1">WHY（理念）</label>
              <input
                type="number"
                min={0}
                max={20}
                value={genCounts.why}
                onChange={(e) => setGenCounts((c) => ({ ...c, why: clampCount(e.target.value) }))}
                className="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="text-sm text-muted-foreground shrink-0 w-5">問</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium flex-1">HOW（戦略・ルール）</label>
              <input
                type="number"
                min={0}
                max={20}
                value={genCounts.how}
                onChange={(e) => setGenCounts((c) => ({ ...c, how: clampCount(e.target.value) }))}
                className="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="text-sm text-muted-foreground shrink-0 w-5">問</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            合計 {(genCounts.why || 0) + (genCounts.how || 0)} 問を生成します（各カテゴリ最大20問。ブランドデータが不足する分は生成されません）
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleGenerate}>生成する</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 設問追加・編集ダイアログ */}
      <QuestionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        quizId={quizId}
        editing={editingQuestion}
        onSaved={fetchData}
      />

      {/* 設問削除確認 */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>この設問を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>この操作は取り消せません。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteQuestion}
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
