'use client'

// 指標ピッカー（共有）: metric_definitions を「名前」で選ぶ。内部キー(metric_key)はユーザーに見せない。
// - 目標フォーム（達成条件）と測定値フォームの両方で使う ＝ 名前で選べば metric_key と単位が自動で一致する。
// - 選択時は onChange に {metric_key, display_name, canonical_unit} を返す。
// - 「＋ 新しい指標を作る」: 表示名＋単位を入力 → metric_key を自動生成 → client直 insert（RLS superadmin_all）→ 選択状態に。
// - 書き込みは metric_def_superadmin_all ポリシー（is_superadmin）で許可される前提。
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, Check, X } from 'lucide-react'
import { toast } from 'sonner'

export type MetricDefinition = {
  id: string
  metric_key: string
  display_name: string
  canonical_unit: string
}

export type MetricSelection = { metric_key: string; display_name: string; canonical_unit: string }

const SELECT_CLASS =
  'h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-ds-app-accent-soft focus:ring-1 focus:ring-ds-app-accent-soft'

const RANDOM_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'
// metric_key は内部IDなので人間可読性は不要。CHECK(^[a-z0-9_]+$) を必ず満たす形で衝突しにくく生成する。
function generateMetricKey(): string {
  let s = ''
  for (let i = 0; i < 8; i++) s += RANDOM_CHARS[Math.floor(Math.random() * RANDOM_CHARS.length)]
  return `m_${s}`
}

export default function MetricPicker({
  companyId,
  value,
  onChange,
  label = '指標',
  required = false,
}: {
  companyId: string
  value: string // 選択中の metric_key（未選択は ''）
  onChange: (sel: MetricSelection | null) => void
  label?: string
  required?: boolean
}) {
  const [defs, setDefs] = useState<MetricDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchDefs = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('metric_definitions')
      .select('id, metric_key, display_name, canonical_unit')
      .eq('company_id', companyId)
      .order('display_name', { ascending: true })
    if (error) {
      console.error('[MetricPicker] 取得エラー:', error)
      toast.error('指標の取得に失敗しました')
    } else {
      setDefs((data as MetricDefinition[]) || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchDefs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  const handleSelect = (metricKey: string) => {
    if (metricKey === '__new__') {
      setCreating(true)
      return
    }
    const def = defs.find((d) => d.metric_key === metricKey)
    onChange(def ? { metric_key: def.metric_key, display_name: def.display_name, canonical_unit: def.canonical_unit } : null)
  }

  const createDefinition = async () => {
    const name = newName.trim()
    if (!name) {
      toast.error('指標の名前を入力してください')
      return
    }
    setSaving(true)
    try {
      const metricKey = generateMetricKey()
      const { data, error } = await supabase
        .from('metric_definitions')
        .insert({ company_id: companyId, metric_key: metricKey, display_name: name, canonical_unit: newUnit.trim() })
        .select('id, metric_key, display_name, canonical_unit')
        .single()
      if (error) throw error
      const def = data as MetricDefinition
      setDefs((prev) => [...prev, def].sort((a, b) => a.display_name.localeCompare(b.display_name, 'ja')))
      onChange({ metric_key: def.metric_key, display_name: def.display_name, canonical_unit: def.canonical_unit })
      setCreating(false)
      setNewName('')
      setNewUnit('')
      toast.success('指標を追加しました')
    } catch (err) {
      console.error('[MetricPicker] 作成エラー:', err)
      toast.error('指標の追加に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
    } finally {
      setSaving(false)
    }
  }

  const cancelCreate = () => {
    setCreating(false)
    setNewName('')
    setNewUnit('')
  }

  if (creating) {
    return (
      <div className="border border-violet-200 bg-violet-50/40 rounded-md p-3 space-y-2">
        <p className="text-xs font-bold text-foreground m-0">新しい指標を作る</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <label className="text-[11px] text-muted-foreground mb-1 block">名前（例: ブランド認知率）</label>
            <Input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="指標の名前" className="h-10" />
          </div>
          <div className="w-full sm:w-28">
            <label className="text-[11px] text-muted-foreground mb-1 block">単位（例: %）</label>
            <Input type="text" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="単位" className="h-10" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={createDefinition} disabled={saving}>
            <Check size={14} />
            {saving ? '追加中...' : 'この指標を使う'}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={cancelCreate} disabled={saving}>
            <X size={14} />
            やめる
          </Button>
        </div>
      </div>
    )
  }

  const selected = defs.find((d) => d.metric_key === value)

  return (
    <div>
      <label className="text-xs font-bold text-foreground mb-1.5 block">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select className={SELECT_CLASS} value={value} onChange={(e) => handleSelect(e.target.value)} disabled={loading}>
        <option value="">{loading ? '読み込み中...' : '指標を選ぶ…'}</option>
        {defs.map((d) => (
          <option key={d.id} value={d.metric_key}>
            {d.display_name}
            {d.canonical_unit ? `（${d.canonical_unit}）` : ''}
          </option>
        ))}
        <option value="__new__">＋ 新しい指標を作る</option>
      </select>
      {selected && (
        <p className="text-[11px] text-muted-foreground mt-1 m-0">
          単位: {selected.canonical_unit || '（なし）'}
          <span className="opacity-60"> ／ 内部ID: {selected.metric_key}</span>
        </p>
      )}
    </div>
  )
}
