'use client'

// アカウントの一括登録（CSV / Excel）
// 読み込み → 行ごとの確認 → 実行 の3段階。
// 確認を挟むのは、1行のtypoで数十件のアカウントが中途半端に作られるのを防ぐため。
import { useCallback, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Upload, AlertTriangle, Check, Loader2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fileToRows } from '@/lib/brand-score/excel-rows'
import {
  parseMemberRows,
  type MemberCsvRow,
} from '@/lib/members/parse-member-csv'
import { MEMBER_ROLE_LABELS } from '@/lib/constants/member-roles'

type Result = { email: string; ok: boolean; error?: string }

export function MemberCsvImportDialog({
  open,
  onOpenChange,
  onCompleted,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** 登録が1件でも成功したら一覧を取り直してもらう */
  onCompleted: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<MemberCsvRow[]>([])
  const [fatal, setFatal] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<Result[] | null>(null)

  const reset = () => {
    setFileName(null)
    setRows([])
    setFatal(null)
    setResults(null)
  }

  const handleFile = useCallback(async (file: File) => {
    setParsing(true)
    reset()
    setFileName(file.name)
    try {
      const table = await fileToRows(file)
      const parsed = parseMemberRows(table)
      setRows(parsed.rows)
      setFatal(parsed.fatal)
    } catch (err) {
      console.error('[MemberCsvImport] 解析エラー:', err)
      setFatal('ファイルを読み込めませんでした')
    } finally {
      setParsing(false)
    }
  }, [])

  const okRows = rows.filter(r => r.error === null)
  const ngRows = rows.filter(r => r.error !== null)

  const handleSubmit = async () => {
    if (okRows.length === 0 || submitting) return
    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/members/bulk-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          rows: okRows.map(r => ({
            display_name: r.displayName,
            email: r.email,
            password: r.password,
            role_category: r.roleCategory ?? '',
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)

      setResults(data.results ?? [])
      if (data.created > 0) {
        toast.success(`${data.created}件のアカウントを作成しました`)
        onCompleted()
      }
      if (data.failed > 0) {
        toast.error(`${data.failed}件は作成できませんでした`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '登録に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={v => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>CSVで一括登録</DialogTitle>
          <DialogDescription>
            1行目に「氏名」「メールアドレス」「パスワード」「区分」の見出しを入れてください。
            区分は経営層／管理職／従業員のいずれかで、空欄なら未設定になります。
          </DialogDescription>
        </DialogHeader>

        {/* ⚠ パスワードを平文で書いたファイルを扱う。置き場所の注意を出す */}
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
          <p className="m-0 text-[11px] leading-relaxed text-amber-800">
            ファイルにはパスワードがそのまま書かれています。登録が終わったら共有フォルダに
            残さず削除し、各自にパスワードの変更を促してください。
          </p>
        </div>

        {results === null ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.tsv,text/csv"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
                e.target.value = ''
              }}
            />

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center transition-colors hover:bg-muted/40"
            >
              {parsing ? (
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
              ) : (
                <Upload size={20} className="text-muted-foreground" />
              )}
              <span className="text-sm text-foreground">
                {fileName ?? 'CSV / Excel ファイルを選ぶ'}
              </span>
              <span className="text-[11px] text-muted-foreground">
                .csv / .xlsx に対応
              </span>
            </button>

            {fatal && (
              <p className="m-0 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                {fatal}
              </p>
            )}

            {rows.length > 0 && (
              <>
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-bold text-foreground">
                    登録できる {okRows.length}件
                  </span>
                  {ngRows.length > 0 && (
                    <span className="text-destructive">
                      見送り {ngRows.length}件
                    </span>
                  )}
                </div>

                <div className="max-h-64 overflow-y-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/60">
                      <tr className="text-[10px] text-muted-foreground">
                        <th className="px-2 py-1.5 text-left font-normal">行</th>
                        <th className="px-2 py-1.5 text-left font-normal">氏名</th>
                        <th className="px-2 py-1.5 text-left font-normal">メール</th>
                        <th className="px-2 py-1.5 text-left font-normal">区分</th>
                        <th className="px-2 py-1.5 text-left font-normal">状態</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r => (
                        <tr key={r.lineNumber} className="border-t">
                          <td className="px-2 py-1.5 tabular-nums text-muted-foreground">
                            {r.lineNumber}
                          </td>
                          <td className="px-2 py-1.5">{r.displayName || '—'}</td>
                          <td className="px-2 py-1.5 break-all">{r.email || '—'}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">
                            {r.roleCategory ? MEMBER_ROLE_LABELS[r.roleCategory] : '未設定'}
                          </td>
                          <td className="px-2 py-1.5">
                            {r.error ? (
                              <span className="text-destructive">{r.error}</span>
                            ) : (
                              <span className="text-green-600">登録できます</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                    キャンセル
                  </Button>
                  <Button onClick={handleSubmit} disabled={okRows.length === 0 || submitting}>
                    {submitting && <Loader2 size={14} className="animate-spin" />}
                    {okRows.length}件を登録
                  </Button>
                </div>
              </>
            )}
          </>
        ) : (
          /* 実行結果。失敗した行だけ理由を出す */
          <>
            <div className="max-h-72 overflow-y-auto rounded-md border">
              <table className="w-full text-xs">
                <tbody>
                  {results.map((r, i) => (
                    <tr key={`${r.email}-${i}`} className="border-t">
                      <td className="px-2 py-1.5 w-6">
                        {r.ok ? (
                          <Check size={13} className="text-green-600" />
                        ) : (
                          <X size={13} className="text-destructive" />
                        )}
                      </td>
                      <td className="px-2 py-1.5 break-all">{r.email}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {r.ok ? '作成しました' : r.error}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)}>閉じる</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
