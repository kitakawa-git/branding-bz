'use client'

// 診断ツールの結果画面の「表現ルール」（1セクションに統合）。
// - ベース＝governance_rules（自社・全種別・RLS select・**読み取りのみ**）＝ブランドの現在地。
// - セッションの診断提案は「まだ登録されていないもの」だけを末尾に足す（同文はDB側に出ているので重複させない）。
//   照合は rule_text の正規化（trim＋空白圧縮）による完全一致。表記ゆれの吸収はしない。
//   ※スーパー管理でルール文を編集すると同文でなくなり「未登録の提案」として再出現しうる（許容）。
// - 未ログイン／company未解決／DB0件のときは提案のみを表示（エラーにしない）。
// - PDF・連携フローはセッションの診断結果を使い続ける（ここでの統合表示は画面だけの話）。
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { RuleExampleBoxes } from '@/components/shared/RuleExampleBoxes'
import {
  compareRulesForDisplay,
  diagnosisSeverityToRule,
  ruleTypeLabel,
  severityMeta,
  sourceLabel,
  unregisteredProposals,
} from '@/lib/brand/rule-display'
import type { ToneRule } from '../../../lib/diagnosis'

type DbRule = {
  id: string
  rule_type: string
  rule_text: string
  ng_example: string | null
  ok_example: string | null
  severity: string
  source: string | null
  sort_order: number
}

export function ToneRulesSection({
  companyId,
  sessionRules = [],
}: {
  companyId: string | null
  sessionRules?: ToneRule[]
}) {
  const [dbRules, setDbRules] = useState<DbRule[]>([])

  useEffect(() => {
    if (!companyId) {
      setDbRules([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase
          .from('governance_rules')
          .select('id, rule_type, rule_text, ng_example, ok_example, severity, source, sort_order')
          .eq('company_id', companyId)
        if (cancelled) return
        const rows = ((data as DbRule[] | null) || []).filter((r) => (r.rule_text || '').trim())
        setDbRules([...rows].sort(compareRulesForDisplay))
      } catch {
        // 表示専用の補足情報。取得できなくてもツールの利用は妨げない
      }
    })()
    return () => {
      cancelled = true
    }
  }, [companyId])

  // 診断の提案のうち、まだ登録されていないものだけ
  const proposals = unregisteredProposals(
    dbRules.map((r) => r.rule_text),
    sessionRules,
  )

  if (dbRules.length === 0 && proposals.length === 0) return null

  const registered = dbRules.length > 0

  return (
    <div className="mt-8">
      <h3 className="text-sm font-bold text-foreground mb-1 tracking-wide">
        {registered ? '表現ルール' : 'この診断からの提案'}
      </h3>
      <p className="text-[13px] text-muted-foreground mb-3 m-0">
        {registered
          ? 'すでに登録され、AIの生成に反映されているルールです。この診断の新しい提案は末尾に並びます'
          : 'この診断から提案されたルールです。連携するとブランドに登録され、AIの生成に反映されます'}
      </p>

      <div className="space-y-2">
        {/* 登録済み（＝現在地） */}
        {dbRules.map((r) => (
          <div key={r.id} className="rounded-lg border border-border bg-background p-4">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              {severityMeta(r.severity) && (
                <span className={`py-0.5 px-2 rounded text-xs font-semibold ${severityMeta(r.severity)!.cls}`}>
                  {severityMeta(r.severity)!.label}
                </span>
              )}
              <span className="py-0.5 px-2 bg-gray-100 text-gray-600 rounded text-xs font-semibold">
                {ruleTypeLabel(r.rule_type)}
              </span>
              <span className="py-0.5 px-2 border border-border text-muted-foreground rounded text-xs font-medium">
                {sourceLabel(r.source)}
              </span>
            </div>
            <p className="text-sm font-bold text-foreground whitespace-pre-line break-words m-0">{r.rule_text}</p>
            <RuleExampleBoxes ngExample={r.ng_example} okExample={r.ok_example} />
          </div>
        ))}

        {/* この診断の提案（まだ登録されていないもの） */}
        {proposals.map((r, i) => {
          const sev = severityMeta(diagnosisSeverityToRule(r.severity))
          return (
            <div key={`proposal-${i}`} className="rounded-lg border border-violet-200 bg-violet-50/40 p-4">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                {sev && <span className={`py-0.5 px-2 rounded text-xs font-semibold ${sev.cls}`}>{sev.label}</span>}
                <span className="py-0.5 px-2 bg-gray-100 text-gray-600 rounded text-xs font-semibold">
                  {ruleTypeLabel('tone_rule')}
                </span>
                <span className="py-0.5 px-2 bg-violet-100 text-violet-800 rounded text-xs font-semibold">
                  この診断の提案（未登録）
                </span>
              </div>
              <p className="text-sm font-bold text-foreground whitespace-pre-line break-words m-0">{r.rule_text}</p>
              <RuleExampleBoxes ngExample={r.ng_example} okExample={r.ok_example} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
