'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { History, RotateCcw, Save, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  canUseColorPicker,
  toPreviewColor,
  toPickerHex,
  fromPicker,
  detectFormat,
} from './hsl-color'

type DesignToken = {
  id: string
  category: string
  token_name: string
  value: string
  default_value: string
  label: string | null
  description: string | null
  sort_order: number
}

type HistoryEntry = {
  id: string
  token_id: string
  token_name: string
  old_value: string
  new_value: string
  changed_at: string
}

const CATEGORY_LABELS: Record<string, string> = {
  // ウェブサイト(LP)用 --ds-*（hex/rgba）
  text: 'テキスト',
  bg: '背景',
  border: 'ボーダー・罫線',
  accent: 'アクセント',
  shadow: '影',
  // サービス画面(アプリ)用
  app: 'アプリ青アクセント',
  base: '基盤色（UI全体）',
  sidebar: 'サイドバー',
  chart: 'グラフ',
  radius: '角丸',
}

// カラーパレットを「ウェブサイト(LP)」「サービス画面(アプリ)」の2スコープに分けて表示。
// website = LP独自の --ds-*（公開サイト）／ service = shadcn基盤＋アプリ青（ログイン後のUI）
const SCOPE_DEFS = [
  {
    key: 'website' as const,
    label: 'ウェブサイト',
    sublabel: '公開サイト（LP）',
    desc: 'トップ・料金・FAQ など、ログイン前に表示される公開ページの色。',
    categories: ['text', 'bg', 'border', 'accent', 'shadow'],
  },
  {
    key: 'service' as const,
    label: 'サービス画面',
    sublabel: 'ログイン後のアプリ',
    desc: '管理画面・ポータル・ツールの色。「基盤色」を変えると文字・ボタン・罫線などが全画面で一括変更されます。',
    categories: ['app', 'base', 'sidebar', 'chart', 'radius'],
  },
]
type ScopeKey = (typeof SCOPE_DEFS)[number]['key']

export default function DesignTokenEditor() {
  const [tokens, setTokens] = useState<DesignToken[]>([])
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyLimit, setHistoryLimit] = useState(20)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [scope, setScope] = useState<ScopeKey>('website')

  const loadAll = useCallback(async () => {
    const [tokensRes, historyRes] = await Promise.all([
      supabase
        .from('design_tokens')
        .select('*')
        .order('category')
        .order('sort_order'),
      supabase
        .from('design_token_history')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(historyLimit),
    ])
    if (tokensRes.error) {
      setErrorMsg('読み込み失敗: ' + tokensRes.error.message)
    } else if (tokensRes.data) {
      setTokens(tokensRes.data as DesignToken[])
      setDraft((prev) => {
        const next: Record<string, string> = { ...prev }
        for (const t of tokensRes.data as DesignToken[]) {
          // 編集中でない（= 既存と同じ）か未設定なら上書き
          if (next[t.id] === undefined || next[t.id] === t.value) {
            next[t.id] = t.value
          }
        }
        return next
      })
    }
    if (historyRes.data) setHistory(historyRes.data as HistoryEntry[])
    setLoading(false)
  }, [historyLimit])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const updateValue = async (
    tokenId: string,
    newValue: string,
    label: string
  ) => {
    setSavingIds((prev) => new Set(prev).add(tokenId))
    setErrorMsg(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('design_tokens')
        .update({
          value: newValue,
          updated_at: new Date().toISOString(),
          updated_by: user?.id ?? null,
        })
        .eq('id', tokenId)
      if (error) {
        setErrorMsg(`${label}失敗: ${error.message}`)
        return false
      }
      // キャッシュ無効化（design-tokens タグを invalidate → 公開LPに反映）
      await fetch('/api/revalidate', { method: 'POST' })
      await loadAll()
      return true
    } finally {
      setSavingIds((prev) => {
        const s = new Set(prev)
        s.delete(tokenId)
        return s
      })
    }
  }

  const saveOne = async (token: DesignToken) => {
    const newValue = draft[token.id]?.trim() ?? token.value
    if (!newValue || newValue === token.value) return
    await updateValue(token.id, newValue, '保存')
  }

  const resetOne = async (token: DesignToken) => {
    if (token.value === token.default_value) return
    setDraft((prev) => ({ ...prev, [token.id]: token.default_value }))
    await updateValue(token.id, token.default_value, 'リセット')
  }

  const rollback = async (entry: HistoryEntry) => {
    await updateValue(entry.token_id, entry.old_value, 'ロールバック')
  }

  const resetAll = async () => {
    setErrorMsg(null)
    const dirty = tokens.filter((t) => t.value !== t.default_value)
    if (dirty.length === 0) return
    const {
      data: { user },
    } = await supabase.auth.getUser()
    // 1件ずつ UPDATE → トリガーで履歴記録
    const results = await Promise.all(
      dirty.map((t) =>
        supabase
          .from('design_tokens')
          .update({
            value: t.default_value,
            updated_at: new Date().toISOString(),
            updated_by: user?.id ?? null,
          })
          .eq('id', t.id)
      )
    )
    const firstErr = results.find((r) => r.error)?.error
    if (firstErr) {
      setErrorMsg('一括リセット失敗: ' + firstErr.message)
      return
    }
    await fetch('/api/revalidate', { method: 'POST' })
    await loadAll()
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        読み込み中...
      </div>
    )
  }

  const activeScope = SCOPE_DEFS.find((s) => s.key === scope)!
  // 各スコープの編集中（dirty）件数バッジ用
  const dirtyCountByScope = (categories: readonly string[]) =>
    tokens.filter((t) => categories.includes(t.category) && (draft[t.id] ?? t.value) !== t.value).length

  const groups = activeScope.categories
    .map((cat) => ({
      category: cat,
      items: tokens.filter((t) => t.category === cat),
    }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="space-y-6 pt-6">
      {errorMsg && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      {/* スコープ切替: ウェブサイト(LP) / サービス画面(アプリ) */}
      <div className="space-y-2">
        <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
          {SCOPE_DEFS.map((s) => {
            const isActive = s.key === scope
            const dirty = dirtyCountByScope(s.categories)
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setScope(s.key)}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className="flex flex-col items-start leading-tight">
                  <span>{s.label}</span>
                  <span className="text-[10px] font-normal text-muted-foreground">{s.sublabel}</span>
                </span>
                {dirty > 0 && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                    未保存{dirty}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">{activeScope.desc}</p>
      </div>

      {groups.map((group) => (
        <section key={group.category}>
          <h2 className="mb-3 text-base font-bold">
            {CATEGORY_LABELS[group.category] ?? group.category}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {group.items.map((token) => {
              const draftValue = draft[token.id] ?? token.value
              const isDirty = draftValue !== token.value
              const isSaving = savingIds.has(token.id)
              const isDefault = token.value === token.default_value
              const canPick = canUseColorPicker(draftValue)
              const draftFormat = detectFormat(draftValue)
              const previewValue = toPreviewColor(draftValue)
              return (
                <Card key={token.id} className="overflow-hidden p-0 gap-0 h-full">
                  <CardContent className="p-0 flex h-full flex-col">
                    <div
                      className="h-16 w-full shrink-0"
                      style={{
                        backgroundColor: previewValue,
                        borderBottom: '1px solid #e5e5e5',
                      }}
                    />
                    {/* flex-col + flex-1 でカード下端まで伸ばし、保存ボタン行に mt-auto
                        を当てて全カードでボタン位置を揃える (説明行数の違いを吸収) */}
                    <div className="p-3 flex flex-1 flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          value={draftValue}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              [token.id]: e.target.value,
                            }))
                          }
                          className="h-7 text-xs font-mono px-2"
                        />
                        {canPick && (
                          <input
                            type="color"
                            value={toPickerHex(draftValue)}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                // HSL成分トークンはピッカーの hex を "H S% L%" に戻す
                                [token.id]: fromPicker(e.target.value, draftFormat),
                              }))
                            }
                            className="h-7 w-8 shrink-0 cursor-pointer rounded border border-border bg-background p-0.5"
                            title="カラーピッカー"
                          />
                        )}
                      </div>
                      <div>
                        <code className="text-[10px] font-mono text-muted-foreground">
                          {token.token_name}
                        </code>
                        {token.label && (
                          <p className="text-[11px] font-medium text-foreground">
                            {token.label}
                          </p>
                        )}
                        {token.description && (
                          <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">
                            {token.description}
                          </p>
                        )}
                      </div>
                      <div className="mt-auto flex gap-1.5">
                        <Button
                          size="sm"
                          disabled={!isDirty || isSaving}
                          onClick={() => saveOne(token)}
                          className="h-7 flex-1 text-[11px]"
                        >
                          <Save size={10} className="mr-1" />
                          保存
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isDefault || isSaving}
                          onClick={() => resetOne(token)}
                          className="h-7 text-[11px]"
                          title={`デフォルト: ${token.default_value}`}
                        >
                          <RotateCcw size={10} />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      ))}

      {/* 履歴 + 一括リセット */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <History size={14} />
            変更履歴
          </h2>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-[11px]">
                <AlertTriangle size={10} className="mr-1" />
                全て初期値に戻す
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  全トークンを初期値に戻しますか？
                </AlertDialogTitle>
                <AlertDialogDescription>
                  すべての design_tokens を default_value に書き戻します。各変更は履歴に記録されるため、後から個別にロールバック可能です。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction onClick={resetAll}>実行</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <Card className="py-0">
          <CardContent className="p-0">
            {history.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                変更履歴はまだありません
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left font-medium text-muted-foreground px-3 py-2 border-b border-border">
                      日時
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-3 py-2 border-b border-border">
                      トークン
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-3 py-2 border-b border-border">
                      変更
                    </th>
                    <th className="text-right font-medium text-muted-foreground px-3 py-2 border-b border-border">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-border last:border-b-0"
                    >
                      <td className="px-3 py-2 align-middle text-[11px] text-muted-foreground whitespace-nowrap">
                        {new Date(entry.changed_at).toLocaleString('ja-JP', {
                          hour12: false,
                        })}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <code className="text-[10px] font-mono text-foreground">
                          {entry.token_name}
                        </code>
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="inline-block h-3 w-3 shrink-0 rounded-sm border border-border"
                            style={{ backgroundColor: toPreviewColor(entry.old_value) }}
                          />
                          <code className="text-[10px] font-mono text-muted-foreground">
                            {entry.old_value}
                          </code>
                          <span className="text-muted-foreground/60">→</span>
                          <span
                            className="inline-block h-3 w-3 shrink-0 rounded-sm border border-border"
                            style={{ backgroundColor: toPreviewColor(entry.new_value) }}
                          />
                          <code className="text-[10px] font-mono text-foreground">
                            {entry.new_value}
                          </code>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-middle text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px]"
                          onClick={() => rollback(entry)}
                        >
                          この変更を戻す
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {history.length >= historyLimit && (
          <div className="mt-2 text-center">
            <Button
              size="sm"
              variant="ghost"
              className="text-[11px]"
              onClick={() => setHistoryLimit((prev) => prev + 20)}
            >
              もっと見る
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}
