'use client'

// Googleフォーム回答（Excel/CSV）取り込みダイアログ
// ============================================================
// 2ステップ構成。
//   1. ファイル選択 → 即 mode=preview を叩いて解析結果を取得
//   2. プレビュー確認 + 設定入力 → mode=commit でサーベイを作成
//
// 複数ファイルを選ぶと1つのサーベイにまとまる。職種別にフォームを分けた
// 場合（例: 営業向け／本社向け）、ファイルごとに部署ラベルを変えることで
// 部署別スコアで比較できる。Googleフォームには部署・役職の列が無いため、
// ラベルはここで人が付ける。
// ============================================================
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Upload, AlertTriangle, FileSpreadsheet, UploadCloud } from 'lucide-react'
import { cn } from '@/lib/utils'

type Category = 'why' | 'how' | 'what'

type FileSummary = {
  fileName: string
  questionCount: number
  respondentCount: number
  blankCells: number
  unmappedLabels: string[]
}

type MergedQuestion = {
  sortOrder: number
  category: Category
  questionText: string
  fileIndexes: number[]
}

type Preview = {
  files: FileSummary[]
  merged: MergedQuestion[]
  stats: {
    fileCount: number
    questionCount: number
    respondentCount: number
    sharedQuestionCount: number
  }
}

const ROLE_OPTIONS = [
  { value: 'staff', label: '従業員' },
  { value: 'manager', label: '管理職' },
  { value: 'executive', label: '経営層' },
] as const

const CATEGORY_OPTIONS = [
  { value: 'why', label: 'WHY（理念浸透）' },
  { value: 'how', label: 'HOW（方針共感）' },
  { value: 'what', label: 'WHAT（行動体現）' },
] as const

const CATEGORY_LABEL: Record<Category, string> = {
  why: 'WHY',
  how: 'HOW',
  what: 'WHAT',
}

/** 取り込める拡張子（ドロップは accept 属性が効かないのでコード側で弾く） */
const ACCEPTED_EXT = /\.(xlsx|csv)$/i

/** ファイル名から拡張子と連番を落として初期タイトルにする */
function defaultTitleFromFileName(name: string): string {
  return name
    .replace(/\.(xlsx|csv)$/i, '')
    .replace(/\s*\(\d+\)\s*$/, '')
    .trim()
}

/** ファイル名から部署ラベルを推測する（例: 「〜（SP向け）〜」→ SP） */
function guessDepartment(name: string): string {
  const m = name.match(/[（(]([^（()）]{1,12}?)(?:向け|用)[^（()）]*[）)]/)
  return m ? m[1].replace(/[・･]/g, '').trim() : ''
}

export function SurveyImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [files, setFiles] = useState<File[]>([])
  const [preview, setPreview] = useState<Preview | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)

  const [title, setTitle] = useState('')
  const [departments, setDepartments] = useState<string[]>([])
  const [roleCategories, setRoleCategories] = useState<string[]>([])
  const [totalMembers, setTotalMembers] = useState('')

  const reset = () => {
    setFiles([])
    setPreview(null)
    setCategories([])
    setParsing(false)
    setImporting(false)
    setTitle('')
    setDepartments([])
    setRoleCategories([])
    setTotalMembers('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleOpenChange = (v: boolean) => {
    if (importing) return // 取り込み中は閉じさせない
    if (!v) reset()
    onOpenChange(v)
  }

  const clearFiles = () => {
    setFiles([])
    setPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ステップ1: ファイル選択 → プレビュー取得
  // ファイル入力とドラッグ＆ドロップの共通処理
  const handleFiles = async (dropped: File[]) => {
    if (dropped.length === 0) return

    const selected = dropped.filter(f => ACCEPTED_EXT.test(f.name))
    const rejected = dropped.filter(f => !ACCEPTED_EXT.test(f.name))

    if (rejected.length > 0) {
      toast.error(`.xlsx / .csv のみ取り込めます：${rejected.map(f => f.name).join('、')}`)
    }
    if (selected.length === 0) {
      clearFiles()
      return
    }

    setFiles(selected)
    setPreview(null)
    setParsing(true)

    try {
      const body = new FormData()
      for (const f of selected) body.append('files', f)
      body.append('mode', 'preview')

      const res = await fetch('/api/brand-score/surveys/import', { method: 'POST', body })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'ファイルを解析できませんでした')
        clearFiles()
        return
      }

      const p: Preview = data
      setPreview(p)
      setCategories(p.merged.map(q => q.category))
      setTitle(defaultTitleFromFileName(selected[0].name))
      setDepartments(selected.map(f => guessDepartment(f.name)))
      setRoleCategories(selected.map(() => 'staff'))
      setTotalMembers(String(p.stats.respondentCount))
    } catch {
      toast.error('ファイルの読み込みに失敗しました')
      clearFiles()
    } finally {
      setParsing(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(Array.from(e.target.files ?? []))
  }

  // ドラッグ＆ドロップ
  // 子要素をまたぐたびに dragleave が飛ぶため、カウンタで実際の離脱だけを拾う
  const dragDepth = useRef(0)
  const [dragActive, setDragActive] = useState(false)
  const busy = parsing || importing

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    if (busy) return
    dragDepth.current += 1
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    dragDepth.current -= 1
    if (dragDepth.current <= 0) {
      dragDepth.current = 0
      setDragActive(false)
    }
  }

  // dragover で preventDefault しないとブラウザがファイルを開いてしまい drop が発火しない
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragDepth.current = 0
    setDragActive(false)
    if (busy) return
    handleFiles(Array.from(e.dataTransfer.files))
  }

  // ステップ2: 取り込み実行
  const handleImport = async () => {
    if (files.length === 0 || !preview) return

    if (!title.trim()) {
      toast.error('サーベイ名を入力してください')
      return
    }
    const members = Number(totalMembers)
    if (!Number.isInteger(members) || members < preview.stats.respondentCount) {
      toast.error(`配布対象者数は回答者数の合計（${preview.stats.respondentCount}名）以上で入力してください`)
      return
    }
    // 複数ファイルなら部署ラベルで区別できないと分析にならない
    if (files.length > 1) {
      const filled = departments.map(d => d.trim())
      if (filled.some(d => !d)) {
        toast.error('複数ファイルを取り込むときは、各ファイルに部署を入力してください')
        return
      }
      if (new Set(filled).size !== filled.length) {
        toast.error('部署が重複しています。ファイルごとに違う名前を付けてください')
        return
      }
    }

    setImporting(true)
    try {
      const body = new FormData()
      for (const f of files) body.append('files', f)
      body.append('mode', 'commit')
      body.append('title', title.trim())
      for (const d of departments) body.append('departments', d.trim())
      for (const r of roleCategories) body.append('roleCategories', r)
      body.append('totalMembers', String(members))
      body.append('categories', JSON.stringify(categories))

      const res = await fetch('/api/brand-score/surveys/import', { method: 'POST', body })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || '取り込みに失敗しました')
        return
      }

      toast.success(`${data.respondentCount}名分の回答を取り込みました`)
      handleOpenChange(false)
      router.push(`/admin/brand-score/surveys/${data.surveyId}`)
    } catch {
      toast.error('取り込みに失敗しました')
    } finally {
      setImporting(false)
    }
  }

  const hasUnmapped = preview?.files.some(f => f.unmappedLabels.length > 0) ?? false
  const unmappedAll = preview?.files.flatMap(f => f.unmappedLabels) ?? []
  const categoryCounts = (['why', 'how', 'what'] as const).map(c => ({
    category: c,
    count: categories.filter(x => x === c).length,
  }))
  const multi = (preview?.files.length ?? 0) > 1

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Googleフォームの回答を取り込む</DialogTitle>
          <DialogDescription>
            Googleフォームの回答をダウンロードした Excel（.xlsx）または CSV を選択してください。
            職種別にフォームを分けた場合は、複数ファイルをまとめて選ぶと1つのサーベイになります。
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-5">
          {/* ファイル選択（クリック / ドラッグ＆ドロップ） */}
          <div className="space-y-2">
            <Label htmlFor="import-file">回答ファイル</Label>
            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={cn(
                'rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors',
                dragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 bg-muted/20',
                busy && 'opacity-60'
              )}
            >
              <UploadCloud
                size={24}
                className={cn(
                  'mx-auto mb-2',
                  dragActive ? 'text-primary' : 'text-muted-foreground'
                )}
              />
              <p className="text-sm">
                {dragActive ? 'ここにドロップ' : 'ファイルをドラッグ＆ドロップ'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                .xlsx / .csv・複数まとめて可
              </p>

              {/* 入力自体は隠すがフォーカス可能なまま残す（キーボード操作のため） */}
              <input
                id="import-file"
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv"
                multiple
                onChange={handleFileChange}
                disabled={busy}
                className="sr-only"
              />
              <Label
                htmlFor="import-file"
                className={cn(
                  'mt-3 inline-flex h-8 cursor-pointer items-center rounded-md border bg-background px-3 text-xs font-medium hover:bg-accent',
                  busy && 'pointer-events-none'
                )}
              >
                ファイルを選択
              </Label>

              {files.length > 0 && (
                <ul className="mt-3 space-y-1 text-left">
                  {files.map(f => (
                    <li
                      key={f.name}
                      className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground"
                    >
                      <FileSpreadsheet size={12} className="shrink-0" />
                      <span className="min-w-0 truncate" title={f.name}>
                        {f.name}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {parsing && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={14} className="animate-spin" />
                解析中...
              </p>
            )}
          </div>

          {preview && (
            <>
              {/* 解析サマリー */}
              <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <FileSpreadsheet size={16} />
                  解析結果
                </p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">設問数</p>
                    <p className="font-bold text-lg">{preview.stats.questionCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">回答者数（合計）</p>
                    <p className="font-bold text-lg">{preview.stats.respondentCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">ファイル数</p>
                    <p className="font-bold text-lg">{preview.stats.fileCount}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  カテゴリ内訳：
                  {categoryCounts.map(c => `${CATEGORY_LABEL[c.category]} ${c.count}問`).join(' / ')}
                </p>
                {multi && (
                  <p className="text-sm text-muted-foreground">
                    共通設問 {preview.stats.sharedQuestionCount}問 ／
                    片方のみ {preview.stats.questionCount - preview.stats.sharedQuestionCount}問
                    （文言が違う設問は別の設問として登録されます）
                  </p>
                )}
              </div>

              {/* 未変換ラベルの警告 */}
              {hasUnmapped && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-2">
                  <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                    <AlertTriangle size={16} />
                    1〜5に変換できない回答があります
                  </p>
                  <p className="text-sm text-destructive/90">
                    以下の選択肢が5段階評価として解釈できませんでした。取り込むと回答が欠落するため、
                    フォームの選択肢を確認してください。
                  </p>
                  <ul className="text-sm list-disc list-inside text-destructive/90">
                    {[...new Set(unmappedAll)].slice(0, 10).map(l => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 設定入力 */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="import-title">サーベイ名</Label>
                  <Input
                    id="import-title"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="第1回 ブランド浸透度調査"
                    disabled={importing}
                  />
                </div>

                {/* ファイルごとの部署・役職 */}
                <div className="space-y-2">
                  <Label>ファイルごとの部署・役職</Label>
                  <p className="text-xs text-muted-foreground">
                    {multi
                      ? 'ここで付けた部署名が、部署別スコアの比較軸になります。'
                      : 'このファイルの全回答に付与されます。部署は空欄可。'}
                  </p>
                  <div className="space-y-2 rounded-lg border p-3">
                    {preview.files.map((f, i) => (
                      <div key={f.fileName} className="min-w-0 space-y-2">
                        {multi && (
                          <p className="min-w-0 truncate text-xs text-muted-foreground" title={f.fileName}>
                            {f.fileName}（{f.respondentCount}名 / {f.questionCount}問）
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            value={departments[i] ?? ''}
                            onChange={e =>
                              setDepartments(prev => prev.map((d, j) => (j === i ? e.target.value : d)))
                            }
                            placeholder="例: 営業部"
                            aria-label={`${f.fileName} の部署`}
                            disabled={importing}
                          />
                          <Select
                            value={roleCategories[i] ?? 'staff'}
                            onValueChange={v =>
                              setRoleCategories(prev => prev.map((r, j) => (j === i ? v : r)))
                            }
                            disabled={importing}
                          >
                            <SelectTrigger className="h-9" aria-label={`${f.fileName} の役職区分`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLE_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="import-total">配布対象者数</Label>
                  <Input
                    id="import-total"
                    type="number"
                    min={preview.stats.respondentCount}
                    value={totalMembers}
                    onChange={e => setTotalMembers(e.target.value)}
                    disabled={importing}
                  />
                  <p className="text-xs text-muted-foreground">
                    回答率の分母になります（回答者 {preview.stats.respondentCount}名 ÷ 配布対象者数）。
                  </p>
                </div>
              </div>

              {/* 設問とカテゴリ */}
              <div className="space-y-2">
                <Label>設問とカテゴリ</Label>
                <p className="text-xs text-muted-foreground">
                  設問番号から自動判定しています。必要なら変更してください。
                </p>
                <div className="max-h-64 overflow-y-auto rounded-lg border divide-y">
                  {preview.merged.map((q, i) => (
                    <div key={q.sortOrder} className="flex items-center gap-3 p-2">
                      <span className="w-7 shrink-0 text-xs text-muted-foreground text-right">
                        {q.sortOrder}
                      </span>
                      {/* min-w-0 がないと truncate（whitespace-nowrap）で行が縮まず、
                          ダイアログ幅を押し広げて右端がクリップされる */}
                      <span className="min-w-0 flex-1 text-sm truncate" title={q.questionText}>
                        {q.questionText}
                      </span>
                      {/* 一部のファイルにしかない設問はその旨を出す（母数が他より少なくなるため） */}
                      {multi && q.fileIndexes.length < preview.files.length && (
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {q.fileIndexes.map(fi => departments[fi] || `ファイル${fi + 1}`).join('・')}のみ
                        </span>
                      )}
                      <Select
                        value={categories[i]}
                        onValueChange={v =>
                          setCategories(prev => prev.map((c, j) => (j === i ? (v as Category) : c)))
                        }
                        disabled={importing}
                      >
                        <SelectTrigger className="h-8 w-40 shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORY_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={importing}
          >
            キャンセル
          </Button>
          <Button onClick={handleImport} disabled={!preview || hasUnmapped || parsing || importing}>
            {importing ? (
              <Loader2 size={16} className="animate-spin mr-1" />
            ) : (
              <Upload size={16} className="mr-1" />
            )}
            {importing ? '取り込み中...' : '取り込む'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
