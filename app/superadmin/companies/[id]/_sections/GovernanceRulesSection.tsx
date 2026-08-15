'use client'

// スーパー管理画面 企業詳細: 「表現ルール」(governance_rules) CRUD セクション
// - 一覧 / 追加 / 編集 / 削除 / 並び替え（上下）
// - rule_type / severity はセレクト、ng_example・ok_example は任意（scope はUIから撤去・下記コメント参照）
// - 書き込みは governance_rules_superadmin_all ポリシー（is_superadmin）で許可される前提
// - 「AI草案を生成」: 業種・バリュー・用語規定からルール候補を推定（/api/superadmin/draft-extraction・
//   押した時だけ）。候補は1件ずつ承認/編集/却下。承認・編集して登録した時のみ通常の作成経路でINSERT。
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import { Plus, Trash2, Pencil, Check, X, ChevronUp, ChevronDown, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { AIButton } from '@/components/shared/AIButton'
import { RuleExampleBoxes } from '@/components/shared/RuleExampleBoxes'
import { RULE_TYPES, SEVERITIES, ruleTypeLabel, severityMeta } from '@/lib/brand/rule-display'
import type { ValuePropositionRef } from './ProofPointsSection'
import type { RuleExtractDraft } from '@/lib/brand/draft-extraction'

type GovernanceRule = {
  id: string
  company_id: string
  rule_type: string
  scope: string
  target_value_proposition_id: string | null
  rule_text: string
  ng_example: string | null
  ok_example: string | null
  severity: string
  sort_order: number
}

type Draft = {
  rule_type: string
  scope: string
  target_value_proposition_id: string
  rule_text: string
  ng_example: string
  ok_example: string
  severity: string
}

// 種別・重要度・出所のラベルは lib/brand/rule-display.ts に集約（診断ツールと共用＝表記がズレない）。
// scope（適用範囲）はUIから撤去した。getGuardrails に絞り込み機構はあるが呼び出し元が
// 誰も scopes を渡しておらず、全ルールが常時注入される＝設定しても効かないため。
// DB列・API・絞り込み機構は温存し、値は「編集時は既存値のまま／新規は 'global'」で書き続ける。

const emptyDraft = (): Draft => ({
  rule_type: 'banned_word',
  scope: 'global',
  target_value_proposition_id: '',
  rule_text: '',
  ng_example: '',
  ok_example: '',
  severity: 'warn',
})

const SELECT_CLASS =
  'h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-ds-app-accent-soft focus:ring-1 focus:ring-ds-app-accent-soft'

export default function GovernanceRulesSection({
  companyId,
  valuePropositions,
  onDataChanged,
  headerActionSlotId,
}: {
  companyId: string
  valuePropositions: ValuePropositionRef[]
  // データ再取得のたびに通知（ウィザードのステップ判定更新用・任意）
  onDataChanged?: () => void
  // 指定すると「AI草案を生成」をこのidの要素へ portal する（ステップ見出し行に置くため）。
  // 未指定・要素が無い場合は従来どおりセクション下部のボタン行に出す。
  headerActionSlotId?: string
}) {
  const [rows, setRows] = useState<GovernanceRule[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null) // 'new' または行ID
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [saving, setSaving] = useState(false)
  const [aiDrafts, setAiDrafts] = useState<RuleExtractDraft[] | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiRegistering, setAiRegistering] = useState<number | null>(null)
  // 見出し行のアクション置き場（マウント後に解決。無ければ従来位置にフォールバック）
  const [actionSlot, setActionSlot] = useState<HTMLElement | null>(null)

  const vpTitle = (id: string | null) =>
    id ? valuePropositions.find((v) => v.id === id)?.title ?? '（削除済みの提供価値）' : null

  const fetchRows = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('governance_rules')
      .select('*')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) {
      console.error('[GovernanceRules] 取得エラー:', error)
      toast.error('表現ルールの取得に失敗しました')
    } else {
      setRows((data as GovernanceRule[]) || [])
      onDataChanged?.()
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  // portal 先の解決はマウント後（親が同じコミットで描画する受け皿を掴む）
  useEffect(() => {
    setActionSlot(headerActionSlotId ? document.getElementById(headerActionSlotId) : null)
  }, [headerActionSlotId])

  const startAdd = () => {
    setDraft(emptyDraft())
    setEditingId('new')
  }

  const startEdit = (row: GovernanceRule) => {
    setDraft({
      rule_type: row.rule_type,
      scope: row.scope,
      target_value_proposition_id: row.target_value_proposition_id ?? '',
      rule_text: row.rule_text ?? '',
      ng_example: row.ng_example ?? '',
      ok_example: row.ok_example ?? '',
      severity: row.severity,
    })
    setEditingId(row.id)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setDraft(emptyDraft())
  }

  const buildPayload = () => ({
    company_id: companyId,
    rule_type: draft.rule_type,
    scope: draft.scope,
    target_value_proposition_id: draft.target_value_proposition_id || null,
    rule_text: draft.rule_text.trim(),
    ng_example: draft.ng_example.trim() || null,
    ok_example: draft.ok_example.trim() || null,
    severity: draft.severity,
  })

  const save = async () => {
    if (!draft.rule_text.trim()) {
      toast.error('ルール本文は必須です')
      return
    }
    setSaving(true)
    try {
      if (editingId === 'new') {
        const nextOrder = rows.length > 0 ? Math.max(...rows.map((r) => r.sort_order)) + 1 : 0
        const { error } = await supabase
          .from('governance_rules')
          .insert({ ...buildPayload(), source: 'manual', sort_order: nextOrder })
        if (error) throw error
        toast.success('追加しました')
      } else if (editingId) {
        const { error } = await supabase
          .from('governance_rules')
          .update({ ...buildPayload(), updated_at: new Date().toISOString() })
          .eq('id', editingId)
        if (error) throw error
        toast.success('更新しました')
      }
      cancelEdit()
      await fetchRows()
    } catch (err) {
      console.error('[GovernanceRules] 保存エラー:', err)
      toast.error('保存に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('この表現ルールを削除しますか？')) return
    const { error } = await supabase.from('governance_rules').delete().eq('id', id)
    if (error) {
      console.error('[GovernanceRules] 削除エラー:', error)
      toast.error('削除に失敗しました')
      return
    }
    toast.success('削除しました')
    if (editingId === id) cancelEdit()
    await fetchRows()
  }

  const move = async (index: number, dir: -1 | 1) => {
    const target = rows[index]
    const swap = rows[index + dir]
    if (!target || !swap) return
    const results = await Promise.all([
      supabase.from('governance_rules').update({ sort_order: swap.sort_order }).eq('id', target.id),
      supabase.from('governance_rules').update({ sort_order: target.sort_order }).eq('id', swap.id),
    ])
    if (results.some((r) => r.error)) {
      toast.error('並び替えに失敗しました')
      return
    }
    await fetchRows()
  }

  // ---- AI草案生成（候補は表示のみ。登録は1件ずつの承認/編集時だけ） ----
  const runAiExtract = async () => {
    setAiLoading(true)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token || ''
      const res = await fetch('/api/superadmin/draft-extraction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ companyId, kind: 'rule' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setAiDrafts(json.drafts as RuleExtractDraft[])
    } catch (err) {
      console.error('[GovernanceRules] AI草案生成エラー:', err)
      toast.error('AI草案の生成に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
    } finally {
      setAiLoading(false)
    }
  }

  const dismissAiDraft = (index: number) => {
    setAiDrafts((prev) => (prev ? prev.filter((_, i) => i !== index) : prev))
  }

  // そのまま承認して登録（既存の作成経路と同じINSERT）
  const approveAiDraft = async (d: RuleExtractDraft, index: number) => {
    setAiRegistering(index)
    try {
      const nextOrder = rows.length > 0 ? Math.max(...rows.map((r) => r.sort_order)) + 1 : 0
      const { error } = await supabase.from('governance_rules').insert({
        company_id: companyId,
        rule_type: d.rule_type,
        scope: d.scope,
        // DBの CHECK 制約が source を 'manual' | 'personality_diagnosis' に限定しているため manual。
        // AI草案由来を区別したい場合は、先に制約へ値を追加するマイグレーションが必要。
        source: 'manual',
        target_value_proposition_id: null,
        rule_text: d.rule_text.trim(),
        ng_example: d.ng_example.trim() || null,
        ok_example: d.ok_example.trim() || null,
        severity: d.severity,
        sort_order: nextOrder,
      })
      if (error) throw error
      toast.success('登録しました')
      dismissAiDraft(index)
      await fetchRows()
    } catch (err) {
      console.error('[GovernanceRules] AI草案登録エラー:', err)
      toast.error('登録に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
    } finally {
      setAiRegistering(null)
    }
  }

  // 既存の追加フォームに読み込んで編集してから登録（保存は既存の save 経路）
  const editAiDraft = (d: RuleExtractDraft, index: number) => {
    setDraft({
      rule_type: d.rule_type,
      scope: d.scope,
      target_value_proposition_id: '',
      rule_text: d.rule_text,
      ng_example: d.ng_example,
      ok_example: d.ok_example,
      severity: d.severity,
    })
    setEditingId('new')
    dismissAiDraft(index)
  }

  // 「AI草案を生成」ボタン本体。置き場所（見出し行 or セクション下部）だけが変わる。
  // AIアクションは共通の AIButton（sm＝px-3 py-1.5 text-xs gap-1.5）に統一。
  const aiExtractButton = (
    <AIButton type="button" size="sm" onClick={runAiExtract} disabled={aiLoading || loading}>
      {aiLoading ? '生成中...' : 'AI草案を生成'}
    </AIButton>
  )

  const renderAiDrafts = () => {
    if (aiDrafts === null) return null
    return (
      <div className="mt-4">
        <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-foreground">
          <Sparkles size={14} />
          AI草案（{aiDrafts.length}）— 承認するまで登録されません
        </div>
        {aiDrafts.length === 0 ? (
          <p className="text-muted-foreground text-sm m-0">
            新しい草案は見つかりませんでした（業種・バリュー・用語規定に推定の源泉が無いか、既存と重複しています）
          </p>
        ) : (
          <div className="space-y-2">
            {aiDrafts.map((d, i) => (
              <div key={`${d.rule_text}-${i}`} className="border border-violet-200 bg-violet-50/40 rounded-xl p-3">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  {severityMeta(d.severity) && (
                    <span className={`py-0.5 px-2 rounded text-[11px] font-semibold ${severityMeta(d.severity)!.cls}`}>
                      {severityMeta(d.severity)!.label}
                    </span>
                  )}
                  <span className="py-0.5 px-2 bg-gray-100 text-gray-600 rounded text-[11px] font-semibold">
                    {ruleTypeLabel(d.rule_type)}
                  </span>
                </div>
                <p className="text-sm font-bold text-foreground break-words m-0">{d.rule_text}</p>
                {/* 登録後と同じ見た目（草案と登録済みで見え方を変えない） */}
                <RuleExampleBoxes ngExample={d.ng_example} okExample={d.ok_example} />
                <p className="text-[11px] text-muted-foreground mt-2 m-0">根拠: {d.rationale}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button type="button" size="sm" onClick={() => approveAiDraft(d, i)} disabled={aiRegistering !== null}>
                    <Check size={14} />
                    {aiRegistering === i ? '登録中...' : '承認して登録'}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => editAiDraft(d, i)} disabled={aiRegistering !== null}>
                    <Pencil size={14} />
                    編集して登録
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => dismissAiDraft(i)} disabled={aiRegistering !== null}>
                    <X size={14} />
                    却下
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderForm = () => (
    <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-4 mb-3 space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="text-xs font-bold text-foreground mb-1.5 block">ルール種別</label>
          <select
            className={SELECT_CLASS}
            value={draft.rule_type}
            onChange={(e) => setDraft({ ...draft, rule_type: e.target.value })}
          >
            {RULE_TYPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {/* 3区分は「語なのか／話し方なのか／断定なのか」で選ぶ。迷いを減らすため説明を出す */}
          <p className="text-[11px] text-muted-foreground mt-1 m-0">
            {RULE_TYPES.find((s) => s.value === draft.rule_type)?.hint}
          </p>
        </div>
        <div className="flex-1">
          <label className="text-xs font-bold text-foreground mb-1.5 block">重要度</label>
          <select
            className={SELECT_CLASS}
            value={draft.severity}
            onChange={(e) => setDraft({ ...draft, severity: e.target.value })}
          >
            {SEVERITIES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-foreground mb-1.5 block">
          紐づく提供価値（任意）
        </label>
        <select
          className={SELECT_CLASS}
          value={draft.target_value_proposition_id}
          onChange={(e) => setDraft({ ...draft, target_value_proposition_id: e.target.value })}
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
          ルール本文 <span className="text-red-500">*</span>
        </label>
        <AutoResizeTextarea
          value={draft.rule_text}
          onChange={(e) => setDraft({ ...draft, rule_text: e.target.value })}
          placeholder="例: 「業界No.1」など根拠のない最上級表現は使わない"
          className="min-h-[70px]"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="text-xs font-bold text-foreground mb-1.5 block">NG例（任意）</label>
          <AutoResizeTextarea
            value={draft.ng_example}
            onChange={(e) => setDraft({ ...draft, ng_example: e.target.value })}
            placeholder="避けたい表現の例"
            className="min-h-[50px]"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs font-bold text-foreground mb-1.5 block">OK例（任意）</label>
          <AutoResizeTextarea
            value={draft.ok_example}
            onChange={(e) => setDraft({ ...draft, ok_example: e.target.value })}
            placeholder="推奨する言い換えの例"
            className="min-h-[50px]"
          />
        </div>
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
        <p className="text-muted-foreground text-sm mb-3">表現ルールが登録されていません</p>
      ) : (
        rows.map((row, index) =>
          editingId === row.id ? (
            <div key={row.id}>{renderForm()}</div>
          ) : (
            <div key={row.id} className="border border-border rounded-xl p-4 mb-3 bg-background">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    {severityMeta(row.severity) && (
                      <span
                        className={`py-0.5 px-2 rounded text-xs font-semibold ${severityMeta(row.severity)!.cls}`}
                      >
                        {severityMeta(row.severity)!.label}
                      </span>
                    )}
                    <span className="py-0.5 px-2 bg-gray-100 text-gray-600 rounded text-xs font-semibold">
                      {ruleTypeLabel(row.rule_type)}
                    </span>
                    {vpTitle(row.target_value_proposition_id) && (
                      <span className="py-0.5 px-2 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                        {vpTitle(row.target_value_proposition_id)}
                      </span>
                    )}
                    {/* 出所（手入力／診断由来）は表示しない。AIの生成には影響せず、
                        source は連携時の置換判定にのみ使われるため（再連携で診断由来の行は作り直される）。 */}
                  </div>
                  <p className="text-sm font-bold text-foreground whitespace-pre-line break-words">
                    {row.rule_text}
                  </p>
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

              {/* NG例・OK例は共通部品（診断ツール・ポータルと同じ見た目）。
                  操作ボタン行の外に出して**カード全幅**に広げる（行内に置くとボタン幅ぶん狭くなる）。 */}
              <RuleExampleBoxes ngExample={row.ng_example} okExample={row.ok_example} />
            </div>
          )
        )
      )}

      {editingId === 'new' && renderForm()}

      {editingId === null && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={startAdd} className="py-2 px-4 text-[13px]">
            <Plus size={16} />
            表現ルールを追加
          </Button>
          {/* スロットが無いときだけここに出す（ある場合は見出し行へ portal） */}
          {!actionSlot && aiExtractButton}
        </div>
      )}

      {/* ステップ見出し行へ差し込み */}
      {actionSlot && createPortal(aiExtractButton, actionSlot)}

      {renderAiDrafts()}
    </div>
  )
}
