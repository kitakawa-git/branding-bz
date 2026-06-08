'use client'

// スーパー管理画面 企業詳細: 「証拠・実績」(proof_points) CRUD セクション
// - 一覧 / 追加 / 編集 / 削除 / 並び替え（上下）
// - value_proposition_id は当該企業の提供価値(value_propositions)からセレクト（未選択=全般）
// - 書き込みは proof_points_superadmin_all ポリシー（is_superadmin）で許可される前提
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import { Plus, Trash2, Pencil, Check, X, ChevronUp, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'

export type ValuePropositionRef = { id: string; title: string }

type ProofPoint = {
  id: string
  company_id: string
  value_proposition_id: string | null
  title: string
  description: string | null
  source_type: string | null
  source_url: string | null
  evidence_date: string | null
  sort_order: number
}

type Draft = {
  value_proposition_id: string
  title: string
  description: string
  source_type: string
  source_url: string
  evidence_date: string
}

const SOURCE_TYPES: { value: string; label: string }[] = [
  { value: 'jisseki', label: '実績' },
  { value: 'jirei', label: '事例' },
  { value: 'data', label: 'データ' },
  { value: 'voice', label: '顧客の声' },
  { value: 'award', label: '受賞' },
  { value: 'other', label: 'その他' },
]

const sourceLabel = (v: string | null) => SOURCE_TYPES.find((s) => s.value === v)?.label ?? null

const emptyDraft = (): Draft => ({
  value_proposition_id: '',
  title: '',
  description: '',
  source_type: '',
  source_url: '',
  evidence_date: '',
})

const SELECT_CLASS =
  'h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500'

export default function ProofPointsSection({
  companyId,
  valuePropositions,
}: {
  companyId: string
  valuePropositions: ValuePropositionRef[]
}) {
  const [rows, setRows] = useState<ProofPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null) // 'new' または行ID
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [saving, setSaving] = useState(false)

  const vpTitle = (id: string | null) =>
    id ? valuePropositions.find((v) => v.id === id)?.title ?? '（削除済みの提供価値）' : '全般'

  const fetchRows = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('proof_points')
      .select('*')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) {
      console.error('[ProofPoints] 取得エラー:', error)
      toast.error('証拠・実績の取得に失敗しました')
    } else {
      setRows((data as ProofPoint[]) || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  const startAdd = () => {
    setDraft(emptyDraft())
    setEditingId('new')
  }

  const startEdit = (row: ProofPoint) => {
    setDraft({
      value_proposition_id: row.value_proposition_id ?? '',
      title: row.title ?? '',
      description: row.description ?? '',
      source_type: row.source_type ?? '',
      source_url: row.source_url ?? '',
      evidence_date: row.evidence_date ?? '',
    })
    setEditingId(row.id)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setDraft(emptyDraft())
  }

  const buildPayload = () => ({
    company_id: companyId,
    value_proposition_id: draft.value_proposition_id || null,
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    source_type: draft.source_type || null,
    source_url: draft.source_url.trim() || null,
    evidence_date: draft.evidence_date || null,
  })

  const save = async () => {
    if (!draft.title.trim()) {
      toast.error('タイトルは必須です')
      return
    }
    setSaving(true)
    try {
      if (editingId === 'new') {
        const nextOrder = rows.length > 0 ? Math.max(...rows.map((r) => r.sort_order)) + 1 : 0
        const { error } = await supabase
          .from('proof_points')
          .insert({ ...buildPayload(), sort_order: nextOrder })
        if (error) throw error
        toast.success('追加しました')
      } else if (editingId) {
        const { error } = await supabase
          .from('proof_points')
          .update({ ...buildPayload(), updated_at: new Date().toISOString() })
          .eq('id', editingId)
        if (error) throw error
        toast.success('更新しました')
      }
      cancelEdit()
      await fetchRows()
    } catch (err) {
      console.error('[ProofPoints] 保存エラー:', err)
      toast.error('保存に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('この証拠・実績を削除しますか？')) return
    const { error } = await supabase.from('proof_points').delete().eq('id', id)
    if (error) {
      console.error('[ProofPoints] 削除エラー:', error)
      toast.error('削除に失敗しました')
      return
    }
    toast.success('削除しました')
    if (editingId === id) cancelEdit()
    await fetchRows()
  }

  // 並び替え（隣と sort_order を入れ替えて両方を更新）
  const move = async (index: number, dir: -1 | 1) => {
    const target = rows[index]
    const swap = rows[index + dir]
    if (!target || !swap) return
    const results = await Promise.all([
      supabase.from('proof_points').update({ sort_order: swap.sort_order }).eq('id', target.id),
      supabase.from('proof_points').update({ sort_order: target.sort_order }).eq('id', swap.id),
    ])
    if (results.some((r) => r.error)) {
      toast.error('並び替えに失敗しました')
      return
    }
    await fetchRows()
  }

  const renderForm = () => (
    <div className="border border-blue-200 bg-blue-50/40 rounded-lg p-4 mb-3 space-y-4">
      <div>
        <label className="text-xs font-bold text-foreground mb-1.5 block">紐づく提供価値</label>
        <select
          className={SELECT_CLASS}
          value={draft.value_proposition_id}
          onChange={(e) => setDraft({ ...draft, value_proposition_id: e.target.value })}
        >
          <option value="">全般（特定の提供価値に紐づけない）</option>
          {valuePropositions.map((vp) => (
            <option key={vp.id} value={vp.id}>
              {vp.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-bold text-foreground mb-1.5 block">
          タイトル <span className="text-red-500">*</span>
        </label>
        <Input
          type="text"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="例: 導入企業の継続率98%（2025年実績）"
          className="h-10"
        />
      </div>

      <div>
        <label className="text-xs font-bold text-foreground mb-1.5 block">説明</label>
        <AutoResizeTextarea
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          placeholder="この証拠の補足・背景"
          className="min-h-[70px]"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="text-xs font-bold text-foreground mb-1.5 block">証拠タイプ</label>
          <select
            className={SELECT_CLASS}
            value={draft.source_type}
            onChange={(e) => setDraft({ ...draft, source_type: e.target.value })}
          >
            <option value="">未選択</option>
            {SOURCE_TYPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs font-bold text-foreground mb-1.5 block">証拠の日付</label>
          <Input
            type="date"
            value={draft.evidence_date}
            onChange={(e) => setDraft({ ...draft, evidence_date: e.target.value })}
            className="h-10"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-foreground mb-1.5 block">出典URL</label>
        <Input
          type="url"
          value={draft.source_url}
          onChange={(e) => setDraft({ ...draft, source_url: e.target.value })}
          placeholder="https://..."
          className="h-10"
        />
      </div>

      <div className="flex gap-2">
        <Button type="button" onClick={save} disabled={saving} size="sm">
          <Check size={14} />
          {saving ? '保存中...' : '保存'}
        </Button>
        <Button type="button" variant="outline" onClick={cancelEdit} disabled={saving} size="sm">
          <X size={14} />
          キャンセル
        </Button>
      </div>
    </div>
  )

  return (
    <div>
      {loading ? (
        <p className="text-muted-foreground text-sm">読み込み中...</p>
      ) : rows.length === 0 && editingId !== 'new' ? (
        <p className="text-muted-foreground text-sm mb-3">証拠・実績が登録されていません</p>
      ) : (
        rows.map((row, index) =>
          editingId === row.id ? (
            <div key={row.id}>{renderForm()}</div>
          ) : (
            <div key={row.id} className="border border-border rounded-lg p-4 mb-3 bg-background">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className="py-0.5 px-2 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                      {vpTitle(row.value_proposition_id)}
                    </span>
                    {sourceLabel(row.source_type) && (
                      <span className="py-0.5 px-2 bg-gray-100 text-gray-600 rounded text-xs font-semibold">
                        {sourceLabel(row.source_type)}
                      </span>
                    )}
                    {row.evidence_date && (
                      <span className="text-xs text-muted-foreground">{row.evidence_date}</span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-foreground break-words">{row.title}</p>
                  {row.description && (
                    <p className="text-[13px] text-muted-foreground mt-1 whitespace-pre-line break-words">
                      {row.description}
                    </p>
                  )}
                  {row.source_url && (
                    <a
                      href={row.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] text-blue-600 break-all"
                    >
                      {row.source_url}
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="size-8"
                  >
                    <ChevronUp size={14} />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => move(index, 1)}
                    disabled={index === rows.length - 1}
                    className="size-8"
                  >
                    <ChevronDown size={14} />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => startEdit(row)}
                    className="size-8"
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => remove(row.id)}
                    className="size-8 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </div>
          )
        )
      )}

      {editingId === 'new' && renderForm()}

      {editingId === null && (
        <Button type="button" variant="outline" onClick={startAdd} className="py-2 px-4 text-[13px]">
          <Plus size={16} />
          証拠・実績を追加
        </Button>
      )}
    </div>
  )
}
