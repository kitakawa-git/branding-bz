// 獲得目標フォーム内の「達成条件（判定ルール）」エディタ（テンプレカード＋タイプ別入力＋常時プレビュー）
import { Input } from '@/components/ui/input'
import MetricPicker, { type MetricSelection } from '../MetricPicker'
import { Draft, RULE_TEMPLATES, rulePreview } from '../desired-evidence-rules'
import { SELECT_CLASS } from './shared'

export default function RuleEditor({
  companyId,
  draft,
  setDraft,
}: {
  companyId: string
  draft: Draft
  setDraft: (d: Draft) => void
}) {
  // 指標選択：表示名・単位・内部キーをまとめて draft に反映（単位はピッカーの canonical_unit を自動採用）
  const setAggMetric = (sel: MetricSelection | null) =>
    setDraft({
      ...draft,
      agg_metric_key: sel?.metric_key ?? '',
      agg_metric_label: sel?.display_name ?? '',
      agg_unit: sel?.canonical_unit ?? '',
    })
  const setFilterMetric = (sel: MetricSelection | null) =>
    setDraft({
      ...draft,
      filter_metric_key: sel?.metric_key ?? '',
      filter_metric_label: sel?.display_name ?? '',
      filter_unit: sel?.canonical_unit ?? '',
    })

  return (
    <div className="border border-border rounded-xl p-3 bg-white space-y-3">
      {/* テンプレカード：どうなったら「達成」か */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {RULE_TEMPLATES.map((t) => {
          const active = draft.rule_type === t.value
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setDraft({ ...draft, rule_type: t.value })}
              className={`text-left rounded-lg border p-3 transition ${
                active ? 'border-ds-app-accent-soft bg-ds-app-accent-soft/10 ring-1 ring-ds-app-accent-soft' : 'border-border bg-white hover:border-ds-app-accent-soft/60'
              }`}
            >
              <p className="text-[13px] font-bold text-foreground m-0">
                <span className="mr-1">{t.icon}</span>
                {t.title}
              </p>
              <p className="text-[11px] text-muted-foreground m-0 mt-0.5">{t.example}</p>
            </button>
          )
        })}
      </div>

      {/* ①数字が目標に届いたら（aggregate） */}
      {draft.rule_type === 'aggregate' && (
        <div className="space-y-3">
          <MetricPicker
            companyId={companyId}
            value={draft.agg_metric_key}
            onChange={setAggMetric}
            label="どの数字で見る？"
            required
          />
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs font-bold text-foreground mb-1.5 block">条件</label>
              <select
                className={SELECT_CLASS}
                value={draft.agg_operator}
                onChange={(e) => setDraft({ ...draft, agg_operator: e.target.value as '>=' | '<=' })}
              >
                <option value=">=">目標値以上になったら</option>
                <option value="<=">目標値以下になったら</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-foreground mb-1.5 block">
                目標値 <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={draft.agg_target}
                  onChange={(e) => setDraft({ ...draft, agg_target: e.target.value })}
                  placeholder="例: 50"
                  className="h-10"
                />
                {draft.agg_unit && <span className="text-sm text-muted-foreground shrink-0">{draft.agg_unit}</span>}
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-foreground mb-1.5 block">今の数字（任意）</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={draft.agg_baseline}
                onChange={(e) => setDraft({ ...draft, agg_baseline: e.target.value })}
                placeholder="例: 20"
                className="h-10 max-w-[200px]"
              />
              {draft.agg_unit && <span className="text-sm text-muted-foreground shrink-0">{draft.agg_unit}</span>}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 m-0">入れると「今 → 目標」の進捗率（％）を出せます</p>
          </div>

          {/* 詳細（集計方法）：既定は「最新」 */}
          <details className="text-[13px]">
            <summary className="cursor-pointer text-muted-foreground">詳細：数字の見方（既定は「最新の値」）</summary>
            <div className="mt-2">
              <select
                className={SELECT_CLASS}
                value={draft.aggregation}
                onChange={(e) => setDraft({ ...draft, aggregation: e.target.value as Draft['aggregation'] })}
              >
                <option value="latest">最新の値で見る</option>
                <option value="sum">合計で見る</option>
                <option value="average">平均で見る</option>
                <option value="maximum">最大で見る</option>
                <option value="minimum">最小で見る</option>
              </select>
            </div>
          </details>
        </div>
      )}

      {/* ②◯件たまったら（count） */}
      {draft.rule_type === 'count' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-foreground mb-1.5 block">
              何件そろったら達成？ <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                value={draft.threshold}
                onChange={(e) => setDraft({ ...draft, threshold: e.target.value })}
                className="h-10 max-w-[200px]"
              />
              <span className="text-sm text-muted-foreground shrink-0">件</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 m-0">既定では「立証する実績」の件数を数えます</p>
          </div>

          <details className="text-[13px]">
            <summary className="cursor-pointer text-muted-foreground">詳細：特定の指標に絞る（任意）</summary>
            <div className="mt-2 space-y-3">
              <MetricPicker companyId={companyId} value={draft.filter_metric_key} onChange={setFilterMetric} label="この指標を持つ実績だけ数える" />
              {draft.filter_metric_key && (
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-bold text-foreground mb-1.5 block">さらに条件（任意）</label>
                    <select
                      className={SELECT_CLASS}
                      value={draft.filter_operator}
                      onChange={(e) => setDraft({ ...draft, filter_operator: e.target.value as Draft['filter_operator'] })}
                    >
                      <option value="">指定しない</option>
                      <option value=">=">しきい値以上</option>
                      <option value="<=">しきい値以下</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-bold text-foreground mb-1.5 block">しきい値</label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={draft.filter_value}
                        onChange={(e) => setDraft({ ...draft, filter_value: e.target.value })}
                        placeholder="条件を使う場合は必須"
                        className="h-10"
                      />
                      {draft.filter_unit && <span className="text-sm text-muted-foreground shrink-0">{draft.filter_unit}</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </details>
        </div>
      )}

      {/* ③証拠が1つでもあれば（boolean） */}
      {draft.rule_type === 'boolean' && (
        <details className="text-[13px]">
          <summary className="cursor-pointer text-muted-foreground">詳細：必要な件数を変える（既定は1件）</summary>
          <div className="mt-2">
            <label className="text-xs font-bold text-foreground mb-1.5 block">◯件以上あれば達成</label>
            <Input
              type="number"
              min={1}
              value={draft.minimum_proof_count}
              onChange={(e) => setDraft({ ...draft, minimum_proof_count: e.target.value })}
              placeholder="1"
              className="h-10 max-w-[200px]"
            />
          </div>
        </details>
      )}

      {/* ④人が見て判断する（manual）：入力なし */}
      {draft.rule_type === 'manual' && (
        <p className="text-[13px] text-muted-foreground m-0">自動では判定しません。あとで「人間判断」から達成状態を記録します。</p>
      )}

      {/* 常時プレビュー：この条件が満たされたら「達成」 */}
      <div className="rounded-md bg-emerald-50 border border-emerald-200 p-2.5">
        <p className="text-[13px] text-emerald-900 m-0">
          <span className="font-bold">こうなったら達成：</span>
          {rulePreview(draft)}
        </p>
      </div>
    </div>
  )
}
