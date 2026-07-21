'use client'

// 診断ツールの結果画面に出す「登録済みの表現ルール」（＝branding.bz に反映済みの現在地）。
// - この診断の提案（session_data.diagnosis.tone_rules）とは別枠。取り違えないよう見出しと注記で区別する。
// - 取得はクライアント直 SELECT（governance_rules_select ポリシー＝自社のみ閲覧可）。**書き込みはしない**。
// - 未ログイン／company未解決／0件はセクションごと非表示（エラーにしない＝ツールの進行を妨げない）。
// - カード装飾はスーパー管理の一覧と共有（lib/brand/rule-display・RuleExampleBoxes）。
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { RuleExampleBoxes } from '@/components/shared/RuleExampleBoxes'
import {
  compareRulesForDisplay,
  ruleTypeLabel,
  severityMeta,
  sourceLabel,
} from '@/lib/brand/rule-display'

type Rule = {
  id: string
  rule_type: string
  rule_text: string
  ng_example: string | null
  ok_example: string | null
  severity: string
  source: string | null
  sort_order: number
}

export function RegisteredToneRules({ companyId }: { companyId: string | null }) {
  const [rules, setRules] = useState<Rule[]>([])

  useEffect(() => {
    if (!companyId) {
      setRules([])
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
        const rows = ((data as Rule[] | null) || []).filter((r) => (r.rule_text || '').trim())
        setRules([...rows].sort(compareRulesForDisplay))
      } catch {
        // 表示専用の補足情報。取得できなくてもツールの利用は妨げない
      }
    })()
    return () => {
      cancelled = true
    }
  }, [companyId])

  if (rules.length === 0) return null

  return (
    <div className="mt-8">
      <h3 className="text-sm font-bold text-foreground mb-1 tracking-wide">
        登録済みの表現ルール（branding.bz に反映済み）
      </h3>
      <p className="text-[13px] text-muted-foreground mb-3 m-0">
        すでに御社のブランドとして登録され、AIの生成に反映されているルールです（この診断の提案とは別）
      </p>
      <div className="space-y-2">
        {rules.map((r) => (
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
      </div>
    </div>
  )
}
