'use client'

// 市場調査（GT集計表）の取り込みダイアログ
// ============================================================
// 2ステップ。ファイルを選ぶと即プレビュー、内容を確認して取り込む。
// 「どの設問のどの値がどの指標か」はここでは決めない。取り込み後の
// マッピング画面で人が割り当てる。
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
import {
  Loader2,
  UploadCloud,
  FileSpreadsheet,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const ACCEPTED_EXT = /\.xlsx$/i

type BlockSummary = {
  blockKey: string
  questionCode: string
  questionText: string
  answerType: string
  answerTypeRaw: string
  blockBaseN: number | null
  columnCount: number
  cellCount: number
  isAttribute: boolean
  sourceRow: number
  warningCount: number
}

type Warning = {
  code: string
  severity: 'error' | 'warn'
  blockKey: string
  row: number | null
  detail: string
}

type Preview = {
  fileName: string
  sheetNames: string[]
  sheetName: string
  stats: {
    blockCount: number
    attributeBlockCount: number
    cellCount: number
    errorCount: number
    warnCount: number
  }
  blocks: BlockSummary[]
  warnings: Warning[]
}

/** ファイル名から調査名の初期値を作る */
function defaultTitleFromFileName(name: string): string {
  return name
    .replace(/\.xlsx$/i, '')
    .replace(/^\d+[_\-\s]*/, '') // 先頭の連番（02_ 等）を落とす
    .replace(/【?GT表】?/g, '')
    .replace(/\s*\(\d+\)\s*$/, '')
    .trim()
}

export function MarketSurveyImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [showAttributes, setShowAttributes] = useState(false)

  const [title, setTitle] = useState('')
  const [researchFirm, setResearchFirm] = useState('')
  const [fieldedFrom, setFieldedFrom] = useState('')
  const [fieldedTo, setFieldedTo] = useState('')
  const [sampleSize, setSampleSize] = useState('')

  const busy = parsing || importing

  const reset = () => {
    setFile(null)
    setPreview(null)
    setParsing(false)
    setImporting(false)
    setShowAttributes(false)
    setTitle('')
    setResearchFirm('')
    setFieldedFrom('')
    setFieldedTo('')
    setSampleSize('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleOpenChange = (v: boolean) => {
    if (importing) return // 取り込み中は閉じさせない
    if (!v) reset()
    onOpenChange(v)
  }

  const clearFile = () => {
    setFile(null)
    setPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ステップ1: ファイル選択 → プレビュー
  const loadPreview = async (target: File, sheet?: string) => {
    setParsing(true)
    try {
      const body = new FormData()
      body.append('file', target)
      body.append('mode', 'preview')
      if (sheet) body.append('sheet_name', sheet)

      const res = await fetch('/api/brand-score/market-surveys/import', {
        method: 'POST',
        body,
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'ファイルを解析できませんでした')
        clearFile()
        return
      }

      const p: Preview = data
      setPreview(p)
      if (!title) setTitle(defaultTitleFromFileName(target.name))
      // 全体Nが取れているブロックの最頻値をサンプル数の初期値にする
      const ns = p.blocks.map((b) => b.blockBaseN).filter((n): n is number => n !== null)
      if (ns.length > 0 && !sampleSize) {
        const counts = new Map<number, number>()
        for (const n of ns) counts.set(n, (counts.get(n) ?? 0) + 1)
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
        setSampleSize(String(top))
      }
    } catch {
      toast.error('ファイルの読み込みに失敗しました')
      clearFile()
    } finally {
      setParsing(false)
    }
  }

  const handleFiles = async (dropped: File[]) => {
    if (dropped.length === 0) return
    const target = dropped.find((f) => ACCEPTED_EXT.test(f.name))
    if (!target) {
      toast.error('.xlsx のみ取り込めます（調査会社のGT集計表）')
      return
    }
    if (dropped.length > 1) {
      toast.warning('1ファイルずつ取り込みます。最初の .xlsx を使います。')
    }
    setFile(target)
    setPreview(null)
    await loadPreview(target)
  }

  // シートを切り替えたら読み直す
  const handleSheetChange = async (sheet: string) => {
    if (!file) return
    setPreview(null)
    await loadPreview(file, sheet)
  }

  // ドラッグ＆ドロップ
  // 子要素をまたぐたびに dragleave が飛ぶため、カウンタで実際の離脱だけを拾う
  const dragDepth = useRef(0)
  const [dragActive, setDragActive] = useState(false)

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
  // dragover で preventDefault しないと drop が発火しない
  const handleDragOver = (e: React.DragEvent) => e.preventDefault()
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragDepth.current = 0
    setDragActive(false)
    if (busy) return
    handleFiles(Array.from(e.dataTransfer.files))
  }

  // ステップ2: 取り込み実行
  const handleImport = async () => {
    if (!file || !preview) return
    if (!title.trim()) {
      toast.error('調査名を入力してください')
      return
    }

    setImporting(true)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('mode', 'commit')
      body.append('sheet_name', preview.sheetName)
      body.append('title', title.trim())
      body.append('research_firm', researchFirm.trim())
      if (fieldedFrom) body.append('fielded_from', fieldedFrom)
      if (fieldedTo) body.append('fielded_to', fieldedTo)
      if (sampleSize) body.append('sample_size', sampleSize)

      const res = await fetch('/api/brand-score/market-surveys/import', {
        method: 'POST',
        body,
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || '取り込みに失敗しました')
        if (Array.isArray(data.details)) {
          for (const d of data.details.slice(0, 3)) toast.error(d)
        }
        return
      }

      toast.success(`取り込みました（設問${data.blockCount}件・集計値${data.cellCount}件）`)
      onOpenChange(false)
      reset()
      router.push(`/admin/brand-score/market-surveys/${data.surveyId}/mapping`)
    } catch {
      toast.error('取り込みに失敗しました')
    } finally {
      setImporting(false)
    }
  }

  const errorWarnings = preview?.warnings.filter((w) => w.severity === 'error') ?? []
  const visibleBlocks =
    preview?.blocks.filter((b) => showAttributes || !b.isAttribute) ?? []

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>市場調査を取り込む</DialogTitle>
          <DialogDescription>
            調査会社のGT集計表（Excel）を取り込みます。どの設問をどの指標に使うかは、
            取り込んだあとの画面で割り当てます。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* ドロップゾーン */}
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={cn(
              'rounded-lg border-2 border-dashed p-6 text-center transition-colors',
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
            <p className="mt-1 text-xs text-muted-foreground">.xlsx（GT集計表）</p>

            {/* 入力自体は隠すがフォーカス可能なまま残す（キーボード操作のため） */}
            <input
              id="market-import-file"
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={(e) => handleFiles(Array.from(e.target.files ?? []))}
              disabled={busy}
              className="sr-only"
            />
            <Label
              htmlFor="market-import-file"
              className={cn(
                'mt-3 inline-flex h-8 cursor-pointer items-center rounded-md border bg-background px-3 text-xs font-medium hover:bg-accent',
                busy && 'pointer-events-none'
              )}
            >
              ファイルを選択
            </Label>

            {file && (
              <p className="mt-3 flex min-w-0 items-center justify-center gap-2 text-xs text-muted-foreground">
                <FileSpreadsheet size={12} className="shrink-0" />
                <span className="min-w-0 truncate" title={file.name}>
                  {file.name}
                </span>
              </p>
            )}
          </div>

          {parsing && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" />
              解析中...
            </p>
          )}

          {preview && (
            <>
              {/* 解析サマリー */}
              <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <FileSpreadsheet size={16} />
                    解析結果
                  </p>
                  {preview.sheetNames.length > 1 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">シート</span>
                      <Select value={preview.sheetName} onValueChange={handleSheetChange}>
                        <SelectTrigger className="h-8 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {preview.sheetNames.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">設問数</p>
                    <p className="text-lg font-bold">{preview.stats.blockCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">集計値</p>
                    <p className="text-lg font-bold">{preview.stats.cellCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">うち属性設問</p>
                    <p className="text-lg font-bold">{preview.stats.attributeBlockCount}</p>
                  </div>
                </div>
              </div>

              {/* 読めなかった値がある場合は取り込ませない */}
              {errorWarnings.length > 0 && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-2">
                  <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                    <AlertTriangle size={16} />
                    読み取れない値が{errorWarnings.length}件あります
                  </p>
                  <ul className="space-y-1 text-xs text-destructive/90">
                    {errorWarnings.slice(0, 10).map((w, i) => (
                      <li key={i}>
                        {preview.sheetName} {w.row ?? '?'}行目 {w.blockKey}: {w.detail}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-destructive/80">
                    数字が黙って欠けるのを防ぐため、この状態では取り込めません。
                  </p>
                </div>
              )}

              {/* 調査の基本情報 */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="ms-title" className="text-xs">
                    調査名
                  </Label>
                  <Input
                    id="ms-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="眼科医に対する企業ブランド力調査 2025年"
                    className="mt-1 h-9"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="ms-firm" className="text-xs">
                      調査会社（任意）
                    </Label>
                    <Input
                      id="ms-firm"
                      value={researchFirm}
                      onChange={(e) => setResearchFirm(e.target.value)}
                      placeholder="電通マクロミルインサイト"
                      className="mt-1 h-9"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ms-n" className="text-xs">
                      サンプル数（任意）
                    </Label>
                    <Input
                      id="ms-n"
                      type="number"
                      min={1}
                      value={sampleSize}
                      onChange={(e) => setSampleSize(e.target.value)}
                      className="mt-1 h-9"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="ms-from" className="text-xs">
                      実施開始（任意）
                    </Label>
                    <Input
                      id="ms-from"
                      type="date"
                      value={fieldedFrom}
                      onChange={(e) => setFieldedFrom(e.target.value)}
                      className="mt-1 h-9"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ms-to" className="text-xs">
                      実施終了（任意）
                    </Label>
                    <Input
                      id="ms-to"
                      type="date"
                      value={fieldedTo}
                      onChange={(e) => setFieldedTo(e.target.value)}
                      className="mt-1 h-9"
                    />
                  </div>
                </div>
              </div>

              {/* 設問一覧 */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium">読み取った設問</p>
                  {preview.stats.attributeBlockCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAttributes((v) => !v)}
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      {showAttributes
                        ? '属性設問を隠す'
                        : `属性設問も表示（${preview.stats.attributeBlockCount}件）`}
                    </button>
                  )}
                </div>
                <div className="max-h-56 divide-y overflow-y-auto rounded-md border">
                  {visibleBlocks.map((b) => (
                    <div
                      key={b.blockKey}
                      className="flex min-w-0 items-center gap-2 px-3 py-2 text-xs"
                    >
                      <span className="w-16 shrink-0 font-mono text-[10px] text-muted-foreground">
                        {b.questionCode || b.blockKey}
                      </span>
                      <span className="min-w-0 flex-1 truncate" title={b.questionText}>
                        {b.questionText || '（設問文なし）'}
                      </span>
                      {b.isAttribute && (
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          属性
                        </span>
                      )}
                      <span className="w-20 shrink-0 text-right text-[10px] text-muted-foreground">
                        {b.blockBaseN !== null ? `n=${b.blockBaseN}・` : ''}
                        {b.cellCount}値
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            size="sm"
            onClick={handleImport}
            disabled={!preview || errorWarnings.length > 0 || busy}
          >
            {importing && <Loader2 size={14} className="animate-spin" />}
            取り込む
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
